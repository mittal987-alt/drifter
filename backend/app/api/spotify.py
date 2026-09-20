from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from app.api.dependencies import get_current_user_id
from app.database.database import SessionLocal
from app.database.models import Connection

from app.services.spotify_service import (
    spotify_api_request,
    refresh_spotify_token,
    sync_spotify_user_history,
)
from app.services.analysis_runner import run_user_analysis


router = APIRouter()


async def get_spotify_access_token(
    user_id: int = Depends(get_current_user_id),
) -> str:
    """
    Return a valid Spotify access token for the currently-logged-in user.
    Refreshes automatically if the token is expired or about to expire.
    """
    db = SessionLocal()

    try:

        connection = (
            db.query(Connection)
            .filter(
                Connection.user_id == user_id,
                Connection.provider == "spotify",
            )
            .first()
        )

        if not connection:
            raise HTTPException(
                status_code=401,
                detail="Spotify is not connected.",
            )

        # Refresh if token is expired or about
        # to expire within 60 seconds.

        if (
            connection.expires_at
            and connection.expires_at
            <= datetime.utcnow() + timedelta(seconds=60)
        ):

            if not connection.refresh_token:
                raise HTTPException(
                    status_code=401,
                    detail="Spotify authorization expired. Reconnect Spotify.",
                )

            tokens = await refresh_spotify_token(
                connection.refresh_token
            )

            connection.access_token = (
                tokens["access_token"]
            )

            connection.expires_at = (
                datetime.utcnow()
                + timedelta(
                    seconds=tokens.get(
                        "expires_in",
                        3600
                    )
                )
            )

            # Spotify may not return a new refresh
            # token every time, so preserve the old one.

            if tokens.get("refresh_token"):
                connection.refresh_token = (
                    tokens["refresh_token"]
                )

            if tokens.get("scope"):
                connection.scope = tokens["scope"]

            db.commit()

        return connection.access_token

    finally:

        db.close()


@router.get("/profile")
async def spotify_profile(
    access_token: str = Depends(get_spotify_access_token),
):

    return await spotify_api_request(
        access_token,
        "/me",
    )


@router.get("/recent")
async def spotify_recent(
    limit: int = 20,
    access_token: str = Depends(get_spotify_access_token),
):

    if limit < 1 or limit > 50:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 50.",
        )

    return await spotify_api_request(
        access_token,
        "/me/player/recently-played",
        {
            "limit": limit
        },
    )


@router.get("/top")
async def spotify_top(
    item_type: str = "tracks",
    time_range: str = "medium_term",
    limit: int = 20,
    access_token: str = Depends(get_spotify_access_token),
):

    if item_type not in [
        "tracks",
        "artists",
    ]:
        raise HTTPException(
            status_code=400,
            detail="item_type must be tracks or artists.",
        )

    if time_range not in [
        "short_term",
        "medium_term",
        "long_term",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid time_range.",
        )

    if limit < 1 or limit > 50:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 50.",
        )

    return await spotify_api_request(
        access_token,
        f"/me/top/{item_type}",
        {
            "time_range": time_range,
            "limit": limit,
        },
    )


# ============================================================
# SYNC SPOTIFY TRACKS TO HISTORY
# ============================================================

@router.post("/sync")
async def sync_spotify(
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    access_token: str = Depends(get_spotify_access_token),
):
    """
    Sync user's Spotify listening history (recent and top tracks) into history_events
    and kick off asynchronous topic and drift analysis.
    """
    db = SessionLocal()
    try:
        result = await sync_spotify_user_history(
            db=db,
            user_id=user_id,
            access_token=access_token,
        )

        # Trigger background analysis runner for Spotify source and unified view
        background_tasks.add_task(run_user_analysis, user_id=user_id, source="spotify")
        background_tasks.add_task(run_user_analysis, user_id=user_id, source=None)

        return {
            "status": "success",
            "message": f"Successfully synced {result['imported']} tracks ({result['duplicates']} duplicates skipped).",
            "imported": result["imported"],
            "duplicates": result["duplicates"],
            "total": result.get("total", 0),
        }
    finally:
        db.close()