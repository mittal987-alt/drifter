import json
from datetime import datetime

import httpx
from pydantic import BaseModel

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
from app.analytics.topics import classify_single_event


from sqlalchemy.dialects.sqlite import insert as sqlite_insert


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

    if not events:
        return 0, 0

    # Fetch all existing event hashes in the database to prevent constraint collisions
    existing_hashes = {
        row[0]
        for row in db.query(HistoryEvent.event_hash).all()
        if row[0]
    }

    seen_in_batch = set()
    records_to_insert = []

    for event in events:
        event_hash = create_event_hash(event, user_id=user_id)

        if event_hash in existing_hashes or event_hash in seen_in_batch:
            duplicates += 1
            continue

        seen_in_batch.add(event_hash)
        ev_source = event.get("source") or source

        ts = event.get("timestamp")
        if not isinstance(ts, datetime):
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    ts = datetime.utcnow()
            else:
                ts = datetime.utcnow()

        row_dict = {
            "user_id": user_id,
            "timestamp": ts,
            "source": ev_source,
            "title": event.get("title", "Untitled") or "Untitled",
            "artist": event.get("artist"),
            "url": event.get("url"),
            "duration": event.get("duration"),
            "event_hash": event_hash,
            "metadata_json": json.dumps(
                event.get("metadata", {}),
                default=str,
            ),
            "created_at": datetime.utcnow(),
        }
        records_to_insert.append(row_dict)

    if not records_to_insert:
        return 0, duplicates

    BATCH_SIZE = 500
    dialect_name = db.bind.dialect.name if db.bind else "sqlite"
    is_sqlite = dialect_name == "sqlite"

    for i in range(0, len(records_to_insert), BATCH_SIZE):
        batch = records_to_insert[i : i + BATCH_SIZE]
        if is_sqlite:
            try:
                stmt = sqlite_insert(HistoryEvent).values(batch).on_conflict_do_nothing()
                db.execute(stmt)
                db.commit()
                imported += len(batch)
            except Exception:
                db.rollback()
                for item in batch:
                    try:
                        single_stmt = sqlite_insert(HistoryEvent).values([item]).on_conflict_do_nothing()
                        db.execute(single_stmt)
                        db.commit()
                        imported += 1
                    except Exception:
                        db.rollback()
                        duplicates += 1
        else:
            try:
                orm_objects = [HistoryEvent(**item) for item in batch]
                db.add_all(orm_objects)
                db.commit()
                imported += len(batch)
            except Exception:
                db.rollback()
                for item in batch:
                    try:
                        db.add(HistoryEvent(**item))
                        db.commit()
                        imported += 1
                    except Exception:
                        db.rollback()
                        duplicates += 1

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

    SUPPORTED_SOURCES = {
        "youtube", "spotify", "github", "reddit", "netflix", "steam", "browser"
    }

    if source not in SUPPORTED_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported source '{source}'. "
                f"Supported: {', '.join(sorted(SUPPORTED_SOURCES))}."
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
        # All other sources: Spotify, GitHub, Reddit, Netflix, Steam, Browser
        try:
            events = parse_history_file(
                content=raw_bytes,
                filename=file.filename,
                source=source,
            )
            total_records = len(events)
        except Exception as exc:
            print(f"[{source.upper()} IMPORT ERROR] File '{file.filename}': {exc}", flush=True)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse {source.title()} history: {exc}",
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

        SUPPORTED_SOURCES = {
            "youtube", "spotify", "github", "reddit", "netflix", "steam", "browser"
        }
        if source not in SUPPORTED_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported source '{source}'.",
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
                "topic": classify_single_event(event.title, event.artist),
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

        SUPPORTED_SOURCES = {
            "youtube", "spotify", "github", "reddit", "netflix", "steam", "browser", "extension"
        }
        if source not in SUPPORTED_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported source '{source}'.",
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


# =============================================================
# DELETE SINGLE EVENT
# =============================================================

@router.delete("/events/{event_id}")
def delete_history_event(
    event_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Delete a specific history event belonging to the current user.
    """
    event = (
        db.query(HistoryEvent)
        .filter(
            HistoryEvent.id == event_id,
            HistoryEvent.user_id == user_id,
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="History event not found.",
        )

    ev_source = event.source
    db.delete(event)
    db.commit()

    # Clear analysis caches so next load reflects deletion
    delete_cached_analysis(user_id=user_id, source=None)
    if ev_source:
        delete_cached_analysis(user_id=user_id, source=ev_source)

    return {
        "success": True,
        "event_id": event_id,
        "message": "Event deleted successfully.",
    }


# =============================================================
# STEAM API KEY SYNC
# =============================================================

class SteamSyncRequest(BaseModel):
    api_key: str
    steam_id: str


@router.post("/steam-sync")
async def steam_sync(
    body: SteamSyncRequest,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Sync Steam game library using a Steam Web API key and Steam ID.
    No OAuth needed — Steam Web API is public.
    """
    api_key = body.api_key.strip()
    steam_id = body.steam_id.strip()

    if not api_key or not steam_id:
        raise HTTPException(status_code=400, detail="Both api_key and steam_id are required.")

    steam_url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(steam_url, params={
                "key": api_key,
                "steamid": steam_id,
                "include_appinfo": 1,
                "include_played_free_games": 1,
                "format": "json",
            })
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Invalid Steam API key or Steam profile is private. Make sure your profile's game details are public.",
            )
        raise HTTPException(status_code=400, detail=f"Steam API error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to contact Steam API: {exc}")

    games = (data.get("response") or {}).get("games") or []
    if not games:
        raise HTTPException(
            status_code=404,
            detail="No games found. Check your Steam ID and make sure your profile is public.",
        )

    events = []
    for game in games:
        name = game.get("name") or f"App {game.get('appid', 'unknown')}"
        playtime_min = game.get("playtime_forever") or 0
        rtime = game.get("rtime_last_played") or 0
        if rtime:
            try:
                ts = datetime.utcfromtimestamp(rtime)
            except Exception:
                ts = datetime.utcnow()
        else:
            ts = datetime.utcnow()

        events.append({
            "timestamp": ts,
            "source": "steam",
            "title": name,
            "artist": None,
            "url": f"https://store.steampowered.com/app/{game.get('appid', '')}",
            "duration": float(playtime_min) if playtime_min else None,
            "metadata": game,
        })

    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=events,
        source="steam",
    )

    if imported > 0:
        background_tasks.add_task(run_user_analysis, user_id, "steam")
        background_tasks.add_task(run_user_analysis, user_id, None)

    return {
        "success": True,
        "source": "steam",
        "total": len(games),
        "imported": imported,
        "duplicates": duplicates,
        "message": f"Imported {imported} Steam games ({duplicates} already existed).",
    }