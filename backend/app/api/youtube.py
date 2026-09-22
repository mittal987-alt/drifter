import asyncio
import io
import json
import zipfile
from datetime import datetime, timedelta
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id
from app.database.database import SessionLocal, get_db
from app.database.models import (
    Connection,
    HistoryEvent,
    PortabilityExportJob,
)

from app.services.google_service import (
    download_portability_archive,
    get_youtube_history_export_state,
    refresh_google_token,
    youtube_api_request,
)

from app.services.youtube_history_service import (
    create_event_hash,
    load_youtube_history_file,
    parse_youtube_history,
)

from app.services.analysis_cache_service import (
    delete_cached_analysis,
)

from app.services.analysis_runner import (
    run_user_analysis,
)


router = APIRouter()


# =========================================================
# GET YOUTUBE ACCESS TOKEN
# =========================================================

async def get_youtube_access_token(
    user_id: int,
    db: Session,
) -> str:

    connection = (
        db.query(Connection)
        .filter(
            Connection.user_id == user_id,
            Connection.provider == "youtube",
        )
        .order_by(
            Connection.created_at.desc()
        )
        .first()
    )

    if not connection:

        raise HTTPException(
            status_code=401,
            detail="YouTube is not connected.",
        )

    # -----------------------------------------------------
    # Refresh if expired/about to expire
    # -----------------------------------------------------

    if (
        connection.expires_at
        and connection.expires_at
        <= datetime.utcnow()
        + timedelta(seconds=60)
    ):

        if not connection.refresh_token:

            raise HTTPException(
                status_code=401,
                detail=(
                    "YouTube authorization expired. "
                    "Reconnect YouTube."
                ),
            )

        try:

            tokens = await refresh_google_token(
                connection.refresh_token
            )

        except Exception:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Could not refresh YouTube authorization. "
                    "Reconnect YouTube."
                ),
            )

        access_token = tokens.get(
            "access_token"
        )

        if not access_token:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Google did not return "
                    "a new access token."
                ),
            )

        connection.access_token = (
            access_token
        )

        connection.expires_at = (
            datetime.utcnow()
            + timedelta(
                seconds=int(
                    tokens.get(
                        "expires_in",
                        3600,
                    )
                )
            )
        )

        db.commit()

    return connection.access_token


# =========================================================
# YOUTUBE CHANNEL
# =========================================================

@router.get("/channel")
async def youtube_channel(
    user_id: int = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db),
):

    access_token = (
        await get_youtube_access_token(
            user_id=user_id,
            db=db,
        )
    )

    return await youtube_api_request(
        access_token,
        "/channels",
        {
            "part": (
                "snippet,"
                "contentDetails,"
                "statistics"
            ),
            "mine": "true",
        },
    )


# =========================================================
# YOUTUBE PLAYLISTS
# =========================================================

@router.get("/playlists")
async def youtube_playlists(
    user_id: int = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db),
):

    access_token = (
        await get_youtube_access_token(
            user_id=user_id,
            db=db,
        )
    )

    return await youtube_api_request(
        access_token,
        "/playlists",
        {
            "part": (
                "snippet,"
                "contentDetails"
            ),
            "mine": "true",
            "maxResults": 50,
        },
    )


# =========================================================
# YOUTUBE LIKED VIDEOS
# =========================================================

@router.get("/liked")
async def youtube_liked(
    max_results: int = 50,
    user_id: int = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db),
):

    if (
        max_results < 1
        or max_results > 50
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "max_results must be between "
                "1 and 50."
            ),
        )

    access_token = (
        await get_youtube_access_token(
            user_id=user_id,
            db=db,
        )
    )

    return await youtube_api_request(
        access_token,
        "/videos",
        {
            "part": (
                "snippet,"
                "contentDetails"
            ),
            "myRating": "like",
            "maxResults": max_results,
        },
    )


# =========================================================
# GET DATA PORTABILITY CONNECTION
# =========================================================

