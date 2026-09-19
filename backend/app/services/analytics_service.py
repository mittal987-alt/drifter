
import json
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import (
    AnalysisResult,
    HistoryEvent,
)

from app.services.analysis_pipeline import (
    run_analysis_pipeline,
)


def build_interest_analysis(
    events: list[Any],
) -> dict[str, Any]:
    """
    Run the complete analysis pipeline.
    """

    return run_analysis_pipeline(events)


def get_cached_analysis(
    db: Session,
    user_id: int,
    source: str | None = None,
) -> dict[str, Any] | None:

    query = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.user_id == user_id,
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

    result = (
        query
        .order_by(
            AnalysisResult.updated_at.desc()
        )
        .first()
    )

    if not result:
        return None

    try:
        return json.loads(
            result.analysis_json
        )
    except json.JSONDecodeError:
        return None


def save_analysis(
    db: Session,
    user_id: int,
    analysis: dict[str, Any],
    source: str | None = None,
) -> AnalysisResult:

    event_count = len(
        analysis.get("events", [])
    )

    existing = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.user_id == user_id,
            AnalysisResult.source == source,
        )
        .first()
    )

    if existing:

        existing.event_count = event_count

        existing.analysis_json = json.dumps(
            analysis,
            default=str,
        )

        db.commit()
        db.refresh(existing)

        return existing

    result = AnalysisResult(
        user_id=user_id,
        source=source,
        event_count=event_count,
        analysis_json=json.dumps(
            analysis,
            default=str,
        ),
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    return result


def analyze_user_history(
    db: Session,
    user_id: int,
    source: str | None = None,
) -> dict[str, Any]:

    query = (
        db.query(HistoryEvent)
        .filter(
            HistoryEvent.user_id == user_id
        )
    )

    if source:
        query = query.filter(
            HistoryEvent.source == source
        )

    events = (
        query
        .order_by(
            HistoryEvent.timestamp.asc()
        )
        .all()
    )

    analysis = run_analysis_pipeline(
        events
    )

    save_analysis(
        db=db,
        user_id=user_id,
        analysis=analysis,
        source=source,
    )

    return analysis