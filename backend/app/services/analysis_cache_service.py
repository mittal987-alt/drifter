import json

from app.database.database import SessionLocal
from app.database.models import AnalysisResult


def get_cached_analysis(
    user_id: int,
    source: str | None,
):
    db = SessionLocal()

    try:
        query = (
            db.query(AnalysisResult)
            .filter(
                AnalysisResult.user_id == user_id
            )
        )

        if source is None:
            query = query.filter(
                AnalysisResult.source.is_(None)
            )
        else:
            query = query.filter(
                AnalysisResult.source == source
            )

        result = query.first()

        if not result:
            return None

        return {
            "id": result.id,
            "user_id": result.user_id,
            "source": result.source,
            "event_count": result.event_count,
            "status": getattr(result, "status", "READY"),
            "error": getattr(result, "error", None),
            "analysis": json.loads(
                result.analysis_json
            ),
            "created_at": result.created_at,
            "updated_at": result.updated_at,
        }

    finally:
        db.close()


def save_analysis(
    user_id: int,
    source: str | None,
    event_count: int,
    analysis: dict,
):
    db = SessionLocal()

    try:

        query = (
            db.query(AnalysisResult)
            .filter(
                AnalysisResult.user_id == user_id
            )
        )

        if source is None:
            query = query.filter(
                AnalysisResult.source.is_(None)
            )
        else:
            query = query.filter(
                AnalysisResult.source == source
            )

        result = query.first()

        analysis_json = json.dumps(
            analysis,
            default=str,
        )

        if result:

            result.event_count = event_count

            result.analysis_json = analysis_json

        else:

            result = AnalysisResult(
                user_id=user_id,
                source=source,
                event_count=event_count,
                analysis_json=analysis_json,
            )

            db.add(result)

        db.commit()

        db.refresh(result)

        return result

    finally:
        db.close()


def delete_cached_analysis(
    user_id: int,
    source: str | None = None,
):
    db = SessionLocal()

    try:

        query = (
            db.query(AnalysisResult)
            .filter(
                AnalysisResult.user_id == user_id
            )
        )

        if source is None:
            query = query.filter(
                AnalysisResult.source.is_(None)
            )
        else:
            query = query.filter(
                AnalysisResult.source == source
            )

        query.delete(
            synchronize_session=False
        )

        db.commit()

    finally:
        db.close()