def get_portability_connection(
    db: Session,
    user_id: int,
) -> Connection | None:

    return (
        db.query(Connection)
        .filter(
            Connection.user_id == user_id,
            Connection.provider
            == "google_data_portability",
        )
        .order_by(
            Connection.created_at.desc()
        )
        .first()
    )


# =========================================================
# SAVE PORTABILITY EVENTS
# =========================================================

def save_portability_events(
    db: Session,
    user_id: int,
    events: list[dict[str, Any]],
) -> dict[str, int]:
    from app.api.history import save_history_events

    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=events,
        source="youtube",
    )

    return {
        "imported": imported,
        "duplicates": duplicates,
    }


# =========================================================
# EXTRACT YOUTUBE HISTORY FROM ZIP
# =========================================================

def extract_youtube_history_from_archive(
    archive_bytes: bytes,
) -> list[dict[str, Any]]:

    try:

        archive = zipfile.ZipFile(
            io.BytesIO(
                archive_bytes
            )
        )

    except zipfile.BadZipFile as exc:

        raise RuntimeError(
            "Google returned an invalid ZIP archive."
        ) from exc

    json_files = [
        name
        for name in archive.namelist()
        if name.lower().endswith(
            ".json"
        )
    ]

    if not json_files:

        raise RuntimeError(
            "No JSON files were found "
            "in the Google archive."
        )

    # -----------------------------------------------------
    # Prefer watch history
    # -----------------------------------------------------

    preferred_files = [
        name
        for name in json_files
        if (
            "watch-history"
            in name.lower()
            or "watch_history"
            in name.lower()
            or "watch history"
            in name.lower()
        )
    ]

    candidates = (
        preferred_files
        or json_files
    )

    # -----------------------------------------------------
    # Find history file
    # -----------------------------------------------------

    for filename in candidates:

        try:

            raw = archive.read(
                filename
            )

            data = (
                load_youtube_history_file(
                    filename=filename,
                    content=raw,
                )
            )

            if not isinstance(
                data,
                list,
            ):
                continue

            looks_like_history = any(
                isinstance(
                    item,
                    dict,
                )
                and "title" in item
                and "time" in item
                for item in data[:100]
            )

            if looks_like_history:

                return data

        except Exception:

            continue

    raise RuntimeError(
        "Could not find YouTube watch "
        "history inside the Google archive."
    )


# =========================================================
# IMPORT COMPLETED ARCHIVE
# =========================================================

def import_completed_youtube_archive(
    db: Session,
    user_id: int,
    archive_bytes: bytes,
) -> dict[str, int]:

    raw_data = (
        extract_youtube_history_from_archive(
            archive_bytes
        )
    )

    events = parse_youtube_history(
        raw_data
    )

    result = save_portability_events(
        db=db,
        user_id=user_id,
        events=events,
    )

    return {
        "total_records": len(
            raw_data
        ),
        "valid_records": len(
            events
        ),
        "imported": result[
            "imported"
        ],
        "duplicates": result[
            "duplicates"
        ],
        "skipped": (
            len(raw_data)
            - len(events)
        ),
    }


# =========================================================
# UPDATE EXPORT JOB
# =========================================================

def update_export_job(
    db: Session,
    job: PortabilityExportJob,
    status: str,
    imported: int | None = None,
    duplicates: int | None = None,
    skipped: int | None = None,
    error: str | None = None,
):

    job.status = status

    if imported is not None:
        job.imported = imported

    if duplicates is not None:
        job.duplicates = duplicates

    if skipped is not None:
        job.skipped = skipped

    job.error = error

    job.updated_at = datetime.utcnow()

    db.commit()


# =========================================================
# DOWNLOAD + IMPORT ARCHIVE
# =========================================================

