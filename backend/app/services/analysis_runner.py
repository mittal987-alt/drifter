import json
import logging

from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database.models import AnalysisResult
from app.services.analytics_service import (
    analyze_user_history,
)

logger = logging.getLogger(__name__)


def set_analysis_status(
    db: Session,
    user_id: int,
    source: str | None,
    status: str,
    error: str | None = None,
):
    result = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.user_id == user_id,
            AnalysisResult.source == source,
        )
        .first()
    )

    if not result:
        result = AnalysisResult(
            user_id=user_id,
            source=source,
            event_count=0,
            status=status,
            error=error,
            analysis_json=json.dumps({}),
        )

        db.add(result)

    else:
        result.status = status
        result.error = error

    db.commit()


def run_user_analysis(
    user_id: int,
    source: str | None = None,
) -> None:

    db: Session = SessionLocal()

    try:

        # -----------------------------------------------------
        # Mark analysis as running
        # -----------------------------------------------------

        set_analysis_status(
            db=db,
            user_id=user_id,
            source=source,
            status="RUNNING",
        )

        logger.info(
            "[Analysis] Starting user=%s, source=%s",
            user_id,
            source,
        )

        # -----------------------------------------------------
        # Run complete pipeline
        # -----------------------------------------------------

        analyze_user_history(
            db=db,
            user_id=user_id,
            source=source,
        )

        # -----------------------------------------------------
        # Mark complete
        # -----------------------------------------------------

        set_analysis_status(
            db=db,
            user_id=user_id,
            source=source,
            status="READY",
            error=None,
        )

        logger.info(
            "[Analysis] Completed user=%s, source=%s",
            user_id,
            source,
        )

    except Exception as exc:

        db.rollback()

        error_message = str(exc)

        logger.error(
            "[Analysis] FAILED user=%s, source=%s: %s",
            user_id,
            source,
            error_message,
            exc_info=True,
        )

        try:
            set_analysis_status(
                db=db,
                user_id=user_id,
                source=source,
                status="FAILED",
                error=error_message,
            )
        except Exception:
            db.rollback()

    finally:
        db.close()