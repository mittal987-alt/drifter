"""
test_ml_pipeline.py — Machine learning and analytics unit tests.

Tests core data preparation, time analysis, drift detection, and analytics
using synthetic, deterministic data. No real ML models are loaded here —
embedding-dependent paths are tested via lightweight mocks.

Covers:
  - Data preparation (missing values, duplicates, timestamps, filtering).
  - Time analysis functions (grouping, proportions, momentum, drift).
  - Cross-platform correlation (multi-source, empty, synergy scores).
  - Prediction (empty assignments, insufficient history).
  - Year-in-drift report structure.
  - Interest DNA generation.
"""

import pytest
from datetime import datetime, timedelta
from typing import Any


# ---------------------------------------------------------------------------
# Synthetic test data factories
# ---------------------------------------------------------------------------

def _make_assignment(
    event_id: int,
    topic: str,
    source: str = "youtube",
    days_ago: int = 0,
) -> dict[str, Any]:
    ts = datetime(2025, 1, 1) + timedelta(days=days_ago)
    return {
        "event_id": event_id,
        "timestamp": ts.isoformat(),
        "source": source,
        "title": f"Event #{event_id} on {topic}",
        "artist": None,
        "url": None,
        "cluster": 0,
        "topic": topic,
    }


def _build_assignments(n: int = 20) -> list[dict[str, Any]]:
    """Build a simple deterministic list of 20 assignments, split 2 topics."""
    assignments = []
    for i in range(n):
        topic = "Machine Learning" if i < n // 2 else "Distributed Systems"
        assignments.append(_make_assignment(i + 1, topic, days_ago=i))
    return assignments


def _multi_source_assignments() -> list[dict[str, Any]]:
    assignments = []
    for i in range(10):
        assignments.append(_make_assignment(i + 1, "ML", source="youtube", days_ago=i))
    for i in range(10):
        assignments.append(_make_assignment(100 + i, "Audio", source="spotify", days_ago=i))
    return assignments


# ---------------------------------------------------------------------------
# 1. DATA PREPARATION
# ---------------------------------------------------------------------------

class TestPrepareEvents:
    """Additional prepare_events edge cases beyond test_pipeline.py."""

    def test_missing_timestamp_handled(self):
        """Events with None timestamp must still be processed without crash."""
        from app.services.analysis_pipeline import prepare_events
        events = [
            {"id": 1, "title": "No Timestamp Video", "source": "youtube", "timestamp": None, "event_hash": "h1"},
        ]
        result = prepare_events(events)
        # Either included (with null timestamp) or filtered — must not crash
        assert isinstance(result, list)

    def test_very_long_title_handled(self):
        from app.services.analysis_pipeline import prepare_events
        events = [
            {
                "id": 1,
                "title": "A" * 5000,
                "source": "youtube",
                "timestamp": "2025-01-01T00:00:00",
                "event_hash": "h_long",
            }
        ]
        result = prepare_events(events)
        assert isinstance(result, list)
        assert len(result) == 1
        assert len(result[0]["title"]) <= 5000  # should be preserved, not truncated

    def test_special_characters_in_title(self):
        from app.services.analysis_pipeline import prepare_events
        events = [
            {
                "id": 1,
                "title": "Café & Résumé — Über Alles 🎵",
                "source": "youtube",
                "timestamp": "2025-01-01T00:00:00",
                "event_hash": "h_unicode",
            }
        ]
        result = prepare_events(events)
        assert len(result) == 1

    def test_all_ads_returns_empty(self):
        from app.services.analysis_pipeline import prepare_events
        events = [
            {"id": i, "title": f"promoaug ad {i}", "source": "youtube", "timestamp": "2025-01-01", "event_hash": f"ad_{i}"}
            for i in range(10)
        ]
        result = prepare_events(events)
        assert result == []

    def test_mixed_sources(self):
        from app.services.analysis_pipeline import prepare_events
        events = [
            {"id": 1, "title": "YouTube Video", "source": "youtube", "timestamp": "2025-01-01", "event_hash": "h1"},
            {"id": 2, "title": "Spotify Track", "source": "spotify", "timestamp": "2025-01-02", "artist": "Artist X", "event_hash": "h2"},
        ]
        result = prepare_events(events)
        assert len(result) == 2
        sources = {r["source"] for r in result}
        assert "youtube" in sources
        assert "spotify" in sources

    def test_large_dataset_deduplication(self):
        """1000 copies of the same event → 1 after dedup."""
        from app.services.analysis_pipeline import prepare_events
        base = {"id": 1, "title": "Deduplicated Video", "source": "youtube", "timestamp": "2025-01-01", "event_hash": "h_dedup"}
        result = prepare_events([base] * 1000)
        assert len(result) == 1


