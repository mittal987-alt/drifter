from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import (
    get_current_user_id,
)

from app.database.database import SessionLocal
from app.database.models import HistoryEvent

from app.services.analytics_service import (
    build_interest_analysis,
)

from app.services.analysis_cache_service import (
    get_cached_analysis,
    save_analysis,
)

from app.services.analysis_runner import (
    run_user_analysis,
)

from app.ai.history_chat import answer_history_chat
from app.reports.year_in_drift import generate_year_in_drift_report
from app.prediction.next_interest import predict_next_interests
from app.analytics.correlation import analyze_cross_platform_correlation
from app.reports.interest_dna import generate_interest_dna


router = APIRouter()


# ============================================================
# TRIGGER BACKGROUND ANALYSIS
# ============================================================

@router.post("/trigger")
def trigger_analysis(
    background_tasks: BackgroundTasks,
    source: str | None = None,
    user_id: int = Depends(get_current_user_id),
):
    background_tasks.add_task(
        run_user_analysis,
        user_id=user_id,
        source=source,
    )

    return {
        "status": "RUNNING",
        "message": "Analysis started in background",
        "user_id": user_id,
        "source": source,
    }



# ============================================================
# GET INTEREST ANALYSIS
# ============================================================

@router.get("/interests")
def analyze_interests(
    source: str | None = None,
    limit: int = 1000,
    refresh: bool = False,
    user_id: int = Depends(
        get_current_user_id
    ),
):

    if limit < 1 or limit > 5000:

        raise HTTPException(
            status_code=400,
            detail=(
                "limit must be between "
                "1 and 5000."
            ),
        )

    # ========================================================
    # LOAD EVENTS
    # ========================================================

    db = SessionLocal()

    try:

        query = (
            db.query(HistoryEvent)
            .filter(
                HistoryEvent.user_id == user_id
            )
            .order_by(
                HistoryEvent.timestamp.asc()
            )
        )

        if source:

            query = query.filter(
                HistoryEvent.source == source
            )

        events = (
            query
            .limit(limit)
            .all()
        )

    finally:

        db.close()

    # ========================================================
    # EMPTY
    # ========================================================

    if not events:

        return {
            **build_interest_analysis([]),
            "cached": False,
        }

    # ========================================================
    # CACHE CHECK
    # ========================================================

    if not refresh:

        cached = get_cached_analysis(
            user_id=user_id,
            source=source,
        )

        if cached and cached.get("event_count") == len(events) and cached.get("analysis"):

            return {
                **cached["analysis"],
                "cached": True,
                "cache_updated_at": (
                    cached["updated_at"]
                ),
            }

    # ========================================================
    # ANALYZE
    # ========================================================

    analysis = build_interest_analysis(
        events
    )

    # ========================================================
    # SAVE CACHE
    # ========================================================

    save_analysis(
        user_id=user_id,
        source=source,
        event_count=len(events),
        analysis=analysis,
    )

    return {
        **analysis,
        "cached": False,
    }


# ============================================================
# DASHBOARD
# ============================================================

@router.get("/dashboard")
def get_dashboard(
    source: str | None = None,
    limit: int = 1000,
    refresh: bool = False,
    user_id: int = Depends(
        get_current_user_id
    ),
):

    if limit < 1 or limit > 5000:

        raise HTTPException(
            status_code=400,
            detail=(
                "limit must be between "
                "1 and 5000."
            ),
        )

    # ========================================================
    # LOAD EVENTS
    # ========================================================

    db = SessionLocal()

    try:

        query = (
            db.query(HistoryEvent)
            .filter(
                HistoryEvent.user_id == user_id
            )
            .order_by(
                HistoryEvent.timestamp.asc()
            )
        )

        if source:

            query = query.filter(
                HistoryEvent.source == source
            )

        events = (
            query
            .limit(limit)
            .all()
        )

    finally:

        db.close()

    if not events:

        return build_dashboard_response(
            build_interest_analysis([]),
            cached=False,
        )

    # ========================================================
    # CHECK CACHE
    # ========================================================

    if not refresh:

        cached = get_cached_analysis(
            user_id=user_id,
            source=source,
        )

        if cached and cached.get("event_count") == len(events) and cached.get("analysis"):
            analysis = cached["analysis"]
            assignments = analysis.get("assignments", [])
            # If all assignments are labeled "Other", bypass cache to re-analyze with categorization
            if not (assignments and all(a.get("topic") == "Other" for a in assignments if isinstance(a, dict))):
                return build_dashboard_response(
                    analysis,
                    cached=True,
                )

    # ========================================================
    # RUN ANALYSIS
    # ========================================================

    analysis = build_interest_analysis(
        events
    )

    # ========================================================
    # SAVE
    # ========================================================

    save_analysis(
        user_id=user_id,
        source=source,
        event_count=len(events),
        analysis=analysis,
    )

    return build_dashboard_response(
        analysis,
        cached=False,
    )


