import asyncio
import base64
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import generate_extension_token, get_current_user_id
from app.config import settings
from app.database.database import get_db
from app.database.models import Connection, User, ExtensionToken, ExtensionAuthSession
from app.database.models import PortabilityExportJob
from app.services.google_service import (
    GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
    initiate_youtube_history_export,
    refresh_google_token,
)
from app.services.spotify_service import (
    sync_spotify_user_history,
    refresh_spotify_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_processed_spotify_codes: dict[str, RedirectResponse] = {}
_spotify_code_locks: dict[str, asyncio.Lock] = {}
_spotify_global_lock = asyncio.Lock()


# ---------------------------------------------------------
# Password Hashing Helpers
# ---------------------------------------------------------

def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"{salt}${key}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    try:
        salt, key = stored_hash.split("$", 1)
        computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
        return hmac.compare_digest(key, computed)
    except Exception:
        return False


# ---------------------------------------------------------
# Schemas
# ---------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------------------------------------------------------
# Current user
# ---------------------------------------------------------

@router.get("/me")
def get_me(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = request.session.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    connections = (
        db.query(Connection)
        .filter(Connection.user_id == user.id)
        .all()
    )

    sync_token = generate_extension_token(user.id)

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
        },
        "sync_token": sync_token,
        "connections": [
            {
                "provider": (
                    "youtube"
                    if connection.provider == "google_data_portability"
                    else connection.provider
                ),
                "connected": True,
                "expires_at": connection.expires_at,
            }
            for connection in connections
        ],
    }


# ---------------------------------------------------------
# Email & Password Manual Register / Login
# ---------------------------------------------------------

@router.post("/register")
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # -------------------------------------------------------
    # Smart guest-claim: only if current session user is a guest
    # (no email, no password hash), upgrade that user in-place
    # so no data is lost. Never claim another user's guest account.
    # -------------------------------------------------------
    session_user_id = request.session.get("user_id")
    guest_user = None
    if session_user_id:
        try:
            guest_user = (
                db.query(User)
                .filter(User.id == int(session_user_id), User.email.is_(None), User.password_hash.is_(None))
                .first()
            )
        except Exception:
            guest_user = None
    if guest_user:
        guest_user.email = email
        guest_user.password_hash = hash_password(payload.password)
        guest_user.name = payload.name.strip() if payload.name else None
        db.commit()
        db.refresh(guest_user)
        target_user = guest_user
        msg = "Account created and linked to your existing history."
    else:
        new_user = User(
            email=email,
            password_hash=hash_password(payload.password),
            name=payload.name.strip() if payload.name else None,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        target_user = new_user
        msg = "Account created successfully."

    request.session["user_id"] = target_user.id
    sync_token = generate_extension_token(target_user.id)

    return {
        "authenticated": True,
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "name": target_user.name,
        },
        "sync_token": sync_token,
        "message": msg,
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    request.session["user_id"] = user.id
    sync_token = generate_extension_token(user.id)

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
        },
        "sync_token": sync_token,
        "message": "Logged in successfully.",
    }


@router.get("/token")
def get_user_sync_token(
    user_id: int = Depends(get_current_user_id),
):
    """
    Return the personal data import and Chrome extension sync token for the logged-in user.
    """
    token = generate_extension_token(user_id)
    return {
        "user_id": user_id,
        "token": token,
        "usage": {
            "header": f"Authorization: Bearer {token}",
            "x_sync_token": f"X-Sync-Token: {token}",
        },
    }


# ---------------------------------------------------------
# Extension Seamless Connection & Revocation
# ---------------------------------------------------------

class ExtensionAuthorizeRequest(BaseModel):
    client_name: str | None = "Chrome Extension"
    permissions: list[str] | None = ["youtube", "spotify", "web"]


class ExtensionExchangeRequest(BaseModel):
    code: str
    client_name: str | None = None


# Ephemeral in-memory store for 60-second one-time authorization codes
_pending_extension_codes: dict[str, dict] = {}