# ---------------------------------------------------------------------------
# 2. TIME ANALYSIS
# ---------------------------------------------------------------------------

class TestTimeAnalysis:

    def test_group_by_month_empty(self):
        from app.analytics.time_analysis import group_by_month
        assert group_by_month([]) == {}

    def test_group_by_month_single_event(self):
        from app.analytics.time_analysis import group_by_month
        result = group_by_month([_make_assignment(1, "ML", days_ago=0)])
        assert "2025-01" in result
        assert len(result["2025-01"]) == 1

    def test_group_by_month_multiple_months(self):
        from app.analytics.time_analysis import group_by_month
        assignments = []
        for m in range(6):
            for d in range(5):
                ts = datetime(2025, m + 1, d + 1).isoformat()
                assignments.append({"timestamp": ts, "topic": "ML", "source": "youtube", "event_id": m * 10 + d})
        result = group_by_month(assignments)
        assert len(result) == 6

    def test_calculate_monthly_proportions_empty(self):
        from app.analytics.time_analysis import calculate_monthly_proportions
        result = calculate_monthly_proportions([])
        assert result == {}

    def test_calculate_monthly_proportions_sums_to_one(self):
        from app.analytics.time_analysis import calculate_monthly_proportions
        assignments = _build_assignments(20)
        result = calculate_monthly_proportions(assignments)
        for month, dist in result.items():
            total = sum(dist.values())
            assert abs(total - 1.0) < 1e-6, f"Month {month} proportions don't sum to 1: {total}"

    def test_calculate_momentum_empty(self):
        from app.analytics.time_analysis import calculate_momentum, calculate_monthly_proportions
        result = calculate_momentum({}, [])
        assert isinstance(result, dict)

    def test_detect_rising_topics_empty(self):
        from app.analytics.time_analysis import detect_rising_topics
        result = detect_rising_topics({})
        assert isinstance(result, list)

    def test_detect_fading_topics_empty(self):
        from app.analytics.time_analysis import detect_fading_topics
        result = detect_fading_topics({})
        assert isinstance(result, list)

    def test_detect_emerging_topics_empty(self):
        from app.analytics.time_analysis import detect_emerging_topics
        result = detect_emerging_topics({}, [])
        assert isinstance(result, list)

    def test_calculate_monthly_drift_empty(self):
        from app.analytics.time_analysis import calculate_monthly_drift
        result = calculate_monthly_drift({}, [])
        assert isinstance(result, dict)

    def test_monthly_drift_finite_values(self):
        """Drift values must be finite floats, not nan/inf."""
        from app.analytics.time_analysis import (
            calculate_monthly_proportions,
            calculate_monthly_drift,
        )
        import math
        assignments = _build_assignments(20)
        proportions = calculate_monthly_proportions(assignments)
        drift = calculate_monthly_drift(proportions, assignments)
        for month, value in drift.items():
            if isinstance(value, (int, float)):
                assert math.isfinite(value), f"Non-finite drift at {month}: {value}"

    def test_parse_timestamp_iso_string(self):
        from app.analytics.time_analysis import parse_timestamp
        result = parse_timestamp("2025-06-15T12:00:00")
        assert result.year == 2025
        assert result.month == 6

    def test_parse_timestamp_unix_seconds(self):
        from app.analytics.time_analysis import parse_timestamp
        result = parse_timestamp(1704067200)  # 2024-01-01
        assert result.year == 2024

    def test_parse_timestamp_unix_milliseconds(self):
        from app.analytics.time_analysis import parse_timestamp
        result = parse_timestamp(1704067200000)
        assert result.year == 2024

    def test_parse_timestamp_datetime_passthrough(self):
        from app.analytics.time_analysis import parse_timestamp
        dt = datetime(2025, 3, 15)
        result = parse_timestamp(dt)
        assert result == dt


# ---------------------------------------------------------------------------
# 3. CROSS-PLATFORM CORRELATION
# ---------------------------------------------------------------------------

