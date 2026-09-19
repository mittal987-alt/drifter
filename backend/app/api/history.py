import json
from datetime import datetime

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id
from app.database.database import get_db
from app.database.models import HistoryEvent

# pyrefly: ignore [missing-import]
from app.services.youtube_history_service import (
    create_event_hash,
    load_youtube_history_file,
    parse_youtube_history,
)

from app.services.history_service import parse_history_file
from app.services.analysis_cache_service import delete_cached_analysis
from app.services.analysis_runner import run_user_analysis


# =============================================================
# SAVE HISTORY EVENTS
# =============================================================

def save_history_events(
    db: Session,
    user_id: int,
    events: list[dict],
    source: str = "youtube",
):
    imported = 0
    duplicates = 0

    # Fetch existing event hashes to avoid UNIQUE constraint collisions
    existing_hashes = {
        row[0]
        for row in db.query(HistoryEvent.event_hash).all()
        if row[0]
    }

    seen_in_batch = set()

    for event in events:
        event_hash = create_event_hash(event)

        if event_hash in existing_hashes or event_hash in seen_in_batch:
            duplicates += 1
            continue

        seen_in_batch.add(event_hash)
        ev_source = event.get("source") or source

        ts = event["timestamp"]
        if not isinstance(ts, datetime):
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    ts = datetime.utcnow()
            else:
                ts = datetime.utcnow()

        db.add(
            HistoryEvent(
                user_id=user_id,
                timestamp=ts,
                source=ev_source,
                title=event["title"],
                artist=event.get("artist"),
                url=event.get("url"),
                duration=event.get("duration"),
                event_hash=event_hash,
                metadata_json=json.dumps(
                    event.get("metadata", {}),
                    default=str,
                ),
            )
        )

        imported += 1

    db.commit()

    # ---------------------------------------------------------
    # Clear old analysis cache
    # ---------------------------------------------------------

    if imported > 0:
        delete_cached_analysis(
            user_id=user_id,
            source=source,
        )

        delete_cached_analysis(
            user_id=user_id,
            source=None,
        )

    return imported, duplicates


save_youtube_events = save_history_events


# =============================================================
# ROUTER
# =============================================================

router = APIRouter()


# =============================================================
# IMPORT HISTORY
# =============================================================