@router.post("/extension/authorize")
def authorize_extension(
    payload: ExtensionAuthorizeRequest = ExtensionAuthorizeRequest(),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Generate a short-lived (60s) one-time authorization code for the Chrome extension.
    Invoked securely from the user's authenticated web session.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user or getattr(user, "is_active", True) is False:
        raise HTTPException(status_code=403, detail="User account is inactive or not found.")

    # Prune expired authorization codes
    now = datetime.now(timezone.utc)
    expired = [c for c, data in _pending_extension_codes.items() if data["expires_at"] < now]
    for c in expired:
        _pending_extension_codes.pop(c, None)

    code = secrets.token_urlsafe(32)
    client_name = (payload.client_name or "Chrome Extension").strip()
    perms = payload.permissions or ["youtube", "spotify", "web"]

    _pending_extension_codes[code] = {
        "user_id": user.id,
        "expires_at": now + timedelta(seconds=60),
        "client_name": client_name,
        "permissions": perms,
    }

    return {
        "code": code,
        "expires_in": 60,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
        },
    }


@router.post("/extension/exchange")
def exchange_extension_code(
    payload: ExtensionExchangeRequest,
    db: Session = Depends(get_db),
):
    """
    Exchange a short-lived one-time authorization code for a revokable extension sync token.
    Invoked directly by the Chrome extension service worker during connection setup.
    """
    code = payload.code.strip() if payload.code else ""
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required.")

    code_data = _pending_extension_codes.pop(code, None)
    if not code_data:
        raise HTTPException(status_code=400, detail="Invalid or expired authorization code.")

    if datetime.now(timezone.utc) > code_data["expires_at"]:
        raise HTTPException(status_code=400, detail="Authorization code has expired.")

    user_id = code_data["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user or getattr(user, "is_active", True) is False:
        raise HTTPException(status_code=403, detail="Account is deactivated or not found.")

    raw_token = f"drft_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    client_name = payload.client_name or code_data.get("client_name") or "Chrome Extension"
    perms = code_data.get("permissions") or ["youtube", "spotify", "web"]

    token_record = ExtensionToken(
        user_id=user.id,
        token_hash=token_hash,
        token_prefix=f"{raw_token[:9]}...",
        client_name=client_name,
        permissions=json.dumps(perms),
        is_revoked=False,
    )
    db.add(token_record)
    db.commit()
    db.refresh(token_record)

    return {
        "success": True,
        "token": raw_token,
        "token_id": token_record.id,
        "client_name": token_record.client_name,
        "permissions": perms,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
        },
    }


@router.get("/extension/tokens")
def list_extension_tokens(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    List all registered extension clients and their active/revoked token status for this user.
    """
    tokens = (
        db.query(ExtensionToken)
        .filter(ExtensionToken.user_id == user_id)
        .order_by(ExtensionToken.created_at.desc())
        .all()
    )
    return {
        "tokens": [
            {
                "id": t.id,
                "client_name": t.client_name,
                "token_prefix": t.token_prefix,
                "permissions": json.loads(t.permissions) if t.permissions and t.permissions.startswith("[") else t.permissions,
                "is_revoked": t.is_revoked,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
                "revoked_at": t.revoked_at.isoformat() if t.revoked_at else None,
            }
            for t in tokens
        ]
    }


@router.delete("/extension/tokens/{token_id}")
def revoke_extension_token(
    token_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Revoke a specific extension client token. Immediately blocks subsequent sync attempts with 401.
    """
    token_record = (
        db.query(ExtensionToken)
        .filter(
            ExtensionToken.id == token_id,
            ExtensionToken.user_id == user_id,
        )
        .first()
    )
    if not token_record:
        raise HTTPException(status_code=404, detail="Extension token not found.")

    token_record.is_revoked = True
    token_record.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()

    return {
        "success": True,
        "message": f"Extension '{token_record.client_name}' access revoked.",
        "token_id": token_id,
    }



# ---------------------------------------------------------
# Google / YouTube login
# ---------------------------------------------------------

@router.get("/google/login")
def google_login(request: Request):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured.",
        )

    state = secrets.token_urlsafe(32)
    request.session["google_oauth_state"] = state

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": (
            f"{settings.BACKEND_URL}/api/auth/google/callback"
        ),
        "response_type": "code",
        "scope": (
            "openid "
            "https://www.googleapis.com/auth/userinfo.profile "
            "https://www.googleapis.com/auth/youtube.readonly "
            "https://www.googleapis.com/auth/dataportability.myactivity.youtube"
        ),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    )

    return RedirectResponse(url)


