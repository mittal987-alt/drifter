from typing import Any
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import (
    generate_extension_token,
    get_current_user_id,
)
from app.database.database import get_db
from app.api.history import save_history_events
from app.services.analysis_runner import run_user_analysis

router = APIRouter(tags=["Extension Sync"])


class YouTubeExtensionEvent(BaseModel):
    videoId: str | None = None
    title: str
    channel: str | None = None
    artist: str | None = None
    url: str | None = None
    source: str | None = "youtube"
    watchedSeconds: float | int | None = None
    durationSeconds: float | int | None = None
    watchedAt: str | datetime | None = None


class ExtensionSyncPayload(BaseModel):
    events: list[YouTubeExtensionEvent] = Field(default_factory=list)


@router.get("/api/auth/extension-token")
def get_extension_token(
    user_id: int = Depends(get_current_user_id),
):
    """Generate or retrieve a sync token for the Chrome Extension."""
    token = generate_extension_token(user_id)
    return {
        "user_id": user_id,
        "token": token,
    }


@router.post("/api/youtube-history")
@router.post("/api/history/youtube-extension")
def sync_youtube_extension_history(
    payload: ExtensionSyncPayload,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Accept real-time watched video events from the YouTube History Sync Chrome Extension.
    Deduplicates events on (userId, videoId, date) and triggers automated analysis.
    """
    if not payload.events:
        return {
            "success": True,
            "imported": 0,
            "duplicates": 0,
            "message": "No events provided",
        }

    formatted_events = []
    for ev in payload.events:
        channel_name = ev.channel or ev.artist
        event_url = ev.url or (f"https://www.youtube.com/watch?v={ev.videoId}" if ev.videoId else None)
        ev_source = (ev.source or "youtube").lower()

        ts = ev.watchedAt or datetime.utcnow()

        metadata = {
            "videoId": ev.videoId,
            "channel": channel_name,
            "watchedSeconds": ev.watchedSeconds,
            "durationSeconds": ev.durationSeconds,
            "sync_source": "chrome_extension",
        }

        formatted_events.append(
            {
                "title": ev.title,
                "artist": channel_name,
                "url": event_url,
                "timestamp": ts,
                "source": ev_source,
                "metadata": metadata,
            }
        )

    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=formatted_events,
        source="youtube",
    )

    if imported > 0:
        background_tasks.add_task(
            run_user_analysis,
            user_id,
            None,
        )

    return {
        "success": True,
        "imported": imported,
        "duplicates": duplicates,
        "total": len(payload.events),
    }
