from collections import defaultdict
from datetime import datetime
from typing import Any

import numpy as np
from scipy.spatial.distance import jensenshannon


# ============================================================
# HELPERS
# ============================================================

def parse_timestamp(timestamp: Any) -> datetime:
    """
    Convert timestamp into a datetime object.

    Supports:
    - datetime
    - ISO timestamp string
    - Unix epoch (seconds or milliseconds)
    - Common date/time strings
    """
    if isinstance(timestamp, datetime):
        return timestamp

    if isinstance(timestamp, (int, float)):
        if timestamp > 1e11:
            return datetime.utcfromtimestamp(timestamp / 1000.0)
        return datetime.utcfromtimestamp(timestamp)

    if isinstance(timestamp, str):
        cleaned = timestamp.replace("Z", "+00:00").replace("/", "-").strip()
        try:
            return datetime.fromisoformat(cleaned)
        except Exception:
            pass
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y",
        ):
            try:
                return datetime.strptime(cleaned.split("+")[0].strip(), fmt)
            except Exception:
                continue

    return datetime.utcnow()


def get_month(timestamp: Any) -> str:
    """
    Convert timestamp to YYYY-MM.
    """
    dt = parse_timestamp(timestamp)
    return dt.strftime("%Y-%m")


# ============================================================
# GROUP EVENTS BY MONTH
# ============================================================