@router.get("/google/data-portability/login")
def google_data_portability_login(request: Request):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured.")

    state = secrets.token_urlsafe(32)
    request.session["google_portability_state"] = state
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/api/auth/google/data-portability/callback",
        "response_type": "code",
        "scope": GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return RedirectResponse(
        "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    )


@router.get("/google/data-portability/callback")
async def google_data_portability_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    error = request.query_params.get("error")
    if error:
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/?google_error={error}"
        )

    state = request.query_params.get("state")
    expected_state = request.session.pop("google_portability_state", None)
    if not state or not expected_state or not hmac.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="Invalid Google authorization state.")

    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code missing.")

    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/data-portability/callback"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Google token exchange failed.")

    token_data = response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google did not return an access token.")

    user_id = request.session.get("user_id")
    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
        if user_id
        else None
    )
    if not user:
        user = User()
        db.add(user)
        db.commit()
        db.refresh(user)

    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=int(token_data["expires_in"]))

    connection = (
        db.query(Connection)
        .filter(
            Connection.user_id == user.id,
            Connection.provider == "google_data_portability",
        )
        .first()
    )
    if connection:
        connection.access_token = access_token
        if token_data.get("refresh_token"):
            connection.refresh_token = token_data["refresh_token"]
        connection.expires_at = expires_at
    else:
        connection = Connection(
            user_id=user.id,
            provider="google_data_portability",
            access_token=access_token,
            refresh_token=token_data.get("refresh_token"),
            expires_at=expires_at,
            scope=GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
        )
        db.add(connection)
    db.commit()

    try:
        export = await initiate_youtube_history_export(access_token)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text)

    archive_job_id = export.get("archiveJobId")
    if not archive_job_id:
        raise HTTPException(status_code=502, detail="Google did not return an archive job ID.")

    job = PortabilityExportJob(
        user_id=user.id,
        archive_job_id=archive_job_id,
        status="IN_PROGRESS",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    request.session["user_id"] = user.id
    return RedirectResponse(f"{settings.FRONTEND_URL}/?google_export_job={job.id}")


# ---------------------------------------------------------
# Google callback
# ---------------------------------------------------------

@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    error = request.query_params.get("error")
    if error:
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/?google_error={error}"
        )

    state = request.query_params.get("state")
    expected_state = request.session.pop("google_oauth_state", None)
    if not state or not expected_state or not hmac.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="Invalid Google OAuth state.")

    try:
        code = request.query_params.get("code")

        if not code:
            raise HTTPException(
                status_code=400,
                detail="Authorization code missing.",
            )

        token_url = "https://oauth2.googleapis.com/token"

        token_data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": (
                f"{settings.BACKEND_URL}/api/auth/google/callback"
            ),
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data=token_data,
            )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Google token exchange failed: {token_response.text}",
            )

        token_json = token_response.json()

        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token")
        expires_in = token_json.get("expires_in")

        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Google did not return an access token.",
            )

        # Get Google user information
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

        if user_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Could not retrieve Google user: {user_response.text}",
            )

        google_user = user_response.json()

        # For now, use Google's ID as the external identifier
        google_id = google_user.get("id")

        if not google_id:
            raise HTTPException(
                status_code=400,
                detail="Google user ID missing.",
            )

        # -----------------------------------------------------
        # Find/create application user (safe: never attach to first user)
        # -----------------------------------------------------

        user_id = request.session.get("user_id")
        user = None

        if user_id:
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .first()
            )
        if not user and google_user.get("email"):
            user = (
                db.query(User)
                .filter(User.email == google_user.get("email").strip().lower())
                .first()
            )
        if not user:
            user = User(
                email=google_user.get("email").strip().lower() if google_user.get("email") else None,
                name=google_user.get("name") or google_user.get("given_name"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # -----------------------------------------------------
        # Save/update Google connection
        # -----------------------------------------------------

        connection = (
            db.query(Connection)
            .filter(
                Connection.user_id == user.id,
                Connection.provider == "youtube",
            )
            .first()
        )

        expires_at = None

        if expires_in:
            expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
                seconds=int(expires_in)
            )

        if connection:
            connection.access_token = access_token

            if refresh_token:
                connection.refresh_token = refresh_token

            connection.expires_at = expires_at

        else:
            connection = Connection(
                user_id=user.id,
                provider="youtube",
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                scope=(
    "openid "
    "userinfo.profile "
    "youtube.readonly "
    "dataportability.myactivity.youtube"
),
            )

            db.add(connection)

        db.commit()

        request.session["user_id"] = user.id

        return RedirectResponse(
            f"{settings.FRONTEND_URL}/"
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Google callback failed: {type(e).__name__}: {str(e)}",
        )


# ---------------------------------------------------------
# Spotify login
# ---------------------------------------------------------

@router.get("/spotify/login")
def spotify_login(request: Request):
    if not settings.SPOTIFY_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="SPOTIFY_CLIENT_ID is not configured.",
        )

    client_id = settings.SPOTIFY_CLIENT_ID.strip()
    redirect_uri = settings.SPOTIFY_REDIRECT_URI.strip()

    state = secrets.token_urlsafe(32)
    request.session["spotify_oauth_state"] = state

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": (
            "user-read-private "
            "user-read-email "
            "user-read-recently-played"
        ),
        "state": state,
    }

    url = (
        "https://accounts.spotify.com/authorize?"
        + urlencode(params)
    )

    logger.info("[Spotify Login] Redirecting to Spotify authorize with redirect_uri: %s", redirect_uri)
    return RedirectResponse(url)