@router.post("/import")
async def import_history(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source: str | None = Form(None),
    source_query: str | None = Query(None, alias="source"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Import history from an uploaded file.

    Currently supported:
    - YouTube Google Takeout JSON
    - YouTube Google Takeout ZIP
    """

    source = (source or source_query or "youtube").lower().strip()

    # ---------------------------------------------------------
    # Validate source
    # ---------------------------------------------------------

    if source not in ("youtube", "spotify"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported source '{source}'. "
                "Only YouTube and Spotify history imports are supported."
            ),
        )

    # ---------------------------------------------------------
    # Validate file
    # ---------------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    allowed_extensions = (
        ".json",
        ".zip",
        ".html",
        ".htm",
        ".csv",
    )

    if not file.filename.lower().endswith(
        allowed_extensions
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Upload a .json, .csv, .html, or .zip history export file."
            ),
        )

    # ---------------------------------------------------------
    # Read uploaded file
    # ---------------------------------------------------------

    try:
        raw_bytes = await file.read()

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read uploaded file.",
        )

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # ---------------------------------------------------------
    # Parse history according to source
    # ---------------------------------------------------------

    if source == "youtube":
        try:
            data = load_youtube_history_file(
                filename=file.filename,
                content=raw_bytes,
            )
        except ValueError as exc:
            print(f"[HISTORY IMPORT ERROR] File '{file.filename}': {exc}", flush=True)
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

        if not isinstance(data, list):
            raise HTTPException(
                status_code=400,
                detail="YouTube history must contain a list of records.",
            )

        total_records = len(data)
        events = parse_youtube_history(data)
    else:
        # Spotify JSON or CSV export
        try:
            events = parse_history_file(
                content=raw_bytes,
                filename=file.filename,
                source="spotify",
            )
            total_records = len(events)
        except Exception as exc:
            print(f"[SPOTIFY IMPORT ERROR] File '{file.filename}': {exc}", flush=True)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse Spotify history: {exc}",
            )

    valid_records = len(events)
    skipped = total_records - valid_records

    # ---------------------------------------------------------
    # Insert normalized events
    # ---------------------------------------------------------

    try:
        imported, duplicates = save_history_events(
            db=db,
            user_id=user_id,
            events=events,
            source=source,
        )

    except Exception as exc:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"[SAVE HISTORY ERROR]: {exc}", flush=True)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save history to database: {exc}",
        )

    # =========================================================
    # AUTOMATIC ANALYSIS
    # =========================================================

    analysis_started = False

    if imported > 0:
        background_tasks.add_task(
            run_user_analysis,
            user_id,
            source,
        )
        background_tasks.add_task(
            run_user_analysis,
            user_id,
            None,
        )

        analysis_started = True

    # ---------------------------------------------------------
    # Return import summary
    # ---------------------------------------------------------

    return {
        "success": True,
        "source": source,
        "filename": file.filename,
        "total_records": total_records,
        "valid_records": valid_records,
        "imported": imported,
        "duplicates": duplicates,
        "skipped": skipped,
        "analysis_started": analysis_started,
    }


# =============================================================
# GET HISTORY EVENTS
# =============================================================

@router.get("/events")
def get_history_events(
    source: str | None = None,
    limit: int = 100,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get the current user's imported history events.
    """

    # ---------------------------------------------------------
    # Validate limit
    # ---------------------------------------------------------

    if limit < 1 or limit > 10000:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 10000.",
        )

    # ---------------------------------------------------------
    # Base query
    # ---------------------------------------------------------

    query = (
        db.query(HistoryEvent)
        .filter(
            HistoryEvent.user_id == user_id
        )
    )

    # ---------------------------------------------------------
    # Optional source filter
    # ---------------------------------------------------------

    if source:
        source = source.lower().strip()

        if source not in {
            "youtube",
            "spotify",
        }:
            raise HTTPException(
                status_code=400,
                detail="Unsupported source.",
            )

        query = query.filter(
            HistoryEvent.source == source
        )

    # ---------------------------------------------------------
    # Fetch latest events
    # ---------------------------------------------------------

    events = (
        query
        .order_by(
            HistoryEvent.timestamp.desc()
        )
        .limit(limit)
        .all()
    )

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return {
        "count": len(events),
        "events": [
            {
                "id": event.id,
                "timestamp": event.timestamp,
                "source": event.source,
                "title": event.title,
                "artist": event.artist,
                "url": event.url,
                "duration": event.duration,
                "metadata": (
                    json.loads(event.metadata_json)
                    if event.metadata_json
                    else {}
                ),
            }
            for event in events
        ],
    }


# =============================================================
# CLEAR HISTORY
# =============================================================

@router.delete("/clear")
def clear_history(
    source: str | None = None,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Delete the current user's imported history.

    If source is provided, only that source is deleted.
    """

    # ---------------------------------------------------------
    # Base query
    # ---------------------------------------------------------

    query = (
        db.query(HistoryEvent)
        .filter(
            HistoryEvent.user_id == user_id
        )
    )

    # ---------------------------------------------------------
    # Optional source filter
    # ---------------------------------------------------------

    if source:
        source = source.lower().strip()

        if source not in {
            "youtube",
            "spotify",
        }:
            raise HTTPException(
                status_code=400,
                detail="Unsupported source.",
            )

        query = query.filter(
            HistoryEvent.source == source
        )

    # ---------------------------------------------------------
    # Delete
    # ---------------------------------------------------------

    deleted = query.delete(
        synchronize_session=False
    )

    db.commit()

    # ---------------------------------------------------------
    # Clear analysis cache
    # ---------------------------------------------------------

    delete_cached_analysis(
        user_id=user_id,
        source=None,
    )

    if source:
        delete_cached_analysis(
            user_id=user_id,
            source=source,
        )

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return {
        "success": True,
        "deleted": deleted,
        "source": source,
    }