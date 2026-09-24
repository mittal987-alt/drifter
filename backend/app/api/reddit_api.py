"""
Reddit OAuth routes.

Scopes: identity history save

Flow:
  1. Frontend opens /api/reddit/login  → redirect to Reddit OAuth
  2. Reddit redirects to /api/reddit/callback with ?code=...
  3. Backend exchanges code → access_token → stores in Connection table
  4. Auto-kicks off sync in background
  5. Redirect back to frontend /
"""

import base64
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id
from app.config import settings
from app.database.database import get_db, SessionLocal
from app.database.models import Connection
from app.services.reddit_service import sync_reddit_user_history
from app.services.analysis_runner import run_user_analysis

router = APIRouter()


REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize"
REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_SCOPES = "identity history save"
USER_AGENT = "Drifter/1.0"


# ============================================================
# Helper — get valid token (with refresh if expired)
# ============================================================

async def _ensure_valid_token(conn: Connection, db: Session) -> str:
    if (
        conn.expires_at
        and conn.expires_at <= datetime.utcnow() + timedelta(seconds=60)
        and conn.refresh_token
    ):
        tokens = await _refresh_reddit_token(conn.refresh_token)
        conn.access_token = tokens["access_token"]
        conn.expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        db.commit()
    return conn.access_token


async def _refresh_reddit_token(refresh_token: str) -> dict:
    creds = base64.b64encode(
        f"{settings.REDDIT_CLIENT_ID}:{settings.REDDIT_CLIENT_SECRET}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            REDDIT_TOKEN_URL,
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            headers={"Authorization": f"Basic {creds}", "User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        return resp.json()


def _get_reddit_connection(user_id: int, db: Session) -> Connection:
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "reddit")
        .first()
    )
    if not conn or not conn.access_token:
        raise HTTPException(status_code=401, detail="Reddit is not connected.")
    return conn


# ============================================================
# LOGIN
# ============================================================

@router.get("/login")
def reddit_login(request: Request):
    if not settings.REDDIT_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Reddit OAuth is not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to your .env file.",
        )

    state = secrets.token_urlsafe(16)
    request.session["reddit_oauth_state"] = state

    params = {
        "client_id": settings.REDDIT_CLIENT_ID,
        "response_type": "code",
        "state": state,
        "redirect_uri": settings.REDDIT_REDIRECT_URI,
        "duration": "permanent",
        "scope": REDDIT_SCOPES,
    }
    return RedirectResponse(f"{REDDIT_AUTH_URL}?{urlencode(params)}")


# ============================================================
# CALLBACK
# ============================================================

@router.get("/callback")
async def reddit_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    frontend = settings.FRONTEND_URL

    if error:
        return RedirectResponse(f"{frontend}/?reddit_error={error}")

    if not code:
        return RedirectResponse(f"{frontend}/?reddit_error=no_code")

    expected_state = request.session.pop("reddit_oauth_state", None)
    if expected_state and state != expected_state:
        return RedirectResponse(f"{frontend}/?reddit_error=state_mismatch")

    user_id = request.session.get("user_id")
    if not user_id:
        return RedirectResponse(f"{frontend}/?reddit_error=not_logged_in")

    # Exchange code for tokens
    creds = base64.b64encode(
        f"{settings.REDDIT_CLIENT_ID}:{settings.REDDIT_CLIENT_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            REDDIT_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.REDDIT_REDIRECT_URI,
            },
            headers={"Authorization": f"Basic {creds}", "User-Agent": USER_AGENT},
        )

    token_data = resp.json()
    access_token = token_data.get("access_token")

    if not access_token:
        err = token_data.get("error") or "token_exchange_failed"
        return RedirectResponse(f"{frontend}/?reddit_error={err}")

    expires_in = int(token_data.get("expires_in") or 3600)
    refresh_token = token_data.get("refresh_token")

    # Upsert connection
    db = SessionLocal()
    try:
        conn = (
            db.query(Connection)
            .filter(Connection.user_id == user_id, Connection.provider == "reddit")
            .first()
        )
        if conn:
            conn.access_token = access_token
            conn.refresh_token = refresh_token or conn.refresh_token
            conn.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            conn.scope = token_data.get("scope", REDDIT_SCOPES)
            conn.created_at = datetime.utcnow()
        else:
            conn = Connection(
                user_id=user_id,
                provider="reddit",
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
                scope=token_data.get("scope", REDDIT_SCOPES),
                created_at=datetime.utcnow(),
            )
            db.add(conn)
        db.commit()
    finally:
        db.close()

    # Background sync
    import asyncio
    asyncio.create_task(_background_sync(user_id, access_token))

    return RedirectResponse(f"{frontend}/?reddit_connected=1")


async def _background_sync(user_id: int, access_token: str):
    db = SessionLocal()
    try:
        await sync_reddit_user_history(db=db, user_id=user_id, access_token=access_token)
        run_user_analysis(user_id=user_id, source="reddit")
        run_user_analysis(user_id=user_id, source=None)
    except Exception as exc:
        print(f"[REDDIT BACKGROUND SYNC ERROR] user={user_id}: {exc}", flush=True)
    finally:
        db.close()


# ============================================================
# STATUS
# ============================================================

@router.get("/status")
def reddit_status(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "reddit")
        .first()
    )
    return {
        "connected": bool(conn and conn.access_token),
        "connected_at": conn.created_at.isoformat() if conn and conn.created_at else None,
    }


# ============================================================
# SYNC (manual re-sync)
# ============================================================

@router.post("/sync")
async def reddit_sync(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = _get_reddit_connection(user_id, db)
    token = await _ensure_valid_token(conn, db)

    db2 = SessionLocal()
    try:
        result = await sync_reddit_user_history(db=db2, user_id=user_id, access_token=token)
        run_user_analysis(user_id=user_id, source="reddit")
        run_user_analysis(user_id=user_id, source=None)
    finally:
        db2.close()

    return {
        "status": "success",
        "imported": result["imported"],
        "duplicates": result["duplicates"],
        "total": result["total"],
        "message": f"Synced {result['imported']} Reddit posts ({result['duplicates']} duplicates skipped).",
    }


# ============================================================
# DISCONNECT
# ============================================================

@router.delete("/disconnect")
def reddit_disconnect(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "reddit")
        .first()
    )
    if conn:
        db.delete(conn)
        db.commit()
    return {"success": True}