# ============================================================
# DASHBOARD RESPONSE BUILDER
# ============================================================

def build_dashboard_response(
    analysis: dict,
    cached: bool,
):

    evolution = analysis.get(
        "evolution",
        {}
    )

    behavior = analysis.get(
        "behavior",
        {}
    )

    topics = analysis.get(
        "topics",
        {}
    )

    assignments = analysis.get(
        "assignments",
        []
    )

    # ========================================================
    # TOPIC COUNTS
    # ========================================================

    topic_counts = {}

    for assignment in assignments:

        topic = assignment.get(
            "topic",
            "Unknown"
        )

        topic_counts[topic] = (
            topic_counts.get(topic, 0) + 1
        )

    # ========================================================
    # TOP TOPICS
    # ========================================================

    top_topics = sorted(
        [
            {
                "topic": topic,
                "count": count,
            }
            for topic, count
            in topic_counts.items()
        ],
        key=lambda item: item["count"],
        reverse=True,
    )[:10]

    # ========================================================
    # TOPIC COUNT
    # ========================================================

    topic_count = len(
        topic_counts
    )

    # ========================================================
    # DOMINANT TOPIC
    # ========================================================

    dominant_topic = None

    meaningful_top = [t for t in top_topics if t["topic"] != "Other"]
    if meaningful_top:
        dominant_topic = meaningful_top[0]["topic"]
    elif top_topics:
        dominant_topic = top_topics[0]["topic"]

    # ========================================================
    # RISING
    # ========================================================

    rising = [
        item for item in evolution.get("rising", [])
        if isinstance(item, dict) and item.get("topic") != "Other"
    ]

    # ========================================================
    # FADING
    # ========================================================

    fading = [
        item for item in evolution.get("fading", [])
        if isinstance(item, dict) and item.get("topic") != "Other"
    ]

    # ========================================================
    # EMERGING
    # ========================================================

    emerging = evolution.get(
        "emerging",
        []
    )

    # ========================================================
    # DRIFT
    # ========================================================

    monthly_drift = evolution.get(
        "monthly_drift",
        {}
    )

    drift_values = list(
        monthly_drift.values()
    )

    current_drift = 0

    if drift_values:

        current_drift = drift_values[-1]

    # ========================================================
    # RABBIT HOLES
    # ========================================================

    rabbit_holes = behavior.get(
        "rabbit_holes",
        []
    )

    # ========================================================
    # CONCENTRATION
    # ========================================================

    concentration = behavior.get(
        "interest_concentration",
        {}
    )

    events_raw = analysis.get("events", 0)
    if isinstance(events_raw, list):
        event_count = len(events_raw)
    elif isinstance(events_raw, (int, float)):
        event_count = int(events_raw)
    else:
        event_count = len(assignments)

    # ========================================================
    # FINAL DASHBOARD
    # ========================================================

    return {

        "cached": cached,

        # ----------------------------------------------------
        # KPI
        # ----------------------------------------------------

        "overview": {

            "events": event_count,

            "topics": topic_count,

            "clusters": analysis.get(
                "cluster_count",
                0
            ),

            "noise": analysis.get(
                "noise_count",
                0
            ),

            "dominant_topic":
                dominant_topic,

            "current_drift":
                current_drift,

        },

        # ----------------------------------------------------
        # TOP TOPICS
        # ----------------------------------------------------

        "top_topics": top_topics,

        # ----------------------------------------------------
        # INTEREST EVOLUTION
        # ----------------------------------------------------

        "evolution": {

            "monthly_proportions":
                evolution.get(
                    "monthly_proportions",
                    {}
                ),

            "momentum":
                evolution.get(
                    "momentum",
                    {}
                ),

            "rising": rising,

            "fading": fading,

            "emerging": emerging,

            "monthly_drift":
                monthly_drift,

        },

        # ----------------------------------------------------
        # BEHAVIOR
        # ----------------------------------------------------

        "behavior": {

            "time_of_day":
                behavior.get(
                    "time_of_day",
                    {}
                ),

            "day_of_week":
                behavior.get(
                    "day_of_week",
                    {}
                ),

            "topic_transitions":
                behavior.get(
                    "topic_transitions",
                    []
                ),

            "rabbit_holes":
                rabbit_holes,

            "interest_concentration":
                concentration,

        },

        # ----------------------------------------------------
        # VISUALIZATION DATA
        # ----------------------------------------------------

        "visualizations": {

            "interest_map":
                analysis.get(
                    "interest_map",
                    {}
                ),

            "interest_graph":
                analysis.get(
                    "interest_graph",
                    {}
                ),

        },

        # ----------------------------------------------------
        # RAW ASSIGNMENTS
        # ----------------------------------------------------

        "assignments": assignments,

    }


