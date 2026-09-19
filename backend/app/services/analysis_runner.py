import json

from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database.models import AnalysisResult
from app.services.analytics_service import (
    analyze_user_history,
)


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

        print(
            f"[Analysis] Starting "
            f"user={user_id}, source={source}",
            flush=True,
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

        print(
            f"[Analysis] Completed "
            f"user={user_id}, source={source}",
            flush=True,
        )

    except Exception as exc:

        db.rollback()

        error_message = str(exc)

        print(
            f"[Analysis] FAILED "
            f"user={user_id}, "
            f"source={source}: "
            f"{error_message}",
            flush=True,
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