async def download_and_import_archive(
    user_id: int,
    job_id: int,
    urls: list[str],
):

    db = SessionLocal()

    try:

        job = (
            db.query(
                PortabilityExportJob
            )
            .filter(
                PortabilityExportJob.id
                == job_id,
                PortabilityExportJob.user_id
                == user_id,
            )
            .first()
        )

        if not job:
            return

        total_records = 0
        valid_records = 0
        imported = 0
        duplicates = 0
        skipped = 0

        # -------------------------------------------------
        # Download all archive URLs
        # -------------------------------------------------

        for url in urls:

            archive_bytes = (
                await download_portability_archive(
                    signed_url=url
                )
            )

            result = (
                import_completed_youtube_archive(
                    db=db,
                    user_id=user_id,
                    archive_bytes=archive_bytes,
                )
            )

            total_records += result[
                "total_records"
            ]

            valid_records += result[
                "valid_records"
            ]

            imported += result[
                "imported"
            ]

            duplicates += result[
                "duplicates"
            ]

            skipped += result[
                "skipped"
            ]

        # -------------------------------------------------
        # Mark ready
        # -------------------------------------------------

        update_export_job(
            db=db,
            job=job,
            status="READY",
            imported=imported,
            duplicates=duplicates,
            skipped=skipped,
            error=None,
        )

        print(
            "[Google Import] "
            f"user={user_id} "
            f"job={job_id} "
            f"imported={imported} "
            f"duplicates={duplicates} "
            f"skipped={skipped}",
            flush=True,
        )

        # -------------------------------------------------
        # Run analysis
        # -------------------------------------------------

        if imported > 0:

            await asyncio.to_thread(
                run_user_analysis,
                user_id,
                "youtube",
            )

    except Exception as exc:

        db.rollback()

        print(
            "[Google Import] FAILED "
            f"user={user_id} "
            f"job={job_id}: {exc}",
            flush=True,
        )

        job = (
            db.query(
                PortabilityExportJob
            )
            .filter(
                PortabilityExportJob.id
                == job_id,
                PortabilityExportJob.user_id
                == user_id,
            )
            .first()
        )

        if job:

            job.status = "FAILED"
            job.error = str(exc)
            job.updated_at = datetime.utcnow()

            db.commit()

    finally:

        db.close()


# =========================================================
# GOOGLE DATA PORTABILITY STATUS
# =========================================================

@router.get(
    "/data-portability/status/latest"
)
async def google_data_portability_status_latest(
    background_tasks: BackgroundTasks,
    user_id: int = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db),
):
    job = (
        db.query(PortabilityExportJob)
        .filter(PortabilityExportJob.user_id == user_id)
        .order_by(PortabilityExportJob.created_at.desc())
        .first()
    )

    if not job:
        return {
            "success": True,
            "job_id": None,
            "status": "IDLE",
            "imported": 0,
            "duplicates": 0,
            "skipped": 0,
        }

    return await google_data_portability_status(
        job_id=job.id,
        background_tasks=background_tasks,
        user_id=user_id,
        db=db,
    )