# ============================================================
# ANALYSIS HELPER
# ============================================================

def _load_user_analysis_and_events(user_id: int, source: str | None = None) -> tuple[dict, list]:
    db = SessionLocal()
    try:
        query = db.query(HistoryEvent).filter(HistoryEvent.user_id == user_id).order_by(HistoryEvent.timestamp.asc())
        if source:
            query = query.filter(HistoryEvent.source == source)
        events = query.limit(2500).all()
        db_count = len(events)
    finally:
        db.close()

    if not events:
        empty_analysis = build_interest_analysis([])
        return empty_analysis, []

    cached = get_cached_analysis(user_id=user_id, source=source)
    if cached and cached.get("analysis") and cached.get("event_count") == db_count:
        analysis = cached["analysis"]
        assignments = analysis.get("assignments") or analysis.get("events") or []
        if assignments:
            return analysis, assignments

    analysis = build_interest_analysis(events)
    save_analysis(user_id=user_id, source=source, event_count=len(events), analysis=analysis)
    assignments = analysis.get("assignments") or []
    return analysis, assignments


# ============================================================
# FEATURE 1: AI HISTORY CHAT ("ASK DRIFTER")
# ============================================================

class HistoryChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] | None = None
    source: str | None = None


@router.post("/chat")
def chat_with_history(
    payload: HistoryChatRequest,
    user_id: int = Depends(get_current_user_id),
):
    analysis, assignments = _load_user_analysis_and_events(user_id=user_id, source=payload.source)
    result = answer_history_chat(
        question=payload.message,
        chat_history=payload.history,
        events=assignments,
        analysis=analysis,
    )
    return result


# ============================================================
# FEATURE 2: "YEAR IN DRIFT" WRAPPED STORY RECAP
# ============================================================

@router.get("/wrapped")
def get_year_in_drift(
    source: str | None = None,
    user_id: int = Depends(get_current_user_id),
):
    analysis, assignments = _load_user_analysis_and_events(user_id=user_id, source=source)
    return generate_year_in_drift_report(
        events=assignments,
        analysis=analysis,
    )


# ============================================================
# FEATURE 3: NEXT INTEREST PREDICTOR
# ============================================================

@router.get("/predictions")
def get_interest_predictions(
    source: str | None = None,
    user_id: int = Depends(get_current_user_id),
):
    analysis, assignments = _load_user_analysis_and_events(user_id=user_id, source=source)
    return predict_next_interests(
        assignments=assignments,
        analysis=analysis,
    )


# ============================================================
# FEATURE 4: CROSS-PLATFORM CORRELATION (YOUTUBE X SPOTIFY)
# ============================================================

@router.get("/correlation")
def get_platform_correlation(
    user_id: int = Depends(get_current_user_id),
):
    # Cross platform must analyze without source filtering
    analysis, assignments = _load_user_analysis_and_events(user_id=user_id, source=None)
    return analyze_cross_platform_correlation(assignments=assignments)


# ============================================================
# FEATURE 5: SHAREABLE "INTEREST DNA" PROFILE
# ============================================================

@router.get("/dna")
def get_interest_dna_profile(
    source: str | None = None,
    user_id: int = Depends(get_current_user_id),
):
    analysis, assignments = _load_user_analysis_and_events(user_id=user_id, source=source)
    return generate_interest_dna(
        assignments=assignments,
        analysis=analysis,
    )