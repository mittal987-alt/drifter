import io
import json
import zipfile
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import (
    HistoryEvent,
    PortabilityExportJob,
)

from app.services.youtube_history_service import (
    create_event_hash,
    load_youtube_history_file,
    parse_youtube_history,
)

from app.services.analysis_cache_service import (
    delete_cached_analysis,
)


# =========================================================
# EXTRACT YOUTUBE HISTORY FROM GOOGLE ARCHIVE
# =========================================================

def extract_youtube_history_from_archive(
    archive_bytes: bytes,
) -> list[dict[str, Any]]:
    """
    Extract YouTube watch history JSON records
    from a Google Data Portability ZIP archive.
    """

    try:
        archive = zipfile.ZipFile(
            io.BytesIO(archive_bytes)
        )

    except zipfile.BadZipFile as exc:
        raise RuntimeError(
            "Google returned an invalid ZIP archive."
        ) from exc

    # -----------------------------------------------------
    # Find JSON files
    # -----------------------------------------------------

    json_files = [
        name
        for name in archive.namelist()
        if name.lower().endswith(".json")
    ]

    if not json_files:
        raise RuntimeError(
            "No JSON files were found in the Google archive."
        )

    # -----------------------------------------------------
    # Prefer watch-history files
    # -----------------------------------------------------

    preferred_files = [
        name
        for name in json_files
        if (
            "watch-history" in name.lower()
            or "watch_history" in name.lower()
            or "watch history" in name.lower()
        )
    ]

    candidates = (
        preferred_files
        if preferred_files
        else json_files
    )

    # -----------------------------------------------------
    # Find actual YouTube history
    # -----------------------------------------------------

    for filename in candidates:

        try:
            raw = archive.read(filename)

            data = load_youtube_history_file(
                filename=filename,
                content=raw,
            )

            if not isinstance(data, list):
                continue

            # Check whether records look like
            # YouTube watch-history records.
            looks_like_history = any(
                isinstance(item, dict)
                and "title" in item
                and "time" in item
                for item in data[:100]
            )

            if looks_like_history:
                return data

        except Exception:
            continue

    raise RuntimeError(
        "Could not find YouTube watch history "
        "inside the Google archive."
    )


# =========================================================
# SAVE YOUTUBE EVENTS
# =========================================================

def save_youtube_events(
    db: Session,
    user_id: int,
    events: list[dict[str, Any]],
) -> tuple[int, int]:
    from app.api.history import save_history_events

    return save_history_events(
        db=db,
        user_id=user_id,
        events=events,
        source="youtube",
    )


# =========================================================
# IMPORT COMPLETED YOUTUBE ARCHIVE
# =========================================================

def import_completed_youtube_archive(
    db: Session,
    user_id: int,
    archive_bytes: bytes,
) -> dict[str, int]:
    """
    Parse and import a completed Google
    YouTube Data Portability archive.
    """

    # -----------------------------------------------------
    # Extract raw history
    # -----------------------------------------------------

    raw_data = (
        extract_youtube_history_from_archive(
            archive_bytes
        )
    )

    # -----------------------------------------------------
    # Normalize records
    # -----------------------------------------------------

    events = parse_youtube_history(
        raw_data
    )

    # -----------------------------------------------------
    # Save events
    # -----------------------------------------------------

    imported, duplicates = (
        save_youtube_events(
            db=db,
            user_id=user_id,
            events=events,
        )
    )

    # -----------------------------------------------------
    # Summary
    # -----------------------------------------------------

    return {
        "total_records": len(
            raw_data
        ),
        "valid_records": len(
            events
        ),
        "imported": imported,
        "duplicates": duplicates,
        "skipped": (
            len(raw_data)
            - len(events)
        ),
    }


# =========================================================
# UPDATE PORTABILITY JOB
# =========================================================

def update_portability_job(
    db: Session,
    job: PortabilityExportJob,
    status: str,
    imported: int | None = None,
    duplicates: int | None = None,
    skipped: int | None = None,
    error: str | None = None,
) -> None:
    """
    Update the status and import statistics
    of a Google portability job.
    """

    job.status = status

    if imported is not None:
        job.imported = imported

    if duplicates is not None:
        job.duplicates = duplicates

    if skipped is not None:
        job.skipped = skipped

    job.error = error

    db.commit()