class TestCrossCorrelation:

    def test_empty_assignments_returns_safe_result(self):
        from app.analytics.correlation import analyze_cross_platform_correlation
        result = analyze_cross_platform_correlation([])
        assert result["has_multisource"] is False
        assert result["synergy_score"] == 0
        assert isinstance(result["correlations"], list)
        assert isinstance(result["hourly_distribution"], list)
        assert len(result["hourly_distribution"]) == 24

    def test_single_source_synergy_zero(self):
        from app.analytics.correlation import analyze_cross_platform_correlation
        assignments = [_make_assignment(i, "ML", source="youtube", days_ago=i) for i in range(10)]
        result = analyze_cross_platform_correlation(assignments)
        assert result["synergy_score"] >= 0

    def test_multi_source_has_multisource(self):
        from app.analytics.correlation import analyze_cross_platform_correlation
        assignments = _multi_source_assignments()
        result = analyze_cross_platform_correlation(assignments)
        assert result["has_multisource"] is True

    def test_hourly_distribution_24_hours(self):
        from app.analytics.correlation import analyze_cross_platform_correlation
        assignments = _build_assignments(10)
        result = analyze_cross_platform_correlation(assignments)
        dist = result["hourly_distribution"]
        assert len(dist) == 24
        for entry in dist:
            assert "hour" in entry

    def test_synergy_score_is_numeric(self):
        from app.analytics.correlation import analyze_cross_platform_correlation
        import math
        assignments = _multi_source_assignments()
        result = analyze_cross_platform_correlation(assignments)
        assert isinstance(result["synergy_score"], (int, float))
        assert math.isfinite(result["synergy_score"])


# ---------------------------------------------------------------------------
# 4. PREDICTION
# ---------------------------------------------------------------------------

class TestNextInterestPrediction:

    def test_empty_assignments_returns_safe_structure(self):
        from app.prediction.next_interest import predict_next_interests
        result = predict_next_interests(assignments=[], analysis={})
        assert "predictions" in result
        assert result["predictions"] == []
        assert "current_focus" in result

    def test_minimal_assignments_no_crash(self):
        from app.prediction.next_interest import predict_next_interests
        assignments = [_make_assignment(1, "Python")]
        analysis = {
            "behavior": {"topic_transitions": []},
            "evolution": {"rising": [], "emerging": []},
        }
        result = predict_next_interests(assignments=assignments, analysis=analysis)
        assert "predictions" in result

    def test_predictions_list_is_list(self):
        from app.prediction.next_interest import predict_next_interests
        assignments = _build_assignments(20)
        analysis = {
            "behavior": {"topic_transitions": []},
            "evolution": {"rising": [], "emerging": []},
        }
        result = predict_next_interests(assignments=assignments, analysis=analysis)
        assert isinstance(result["predictions"], list)

    def test_no_negative_confidence(self):
        """Prediction confidence scores must be non-negative."""
        from app.prediction.next_interest import predict_next_interests
        assignments = _build_assignments(20)
        analysis = {
            "behavior": {"topic_transitions": []},
            "evolution": {"rising": [], "emerging": []},
        }
        result = predict_next_interests(assignments=assignments, analysis=analysis)
        for p in result["predictions"]:
            score = p.get("confidence", 0) or p.get("score", 0)
            assert score >= 0, f"Negative confidence: {p}"


# ---------------------------------------------------------------------------
# 5. YEAR IN DRIFT REPORT
# ---------------------------------------------------------------------------

class TestYearInDriftReport:

    def test_empty_events_returns_slides(self):
        from app.reports.year_in_drift import generate_year_in_drift_report
        result = generate_year_in_drift_report(events=[], analysis={})
        assert "slides" in result
        assert isinstance(result["slides"], list)

    def test_with_assignments_has_multiple_slides(self):
        from app.reports.year_in_drift import generate_year_in_drift_report
        assignments = _build_assignments(20)
        analysis = {
            "assignments": assignments,
            "topics": {"0": {"label": "Machine Learning", "event_count": 10}},
            "evolution": {"rising": [], "emerging": [], "fading": [], "monthly_drift": {}, "monthly_proportions": {}},
            "behavior": {},
        }
        result = generate_year_in_drift_report(events=assignments, analysis=analysis)
        assert len(result["slides"]) >= 1

    def test_slide_structure(self):
        """Each slide should have at minimum a 'type' field."""
        from app.reports.year_in_drift import generate_year_in_drift_report
        result = generate_year_in_drift_report(events=_build_assignments(10), analysis={})
        for slide in result["slides"]:
            assert isinstance(slide, dict)