# ---------------------------------------------------------
# Spotify callback
# ---------------------------------------------------------

@router.get("/spotify/callback")
async def spotify_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    state = request.query_params.get("state")
    expected_state = request.session.pop("spotify_oauth_state", None)
    if not state or not expected_state or not hmac.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="Invalid Spotify OAuth state.")

    raw_code = request.query_params.get("code")

    if not raw_code:
        error_param = request.query_params.get("error")
        if error_param:
            logger.warning("[Spotify Callback Error] Spotify returned error query param: %s", error_param)
            raise HTTPException(status_code=400, detail=f"Spotify error: {error_param}")
        raise HTTPException(
            status_code=400,
            detail="Authorization code missing.",
        )

    code = raw_code.strip()
    logger.info("[Spotify Callback] Processing OAuth authorization callback.")

    if (
        not settings.SPOTIFY_CLIENT_ID
        or not settings.SPOTIFY_CLIENT_SECRET
    ):
        raise HTTPException(
            status_code=500,
            detail="Spotify credentials are not configured.",
        )

    # ---------------------------------------------------------
    # Concurrency Lock / Deduplication Guard
    # ---------------------------------------------------------
    # Avoid duplicate/parallel calls to Spotify token endpoint with the same single-use code.
    async with _spotify_global_lock:
        if code not in _spotify_code_locks:
            _spotify_code_locks[code] = asyncio.Lock()
        code_lock = _spotify_code_locks[code]

    async with code_lock:
        if code in _processed_spotify_codes:
            logger.info("[Spotify Callback] Code %s... already processed successfully! Returning cached redirect.", code[:15])
            return _processed_spotify_codes[code]

        token_url = "https://accounts.spotify.com/api/token"

        client_id = settings.SPOTIFY_CLIENT_ID.strip()
        client_secret = settings.SPOTIFY_CLIENT_SECRET.strip()
        redirect_uri = settings.SPOTIFY_REDIRECT_URI.strip()

        auth_str = f"{client_id}:{client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()

        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }

        logger.info("[Spotify Token Exchange] Calling token endpoint with redirect_uri=%s", redirect_uri)

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data=token_data,
                headers=headers,
            )

        logger.info("[Spotify Token Exchange] Response Status: %d", token_response.status_code)

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Spotify token exchange failed ({token_response.status_code}): {token_response.text}",
            )

        token_json = token_response.json()

        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token")
        expires_in = token_json.get("expires_in")

        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Spotify did not return an access token.",
            )

        # Get Spotify profile
        async with httpx.AsyncClient() as client:
            profile_response = await client.get(
                "https://api.spotify.com/v1/me",
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

        if profile_response.status_code != 200:
            if profile_response.status_code == 403 and "premium" in profile_response.text.lower():
                logger.info("[Spotify Profile] Spotify Premium required for direct sync. Redirecting to frontend with guidance.")
                return RedirectResponse(f"{settings.FRONTEND_URL}/?spotify_error=premium_required")
            raise HTTPException(
                status_code=400,
                detail=f"Could not retrieve Spotify profile: {profile_response.text}",
            )

        spotify_user = profile_response.json()

        user_id = request.session.get("user_id")
        user = None

        if user_id:
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .first()
            )
        if not user and spotify_user.get("email"):
            user = (
                db.query(User)
                .filter(User.email == spotify_user.get("email").strip().lower())
                .first()
            )
        if not user:
            user = User(
                email=spotify_user.get("email").strip().lower() if spotify_user.get("email") else None,
                name=spotify_user.get("display_name"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        expires_at = None

        if expires_in:
            expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
                seconds=int(expires_in)
            )

        connection = (
            db.query(Connection)
            .filter(
                Connection.user_id == user.id,
                Connection.provider == "spotify",
            )
            .first()
        )

        if connection:
            connection.access_token = access_token

            if refresh_token:
                connection.refresh_token = refresh_token

            connection.expires_at = expires_at

        else:
            connection = Connection(
                user_id=user.id,
                provider="spotify",
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                scope=(
                    "user-read-private "
                    "user-read-email "
                    "user-read-recently-played"
                ),
            )

            db.add(connection)

        db.commit()

        # Sync user Spotify history tracks
        try:
            await sync_spotify_user_history(db=db, user_id=user.id, access_token=access_token)
        except Exception as exc:
            logger.warning("[Spotify History Sync Warning]: %s", exc)

        request.session["user_id"] = user.id

        if "localhost" in settings.BACKEND_URL and request.url.hostname == "127.0.0.1":
            sig = hmac.new(
                settings.SESSION_SECRET.encode(),
                str(user.id).encode(),
                hashlib.sha256,
            ).hexdigest()
            redirect_result = RedirectResponse(
                f"{settings.BACKEND_URL}/api/auth/session-sync?user_id={user.id}&sig={sig}"
            )
        else:
            redirect_result = RedirectResponse(
                f"{settings.FRONTEND_URL}/"
            )

        _processed_spotify_codes[code] = redirect_result
        return redirect_result


# ---------------------------------------------------------
# Session Sync (bridges 127.0.0.1 and localhost cookie domains)
# ---------------------------------------------------------

@router.get("/session-sync")
def session_sync(request: Request, user_id: int, sig: str):
    expected_sig = hmac.new(
        settings.SESSION_SECRET.encode(),
        str(user_id).encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        raise HTTPException(status_code=400, detail="Invalid session sync signature.")

    request.session["user_id"] = user_id
    return RedirectResponse(f"{settings.FRONTEND_URL}/")


# ---------------------------------------------------------
# Logout / Sign out
# ---------------------------------------------------------

@router.api_route("/logout", methods=["GET", "POST"])
@router.api_route("/signout", methods=["GET", "POST"])
def signout(request: Request):
    request.session.clear()

    # If accessed directly in a browser (GET request), redirect to frontend
    if request.method == "GET" and "text/html" in request.headers.get("accept", ""):
        return RedirectResponse(f"{settings.FRONTEND_URL}/")

    return {
        "success": True,
        "message": "Signed out successfully.",
    }


# ---------------------------------------------------------
# Auto-refresh all OAuth connections
# ---------------------------------------------------------

@router.post("/refresh-all")
async def refresh_all_tokens(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Check and refresh expired or near-expiry tokens for all providers for the current user.
    """
    connections = db.query(Connection).filter(Connection.user_id == user_id).all()
    results = {}

    for conn in connections:
        needs_refresh = (
            conn.expires_at is not None
            and conn.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10)
            and conn.refresh_token is not None
        )

        if not needs_refresh:
            results[conn.provider] = "valid"
            continue

        try:
            if conn.provider == "spotify":
                tokens = await refresh_spotify_token(conn.refresh_token)
                conn.access_token = tokens["access_token"]
                conn.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=tokens.get("expires_in", 3600))
                if tokens.get("refresh_token"):
                    conn.refresh_token = tokens["refresh_token"]
                results[conn.provider] = "refreshed"
            elif conn.provider in ("youtube", "google"):
                tokens = await refresh_google_token(conn.refresh_token)
                conn.access_token = tokens["access_token"]
                conn.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=tokens.get("expires_in", 3600))
                results[conn.provider] = "refreshed"
            else:
                results[conn.provider] = "skipped"
        except Exception as exc:
            results[conn.provider] = f"error: {str(exc)}"

    db.commit()
    return {"status": "ok", "providers": results}


# ---------------------------------------------------------
# Privacy & Data Lifecycle Controls (Step 6)
# ---------------------------------------------------------

@router.delete("/connections/{provider}")
def disconnect_provider(
    provider: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Disconnect a linked provider account and revoke/delete stored credentials.
    """
    from app.services.analysis_cache_service import delete_cached_analysis

    provider_clean = provider.strip().lower()
    # Normalize google / youtube naming
    providers_to_match = [provider_clean]
    if provider_clean in ("youtube", "google"):
        providers_to_match.extend(["youtube", "google_data_portability"])

    connections = (
        db.query(Connection)
        .filter(
            Connection.user_id == user_id,
            Connection.provider.in_(providers_to_match),
        )
        .all()
    )

    if not connections:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{provider}' is not connected.",
        )

    for conn in connections:
        db.delete(conn)

    db.commit()

    # Clear relevant analysis caches
    delete_cached_analysis(user_id=user_id, source=provider_clean)
    delete_cached_analysis(user_id=user_id, source=None)

    return {
        "success": True,
        "provider": provider_clean,
        "message": f"Successfully disconnected {provider_clean}.",
    }


@router.get("/export")
def export_user_data(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Export all stored personal data for the authenticated user.
    Excludes passwords, session secrets, encryption keys, and raw tokens.
    """
    from app.database.models import HistoryEvent, AnalysisResult, PortabilityExportJob

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    connections = db.query(Connection).filter(Connection.user_id == user_id).all()
    events = (
        db.query(HistoryEvent)
        .filter(HistoryEvent.user_id == user_id)
        .order_by(HistoryEvent.timestamp.asc())
        .all()
    )
    analyses = db.query(AnalysisResult).filter(AnalysisResult.user_id == user_id).all()
    export_jobs = db.query(PortabilityExportJob).filter(PortabilityExportJob.user_id == user_id).all()

    import json
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "connections": [
            {
                "provider": conn.provider,
                "scope": conn.scope,
                "created_at": conn.created_at.isoformat() if conn.created_at else None,
                "expires_at": conn.expires_at.isoformat() if conn.expires_at else None,
            }
            for conn in connections
        ],
        "history_events_count": len(events),
        "history_events": [
            {
                "id": ev.id,
                "timestamp": ev.timestamp.isoformat() if ev.timestamp else None,
                "source": ev.source,
                "title": ev.title,
                "artist": ev.artist,
                "url": ev.url,
                "duration": ev.duration,
                "metadata": json.loads(ev.metadata_json) if ev.metadata_json else {},
            }
            for ev in events
        ],
        "analysis_records": [
            {
                "source": ar.source,
                "event_count": ar.event_count,
                "status": ar.status,
                "analysis": json.loads(ar.analysis_json) if ar.analysis_json else {},
                "created_at": ar.created_at.isoformat() if ar.created_at else None,
                "updated_at": ar.updated_at.isoformat() if ar.updated_at else None,
            }
            for ar in analyses
        ],
        "export_jobs": [
            {
                "archive_job_id": job.archive_job_id,
                "status": job.status,
                "imported": job.imported,
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
            for job in export_jobs
        ],
    }


@router.delete("/account")
def delete_user_account(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Permanently delete the authenticated user's account and all associated personal data.
    Cascades to connections, history events, analysis results, and export jobs.
    Invalidates all caches and ends the user's session.
    """
    from app.services.analysis_cache_service import delete_cached_analysis
    from app.database.models import HistoryEvent, AnalysisResult, PortabilityExportJob

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Explicit deletion in case DB engine does not enforce cascade (e.g. SQLite without PRAGMA foreign_keys=ON)
    db.query(HistoryEvent).filter(HistoryEvent.user_id == user_id).delete(synchronize_session=False)
    db.query(Connection).filter(Connection.user_id == user_id).delete(synchronize_session=False)
    db.query(AnalysisResult).filter(AnalysisResult.user_id == user_id).delete(synchronize_session=False)
    db.query(PortabilityExportJob).filter(PortabilityExportJob.user_id == user_id).delete(synchronize_session=False)
    db.query(ExtensionToken).filter(ExtensionToken.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()

    # Clear cache and session
    delete_cached_analysis(user_id=user_id, source=None)
    request.session.clear()

    return {
        "success": True,
        "message": "Account and all associated personal data permanently deleted.",
    }

