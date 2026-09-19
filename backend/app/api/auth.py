import asyncio
import base64
import secrets
from datetime import datetime, timedelta
import hashlib
import hmac
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database.database import get_db
from app.database.models import Connection, User
from app.database.models import PortabilityExportJob
from app.services.google_service import (
    GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
    initiate_youtube_history_export,
)
from app.services.spotify_service import sync_spotify_user_history

router = APIRouter(prefix="/api/auth", tags=["auth"])

_processed_spotify_codes: dict[str, RedirectResponse] = {}
_spotify_code_locks: dict[str, asyncio.Lock] = {}
_spotify_global_lock = asyncio.Lock()


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

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
        },
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
# Google / YouTube login
# ---------------------------------------------------------

@router.get("/google/login")
def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured.",
        )

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
        expires_at = datetime.utcnow() + timedelta(seconds=int(token_data["expires_in"]))

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
        # Find/create application user
        # -----------------------------------------------------

        user_id = request.session.get("user_id")
        user = None

        if user_id:
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .first()
            )
        else:
            user = db.query(User).first()

        if not user:
            user = User()
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
            expires_at = datetime.utcnow() + timedelta(
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
def spotify_login():
    if not settings.SPOTIFY_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="SPOTIFY_CLIENT_ID is not configured.",
        )

    client_id = settings.SPOTIFY_CLIENT_ID.strip()
    redirect_uri = settings.SPOTIFY_REDIRECT_URI.strip()

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": (
            "user-read-private "
            "user-read-email "
            "user-read-recently-played"
        ),
    }

    url = (
        "https://accounts.spotify.com/authorize?"
        + urlencode(params)
    )

    print(f"\n[Spotify Login] Redirecting to Spotify authorize with redirect_uri: {redirect_uri}", flush=True)
    return RedirectResponse(url)


# ---------------------------------------------------------
# Spotify callback
# ---------------------------------------------------------

@router.get("/spotify/callback")
async def spotify_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    raw_code = request.query_params.get("code")

    if not raw_code:
        error_param = request.query_params.get("error")
        if error_param:
            print(f"[Spotify Callback Error] Spotify returned error query param: {error_param}", flush=True)
            raise HTTPException(status_code=400, detail=f"Spotify error: {error_param}")
        raise HTTPException(
            status_code=400,
            detail="Authorization code missing.",
        )

    code = raw_code.strip()
    print(f"\n[Spotify Callback] Hit from client={request.client} for code={code[:15]}...", flush=True)

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
            print(f"[Spotify Callback] Code {code[:15]}... already processed successfully! Returning cached redirect.", flush=True)
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

        print(f"[Spotify Token Exchange] Calling {token_url} with redirect_uri={redirect_uri}, client_id={client_id[:6]}...", flush=True)

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data=token_data,
                headers=headers,
            )

        print(f"[Spotify Token Exchange] Response Status: {token_response.status_code}, Body: {token_response.text}", flush=True)

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
                print("[Spotify Profile] Spotify Premium required for direct sync. Redirecting to frontend with guidance.", flush=True)
                return RedirectResponse(f"{settings.FRONTEND_URL}/?spotify_error=premium_required")
            raise HTTPException(
                status_code=400,
                detail=f"Could not retrieve Spotify profile: {profile_response.text}",
            )

        spotify_user = profile_response.json()

        user_id = request.session.get("user_id")

        if user_id:
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .first()
            )
        else:
            user = db.query(User).first()

        if not user:
            user = User()
            db.add(user)
            db.commit()
            db.refresh(user)

        expires_at = None

        if expires_in:
            expires_at = datetime.utcnow() + timedelta(
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
            print(f"[Spotify History Sync Warning]: {exc}", flush=True)

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