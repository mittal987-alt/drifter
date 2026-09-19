import json
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id
from app.api.history import save_youtube_events
from app.config import settings
from app.database.database import get_db
from app.database.models import Connection, PortabilityExportJob
from app.services.google_service import (
    GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
    download_portability_archive,
    get_youtube_history_export_state,
    initiate_youtube_history_export,
    refresh_google_token,
)
from app.services.history_service import parse_youtube_archive_bytes
from app.services.youtube_history_service import parse_youtube_history


router = APIRouter(prefix="/api/history/google", tags=["Google History"])


def _connection_token(connection: Connection):
    if connection.expires_at and connection.expires_at <= datetime.utcnow():
        return None
    return connection.access_token


async def _get_portability_token(
    connection: Connection,
    db: Session,
):
    token = _connection_token(connection)
    if token:
        return token
    if not connection.refresh_token:
        raise HTTPException(status_code=401, detail="Google authorization expired.")

    token_data = await refresh_google_token(connection.refresh_token)
    connection.access_token = token_data["access_token"]
    if token_data.get("expires_in"):
        connection.expires_at = datetime.utcnow() + timedelta(
            seconds=int(token_data["expires_in"])
        )
    db.commit()
    return connection.access_token


@router.post("/export")
async def start_google_history_export(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connection = (
        db.query(Connection)
        .filter(
            Connection.user_id == user_id,
            Connection.provider == "google_data_portability",
        )
        .first()
    )
    if not connection:
        raise HTTPException(
            status_code=409,
            detail="Connect Google Data Portability before starting an export.",
        )

    token = await _get_portability_token(connection, db)
    try:
        response = await initiate_youtube_history_export(token)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text)

    archive_job_id = response.get("archiveJobId")
    if not archive_job_id:
        raise HTTPException(status_code=502, detail="Google did not return an archive job ID.")

    job = PortabilityExportJob(
        user_id=user_id,
        archive_job_id=archive_job_id,
        status="IN_PROGRESS",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"job_id": job.id, "status": job.status}


@router.get("/export/latest")
async def get_latest_google_history_export(
    user_id: int = Depends(get_current_user_id),
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
            "job_id": None,
            "status": "IDLE",
            "imported": 0,
            "duplicates": 0,
            "skipped": 0,
            "error": None,
        }

    return await get_google_history_export(job.id, user_id, db)


@router.get("/export/{job_id}")
async def get_google_history_export(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    job = (
        db.query(PortabilityExportJob)
        .filter(
            PortabilityExportJob.id == job_id,
            PortabilityExportJob.user_id == user_id,
        )
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found.")
    if job.status == "COMPLETE":
        return _job_response(job)

    connection = (
        db.query(Connection)
        .filter(
            Connection.user_id == user_id,
            Connection.provider == "google_data_portability",
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=401, detail="Google authorization is missing.")

    token = await _get_portability_token(connection, db)
    try:
        state = await get_youtube_history_export_state(token, job.archive_job_id)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text)

    google_state = state.get("state", "IN_PROGRESS")
    if google_state != "COMPLETE":
        job.status = google_state
        job.error = json.dumps(state) if google_state == "FAILED" else None
        db.commit()
        return _job_response(job)

    try:
        records = []
        for url in state.get("urls", []):
            records.extend(parse_youtube_archive_bytes(await download_portability_archive(url)))
        events = parse_youtube_history(records)
        job.imported, job.duplicates = save_youtube_events(db, user_id, events)
        job.skipped = len(records) - len(events)
        job.status = "COMPLETE"
        db.commit()
    except (ValueError, httpx.HTTPError, json.JSONDecodeError) as exc:
        db.rollback()
        job.status = "FAILED"
        job.error = str(exc)
        db.commit()
        raise HTTPException(status_code=502, detail="Could not import the Google archive.")

    return _job_response(job)


def _job_response(job: PortabilityExportJob):
    return {
        "job_id": job.id,
        "status": job.status,
        "imported": job.imported,
        "duplicates": job.duplicates,
        "skipped": job.skipped,
        "error": job.error,
    }