def group_by_month(assignments: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Group assignment records by month.
    """
    monthly = defaultdict(list)

    for item in assignments:
        month = get_month(item.get("timestamp"))
        monthly[month].append(item)

    return dict(sorted(monthly.items()))


# ============================================================
# MONTHLY TOPIC COUNTS
# ============================================================

def calculate_monthly_topic_counts(assignments: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    """
    Calculate how many events belong to each topic for every month.
    """
    monthly = group_by_month(assignments)
    result = {}

    for month, events in monthly.items():
        counts = defaultdict(int)
        for event in events:
            topic = event.get("topic", "Other")
            counts[topic] += 1
        result[month] = dict(counts)

    return result


# ============================================================
# MONTHLY TOPIC PROPORTIONS
# ============================================================

def calculate_topic_proportions(assignments: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """
    Convert monthly topic counts into normalized proportions.
    """
    monthly_counts = calculate_monthly_topic_counts(assignments)
    result = {}

    for month, counts in monthly_counts.items():
        total = sum(counts.values())
        if total == 0:
            continue
        result[month] = {
            topic: count / total
            for topic, count in counts.items()
        }

    return result


def calculate_monthly_proportions(assignments: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """
    Compatibility wrapper used by analytics_service.py and analysis_pipeline.py.
    """
    return calculate_topic_proportions(assignments)


# ============================================================
# JENSEN-SHANNON DRIFT
# ============================================================

def calculate_drift_score(
    previous_distribution: dict[str, float],
    current_distribution: dict[str, float],
) -> float:
    """
    Calculate Jensen-Shannon divergence between two topic distributions.

    Result:
    0.0 = identical
    1.0 = maximally different
    """
    topics = sorted(
        set(previous_distribution) | set(current_distribution)
    )

    if not topics:
        return 0.0

    previous = np.array(
        [previous_distribution.get(topic, 0.0) for topic in topics],
        dtype=float,
    )

    current = np.array(
        [current_distribution.get(topic, 0.0) for topic in topics],
        dtype=float,
    )

    epsilon = 1e-10
    previous += epsilon
    current += epsilon

    previous /= previous.sum()
    current /= current.sum()

    distance = jensenshannon(
        previous,
        current,
        base=2,
    )

    if np.isnan(distance):
        return 0.0

    return float(distance)


# ============================================================
# MONTHLY DRIFT
# ============================================================

def calculate_monthly_drift(
    monthly_proportions: dict[str, dict[str, float]],
    assignments: list[dict[str, Any]] | None = None,
) -> dict[str, float]:
    """
    Calculate drift between consecutive time periods.
    - If multiple months exist: calculate month-over-month Jensen-Shannon divergence.
    - If single month or short history: divide chronological events into baseline vs recent
      slices to measure intra-period drift accurately.
    """
    months = sorted(monthly_proportions.keys())
    drift: dict[str, float] = {}

    if len(months) >= 2:
        for index in range(1, len(months)):
            previous_month = months[index - 1]
            current_month = months[index]
            score = calculate_drift_score(
                monthly_proportions[previous_month],
                monthly_proportions[current_month],
            )
            drift[current_month] = round(score, 4)
        return drift

    # Single month or <= 1 month available: compute chronological baseline vs recent drift
    if assignments and len(assignments) >= 2:
        try:
            sorted_events = sorted(
                assignments,
                key=lambda x: parse_timestamp(x.get("timestamp"))
            )
        except Exception:
            sorted_events = assignments

        mid = max(1, len(sorted_events) // 2)
        early_events = sorted_events[:mid]
        recent_events = sorted_events[mid:]

        early_counts = defaultdict(int)
        for e in early_events:
            early_counts[e.get("topic", "Other")] += 1
        early_total = sum(early_counts.values()) or 1
        p_early = {t: c / early_total for t, c in early_counts.items()}

        recent_counts = defaultdict(int)
        for e in recent_events:
            recent_counts[e.get("topic", "Other")] += 1
        recent_total = sum(recent_counts.values()) or 1
        p_recent = {t: c / recent_total for t, c in recent_counts.items()}

        score = calculate_drift_score(p_early, p_recent)
        period_key = months[0] if months else "Current"
        drift[period_key] = round(score, 4)
    elif months:
        drift[months[0]] = 0.0

    return drift


# ============================================================
# TOPIC MOMENTUM
# ============================================================

def calculate_topic_momentum(
    monthly_proportions: dict[str, dict[str, float]],
    assignments: list[dict[str, Any]] | None = None,
) -> dict[str, float]:
    """
    Compare the latest period with the previous period.
    Positive value = rising
    Negative value = fading
    """
    months = sorted(monthly_proportions.keys())

    if len(months) >= 2:
        current = monthly_proportions[months[-1]]
        previous = monthly_proportions[months[-2]]
        topics = set(current) | set(previous)
        momentum = {}
        for topic in topics:
            current_value = current.get(topic, 0.0)
            previous_value = previous.get(topic, 0.0)
            momentum[topic] = current_value - previous_value
        return dict(
            sorted(
                momentum.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        )

    # Single month: compare chronological early half with recent half
    if assignments and len(assignments) >= 2:
        try:
            sorted_events = sorted(
                assignments,
                key=lambda x: parse_timestamp(x.get("timestamp"))
            )
        except Exception:
            sorted_events = assignments

        mid = max(1, len(sorted_events) // 2)
        early_events = sorted_events[:mid]
        recent_events = sorted_events[mid:]

        early_counts = defaultdict(int)
        for e in early_events:
            early_counts[e.get("topic", "Other")] += 1
        early_total = sum(early_counts.values()) or 1
        p_early = {t: c / early_total for t, c in early_counts.items()}

        recent_counts = defaultdict(int)
        for e in recent_events:
            recent_counts[e.get("topic", "Other")] += 1
        recent_total = sum(recent_counts.values()) or 1
        p_recent = {t: c / recent_total for t, c in recent_counts.items()}

        topics = set(p_early) | set(p_recent)
        momentum = {}
        for topic in topics:
            momentum[topic] = p_recent.get(topic, 0.0) - p_early.get(topic, 0.0)
        return dict(
            sorted(
                momentum.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        )

    if months and months[0] in monthly_proportions:
        return {t: 0.0 for t in monthly_proportions[months[0]]}

    return {}


def calculate_momentum(
    monthly_proportions: dict[str, dict[str, float]],
    assignments: list[dict[str, Any]] | None = None,
) -> dict[str, float]:
    """
    Compatibility wrapper.
    """
    return calculate_topic_momentum(monthly_proportions, assignments)


# ============================================================
# RISING INTERESTS
# ============================================================

def get_rising_interests(
    momentum: dict[str, float],
    threshold: float = 0.03,
) -> list[dict[str, Any]]:
    """
    Topics whose share increased by at least the threshold.
    """
    return [
        {
            "topic": topic,
            "change": round(change, 4),
        }
        for topic, change in momentum.items()
        if change >= threshold and topic not in ("Other", "Unassigned", "Unknown")
    ]


def detect_rising_topics(
    momentum: dict[str, float],
    threshold: float = 0.03,
) -> list[dict[str, Any]]:
    """
    Compatibility wrapper.
    """
    return get_rising_interests(momentum, threshold)


# ============================================================
# FADING INTERESTS
# ============================================================

def get_fading_interests(
    momentum: dict[str, float],
    threshold: float = -0.03,
) -> list[dict[str, Any]]:
    """
    Topics whose share decreased by at least the threshold.
    """
    return [
        {
            "topic": topic,
            "change": round(change, 4),
        }
        for topic, change in momentum.items()
        if change <= threshold and topic not in ("Other", "Unassigned", "Unknown")
    ]


def detect_fading_topics(
    momentum: dict[str, float],
    threshold: float = -0.03,
) -> list[dict[str, Any]]:
    """
    Compatibility wrapper.
    """
    return get_fading_interests(momentum, threshold)


# ============================================================
# EMERGING INTERESTS
# ============================================================

def get_emerging_interests(
    monthly_proportions: dict[str, dict[str, float]],
    assignments: list[dict[str, Any]] | None = None,
    minimum_share: float = 0.03,
) -> list[dict[str, Any]]:
    """
    Detect topics that represent new directions in recent attention:
    - Multi-month: topics appearing in current month absent in previous, or surging topics.
    - Single-month: topics appearing in recent chronological activity.
    """
    months = sorted(monthly_proportions.keys())

    if not months:
        if assignments:
            counts = defaultdict(int)
            for e in assignments:
                t = e.get("topic", "Other")
                if t not in ("Other", "Unassigned", "Unknown"):
                    counts[t] += 1
            total = sum(counts.values()) or 1
            return [
                {"topic": t, "share": round(c / total, 4)}
                for t, c in sorted(counts.items(), key=lambda x: x[1], reverse=True)
            ]
        return []

    current = monthly_proportions[months[-1]]

    # Case A: Multi-month history (>= 2 months)
    if len(months) >= 2:
        previous = monthly_proportions[months[-2]]
        emerging = []
        for topic, value in current.items():
            if topic in ("Other", "Unassigned", "Unknown"):
                continue
            if value >= minimum_share and topic not in previous:
                emerging.append({
                    "topic": topic,
                    "share": round(value, 4),
                })
        # If no brand new topics appeared, check for high surge topics (grew >= 8% share)
        if not emerging:
            for topic, value in current.items():
                if topic in ("Other", "Unassigned", "Unknown"):
                    continue
                prev_val = previous.get(topic, 0.0)
                if (value - prev_val) >= 0.08 and value >= minimum_share:
                    emerging.append({
                        "topic": topic,
                        "share": round(value, 4),
                    })
        return sorted(emerging, key=lambda item: item["share"], reverse=True)

    # Case B: Single-month history with chronological assignments
    if assignments and len(assignments) >= 2:
        try:
            sorted_events = sorted(
                assignments,
                key=lambda x: parse_timestamp(x.get("timestamp"))
            )
        except Exception:
            sorted_events = assignments

        mid = max(1, len(sorted_events) // 2)
        early_events = sorted_events[:mid]
        recent_events = sorted_events[mid:]

        early_topics = set(
            e.get("topic") for e in early_events
            if e.get("topic") and e.get("topic") not in ("Other", "Unassigned", "Unknown")
        )
        recent_counts = defaultdict(int)
        for e in recent_events:
            t = e.get("topic", "Other")
            if t not in ("Other", "Unassigned", "Unknown"):
                recent_counts[t] += 1
        recent_total = sum(recent_counts.values()) or 1

        emerging = []
        for t, c in recent_counts.items():
            share = c / recent_total
            if share >= minimum_share and t not in early_topics:
                emerging.append({"topic": t, "share": round(share, 4)})

        if emerging:
            return sorted(emerging, key=lambda item: item["share"], reverse=True)

    # Single-month fallback: all discovered non-Other topics in current distribution
    emerging = [
        {
            "topic": topic,
            "share": round(value, 4),
        }
        for topic, value in current.items()
        if value >= minimum_share and topic not in ("Other", "Unassigned", "Unknown")
    ]
    return sorted(emerging, key=lambda item: item["share"], reverse=True)


def detect_emerging_topics(
    monthly_proportions: dict[str, dict[str, float]],
    assignments: list[dict[str, Any]] | None = None,
    minimum_share: float = 0.03,
) -> list[dict[str, Any]]:
    """
    Compatibility wrapper.
    """
    return get_emerging_interests(monthly_proportions, assignments, minimum_share)