@router.get(
    "/data-portability/status/{job_id}"
)
async def google_data_portability_status(
    job_id: int,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # Find user's job
    # -----------------------------------------------------

    job = (
        db.query(
            PortabilityExportJob
        )
        .filter(
            PortabilityExportJob.id
            == job_id,
            PortabilityExportJob.user_id
            == user_id,
        )
        .first()
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail=(
                "Google export job not found."
            ),
        )

    # -----------------------------------------------------
    # Already ready
    # -----------------------------------------------------

    if job.status == "READY":

        return {
            "success": True,
            "job_id": job.id,
            "status": "READY",
            "imported": job.imported,
            "duplicates": job.duplicates,
            "skipped": job.skipped,
        }

    # -----------------------------------------------------
    # Currently processing
    # -----------------------------------------------------

    if job.status == "PROCESSING":

        return {
            "success": True,
            "job_id": job.id,
            "status": "PROCESSING",
            "message": (
                "Downloading and importing "
                "your YouTube history."
            ),
        }

    # -----------------------------------------------------
    # Failed
    # -----------------------------------------------------

    if job.status == "FAILED":

        return {
            "success": False,
            "job_id": job.id,
            "status": "FAILED",
            "error": job.error,
        }

    # -----------------------------------------------------
    # Get Google portability connection
    # -----------------------------------------------------

    connection = (
        get_portability_connection(
            db=db,
            user_id=user_id,
        )
    )

    if not connection:

        raise HTTPException(
            status_code=401,
            detail=(
                "Google Data Portability is "
                "not connected. "
                "Connect Google again."
            ),
        )

    access_token = (
        connection.access_token
    )

    # -----------------------------------------------------
    # Refresh if expired
    # -----------------------------------------------------

    if (
        connection.expires_at
        and connection.expires_at
        <= datetime.utcnow()
        + timedelta(seconds=60)
    ):

        if not connection.refresh_token:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Google authorization expired. "
                    "Connect Google again."
                ),
            )

        try:

            tokens = (
                await refresh_google_token(
                    connection.refresh_token
                )
            )

        except Exception:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Could not refresh Google "
                    "authorization."
                ),
            )

        access_token = tokens.get(
            "access_token"
        )

        if not access_token:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Google did not return "
                    "a new access token."
                ),
            )

        connection.access_token = (
            access_token
        )

        connection.expires_at = (
            datetime.utcnow()
            + timedelta(
                seconds=int(
                    tokens.get(
                        "expires_in",
                        3600,
                    )
                )
            )
        )

        db.commit()

    # -----------------------------------------------------
    # Ask Google for state
    # -----------------------------------------------------

    try:

        state_data = (
            await get_youtube_history_export_state(
                access_token=access_token,
                archive_job_id=(
                    job.archive_job_id
                ),
            )
        )

    except Exception as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not check Google "
                "export status: "
                f"{str(exc)}"
            ),
        )

    google_state = state_data.get(
        "state"
    )

    # =====================================================
    # IN PROGRESS
    # =====================================================

    if google_state == "IN_PROGRESS":

        return {
            "success": True,
            "job_id": job.id,
            "status": "IN_PROGRESS",
            "google_state": google_state,
            "message": (
                "Google is preparing "
                "your YouTube history."
            ),
        }

    # =====================================================
    # FAILED / CANCELLED
    # =====================================================

    if google_state in {
        "FAILED",
        "CANCELLED",
    }:

        error = (
            state_data.get("error")
            or (
                "Google export ended with "
                f"state: {google_state}"
            )
        )

        update_export_job(
            db=db,
            job=job,
            status="FAILED",
            error=error,
        )

        return {
            "success": False,
            "job_id": job.id,
            "status": "FAILED",
            "google_state": google_state,
            "error": error,
        }

    # =====================================================
    # COMPLETE
    # =====================================================

    if google_state == "COMPLETE":

        urls = (
            state_data.get("urls")
            or []
        )

        if not urls:

            update_export_job(
                db=db,
                job=job,
                status="FAILED",
                error=(
                    "Google completed the "
                    "export but returned "
                    "no archive URLs."
                ),
            )

            return {
                "success": False,
                "job_id": job.id,
                "status": "FAILED",
                "error": (
                    "Google completed the "
                    "export but returned "
                    "no archive URLs."
                ),
            }

        # -------------------------------------------------
        # Prevent duplicate processing
        # -------------------------------------------------

        job.status = "PROCESSING"

        db.commit()

        # -------------------------------------------------
        # Start background import
        # -------------------------------------------------

        background_tasks.add_task(
            download_and_import_archive,
            user_id,
            job.id,
            urls,
        )

        return {
            "success": True,
            "job_id": job.id,
            "status": "PROCESSING",
            "google_state": google_state,
            "message": (
                "Google export is complete. "
                "Importing your YouTube history."
            ),
        }

    # =====================================================
    # UNKNOWN
    # =====================================================

    return {
        "success": True,
        "job_id": job.id,
        "status": "IN_PROGRESS",
        "google_state": google_state,
        "message": (
            "Waiting for Google export."
        ),
    }