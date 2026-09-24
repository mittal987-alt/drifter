"""
GitHub OAuth routes.

Flow:
  1. Frontend opens /api/github/login  → redirect to GitHub OAuth
  2. GitHub redirects to /api/github/callback with ?code=...
  3. Backend exchanges code → access_token → stores in Connection table
  4. Auto-kicks off sync in background
  5. Redirect back to frontend /
"""

import secrets
from datetime import datetime
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id
from app.config import settings
from app.database.database import get_db, SessionLocal
from app.database.models import Connection
from app.services.github_service import sync_github_user_history
from app.services.analysis_runner import run_user_analysis

router = APIRouter()


GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_SCOPES = "read:user public_repo"


# ============================================================
# Helper — get valid token
# ============================================================

def _get_github_connection(user_id: int, db: Session) -> Connection:
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "github")
        .first()
    )
    if not conn or not conn.access_token:
        raise HTTPException(status_code=401, detail="GitHub is not connected.")
    return conn


# ============================================================
# LOGIN — redirect to GitHub OAuth
# ============================================================

@router.get("/login")
def github_login(request: Request):
    """Redirect the user to GitHub's OAuth authorization page."""
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to your .env file.",
        )

    state = secrets.token_urlsafe(16)
    request.session["github_oauth_state"] = state

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": GITHUB_SCOPES,
        "state": state,
    }
    return RedirectResponse(f"{GITHUB_AUTH_URL}?{urlencode(params)}")


# ============================================================
# CALLBACK — exchange code for token
# ============================================================

@router.get("/callback")
async def github_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    frontend = settings.FRONTEND_URL

    if error:
        return RedirectResponse(f"{frontend}/?github_error={error}")

    if not code:
        return RedirectResponse(f"{frontend}/?github_error=no_code")

    expected_state = request.session.pop("github_oauth_state", None)
    if expected_state and state != expected_state:
        return RedirectResponse(f"{frontend}/?github_error=state_mismatch")

    user_id = request.session.get("user_id")
    if not user_id:
        return RedirectResponse(f"{frontend}/?github_error=not_logged_in")

    # Exchange code for token
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

    token_data = resp.json()
    access_token = token_data.get("access_token")

    if not access_token:
        err = token_data.get("error_description") or token_data.get("error") or "token_exchange_failed"
        return RedirectResponse(f"{frontend}/?github_error={err}")

    # Upsert connection
    db = SessionLocal()
    try:
        conn = (
            db.query(Connection)
            .filter(Connection.user_id == user_id, Connection.provider == "github")
            .first()
        )
        if conn:
            conn.access_token = access_token
            conn.scope = token_data.get("scope", GITHUB_SCOPES)
            conn.created_at = datetime.utcnow()
        else:
            conn = Connection(
                user_id=user_id,
                provider="github",
                access_token=access_token,
                refresh_token=None,
                expires_at=None,
                scope=token_data.get("scope", GITHUB_SCOPES),
                created_at=datetime.utcnow(),
            )
            db.add(conn)
        db.commit()
    finally:
        db.close()

    # Kick off background sync
    background_tasks.add_task(_background_sync, user_id, access_token)

    return RedirectResponse(f"{frontend}/?github_connected=1")


async def _background_sync(user_id: int, access_token: str):
    db = SessionLocal()
    try:
        await sync_github_user_history(db=db, user_id=user_id, access_token=access_token)
        run_user_analysis(user_id=user_id, source="github")
        run_user_analysis(user_id=user_id, source=None)
    except Exception as exc:
        print(f"[GITHUB BACKGROUND SYNC ERROR] user={user_id}: {exc}", flush=True)
    finally:
        db.close()


# ============================================================
# STATUS
# ============================================================

@router.get("/status")
def github_status(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "github")
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
async def github_sync(
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = _get_github_connection(user_id, db)
    db_for_bg = SessionLocal()

    async def _run():
        try:
            result = await sync_github_user_history(
                db=db_for_bg, user_id=user_id, access_token=conn.access_token
            )
            run_user_analysis(user_id=user_id, source="github")
            run_user_analysis(user_id=user_id, source=None)
            return result
        finally:
            db_for_bg.close()

    result = await _run()

    return {
        "status": "success",
        "imported": result["imported"],
        "duplicates": result["duplicates"],
        "total": result["total"],
        "message": f"Synced {result['imported']} GitHub events ({result['duplicates']} duplicates skipped).",
    }


# ============================================================
# DISCONNECT
# ============================================================

@router.delete("/disconnect")
def github_disconnect(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connection)
        .filter(Connection.user_id == user_id, Connection.provider == "github")
        .first()
    )
    if conn:
        db.delete(conn)
        db.commit()
    return {"success": True}