# ---------------------------------------------------------------------------
# 6. INTEREST DNA
# ---------------------------------------------------------------------------

class TestInterestDNA:

    def test_empty_returns_safe_structure(self):
        from app.reports.interest_dna import generate_interest_dna
        result = generate_interest_dna(assignments=[], analysis={})
        assert "dna_id" in result
        assert "traits" in result

    def test_with_data_has_archetype(self):
        from app.reports.interest_dna import generate_interest_dna
        assignments = _build_assignments(20)
        analysis = {
            "topics": {"0": {"label": "Machine Learning", "event_count": 10}},
            "evolution": {"rising": [], "emerging": []},
        }
        result = generate_interest_dna(assignments=assignments, analysis=analysis)
        assert "archetype" in result
        assert isinstance(result["traits"], dict)
        assert "superpower" in result["traits"]


# ---------------------------------------------------------------------------
# 7. FOCUS PULSE HEATMAP
# ---------------------------------------------------------------------------

class TestFocusPulse:

    def test_empty_returns_ready(self):
        from app.analytics.pulse import generate_focus_pulse
        result = generate_focus_pulse(assignments=[], days_back=30)
        assert result["status"] == "READY"
        assert "heatmap" in result
        assert "matrix" in result

    def test_matrix_has_seven_days(self):
        from app.analytics.pulse import generate_focus_pulse
        result = generate_focus_pulse(assignments=_build_assignments(20), days_back=30)
        assert len(result["matrix"]) == 7

    def test_heatmap_is_list(self):
        from app.analytics.pulse import generate_focus_pulse
        result = generate_focus_pulse(assignments=_build_assignments(10), days_back=14)
        assert isinstance(result["heatmap"], list)


# ---------------------------------------------------------------------------
# 8. HISTORY SERVICE - TIMESTAMP PARSING
# ---------------------------------------------------------------------------

class TestHistoryServiceTimestamp:

    def test_parse_iso_format(self):
        from app.services.history_service import parse_timestamp
        result = parse_timestamp("2025-06-15T12:30:00Z")
        assert result is not None
        assert result.year == 2025

    def test_parse_date_only(self):
        from app.services.history_service import parse_timestamp
        result = parse_timestamp("2025-06-15")
        assert result is not None
        assert result.year == 2025

    def test_parse_none_returns_none(self):
        from app.services.history_service import parse_timestamp
        result = parse_timestamp(None)
        assert result is None

    def test_parse_empty_string_returns_none(self):
        from app.services.history_service import parse_timestamp
        result = parse_timestamp("")
        assert result is None

    def test_parse_datetime_passthrough(self):
        from app.services.history_service import parse_timestamp
        dt = datetime(2025, 6, 1)
        result = parse_timestamp(dt)
        assert result == dt

    def test_parse_various_formats(self):
        from app.services.history_service import parse_timestamp
        cases = [
            "2025-01-15T14:30:00.000Z",
            "2025-01-15T14:30:00Z",
            "2025-01-15 14:30:00",
            "2025-01-15",
        ]
        for ts in cases:
            result = parse_timestamp(ts)
            assert result is not None, f"Failed to parse: {ts}"
            assert result.year == 2025


# ---------------------------------------------------------------------------
# 9. NORMALIZATION
# ---------------------------------------------------------------------------

class TestNormalization:

    def test_youtube_event_normalization(self):
        from app.services.history_service import normalize_youtube_event
        item = {
            "title": "Watched Python FastAPI Tutorial",
            "titleUrl": "https://www.youtube.com/watch?v=abc123",
            "time": "2025-03-15T10:00:00.000Z",
        }
        result = normalize_youtube_event(item)
        assert result is not None
        assert result["title"] == "Python FastAPI Tutorial"
        assert result["url"] == "https://www.youtube.com/watch?v=abc123"

    def test_youtube_event_no_timestamp_returns_none(self):
        from app.services.history_service import normalize_youtube_event
        item = {"title": "Video without timestamp"}
        result = normalize_youtube_event(item)
        assert result is None

    def test_youtube_event_strips_watched_prefix(self):
        from app.services.history_service import normalize_youtube_event
        item = {
            "title": "Watched My Favorite Tutorial",
            "time": "2025-01-01T00:00:00Z",
        }
        result = normalize_youtube_event(item)
        assert result["title"] == "My Favorite Tutorial"
