from collections import Counter, defaultdict
from datetime import datetime
from math import log2

from app.reports.utils import parse_ts


# ============================================================
# TIME OF DAY
# ============================================================

def get_time_of_day(hour: int) -> str:
    """Map an hour (0-23) to a named time block.

    Boundaries are consistent with pulse.py and the nocturnal ratio
    used in year_in_drift.py / interest_dna.py (night = 23:00 - 04:59).
    """
    if 5 <= hour < 12:
        return "morning"

    if 12 <= hour < 17:
        return "afternoon"

    if 17 <= hour < 23:  # Fix #4: was < 21, now < 23
        return "evening"

    return "night"


def analyze_time_of_day(assignments):

    result = defaultdict(Counter)

    for event in assignments:

        ts = parse_ts(event.get("timestamp"))

        if not ts:
            continue

        period = get_time_of_day(ts.hour)

        topic = event.get("topic", "Other")

        result[period][topic] += 1

    return {
        period: dict(
            sorted(
                topics.items(),
                key=lambda x: x[1],
                reverse=True
            )
        )

        for period, topics
        in result.items()
    }


# ============================================================
# DAY OF WEEK
# ============================================================

def analyze_day_of_week(assignments):

    result = defaultdict(Counter)

    for event in assignments:

        ts = parse_ts(event.get("timestamp"))

        if not ts:
            continue

        day = ts.strftime("%A")

        topic = event.get("topic", "Other")

        result[day][topic] += 1

    return {
        day: dict(topics)

        for day, topics
        in result.items()
    }


# ============================================================
# TOPIC TRANSITIONS
# ============================================================

def analyze_topic_transitions(
    assignments,
    max_gap_minutes=60,
):

    if len(assignments) < 2:
        return []

    events = sorted(
        assignments,
        key=lambda x: parse_ts(x.get("timestamp")) or datetime.min
    )

    transitions = Counter()

    for previous, current in zip(
        events,
        events[1:]
    ):

        previous_time = parse_ts(previous.get("timestamp"))
        current_time = parse_ts(current.get("timestamp"))

        if not previous_time or not current_time:
            continue

        gap = (
            current_time
            - previous_time
        ).total_seconds() / 60

        # Fix #2: skip pairs where timestamps are inverted or both failed to parse
        # (both None sort to datetime.min, producing gap=0 which would be silently accepted)
        if gap < 0:
            continue

        if gap > max_gap_minutes:
            continue

        previous_topic = previous.get("topic", "Other")
        current_topic = current.get("topic", "Other")

        if previous_topic == current_topic:
            continue

        transitions[
            (
                previous_topic,
                current_topic
            )
        ] += 1

    result = []

    for (
        source,
        target
    ), count in transitions.most_common():

        result.append({
            "source": source,
            "target": target,
            "count": count,
        })

    return result


# ============================================================
# RABBIT HOLES
# ============================================================

def detect_rabbit_holes(
    assignments,
    session_gap_minutes=45,
    minimum_events=4,
):

    if not assignments:
        return []

    events = sorted(
        assignments,
        key=lambda x: parse_ts(x.get("timestamp")) or datetime.min
    )

    sessions = []

    current_session = [
        events[0]
    ]

    for event in events[1:]:

        previous = current_session[-1]

        previous_time = parse_ts(previous.get("timestamp"))
        current_time = parse_ts(event.get("timestamp"))

        if not previous_time or not current_time:
            # Fix #6: skip unparseable pair without destroying the accumulated session
            continue

        gap = (
            current_time
            - previous_time
        ).total_seconds() / 60

        # Fix #2: skip pairs where timestamps are inverted or both failed to parse
        if gap < 0:
            continue

        if gap <= session_gap_minutes:

            current_session.append(
                event
            )

        else:

            if len(current_session) >= minimum_events:

                sessions.append(
                    current_session
                )

            current_session = [
                event
            ]

    if len(current_session) >= minimum_events:

        sessions.append(
            current_session
        )

    rabbit_holes = []

    for session in sessions:

        topics = Counter(
            event.get("topic", "Other")
            for event in session
        )

        start = parse_ts(session[0].get("timestamp"))
        end = parse_ts(session[-1].get("timestamp"))

        # Skip session if boundary timestamps can't be parsed (avoids fabricated durations)
        if not start or not end:
            continue

        duration_minutes = (
            end - start
        ).total_seconds() / 60

        dominant_topic, count = (
            topics.most_common(1)[0]
        )

        rabbit_holes.append({

            "start": (
                start.isoformat()
            ),

            "end": (
                end.isoformat()
            ),

            "duration_minutes": round(
                duration_minutes,
                2
            ),

            "event_count": len(
                session
            ),

            "dominant_topic":
                dominant_topic,

            "topic_count":
                len(topics),

            "events": [
                {
                    "title": e.get("title") or "Untitled",
                    "source": e.get("source") or "unknown",
                    "timestamp": (parse_ts(e.get("timestamp")) or datetime.min).isoformat(),
                    "topic": e.get("topic") or "Other",
                    "artist": e.get("artist"),
                    "url": e.get("url"),
                }
                for e in session
            ],
        })

    return sorted(
        rabbit_holes,
        key=lambda x: x["event_count"],
        reverse=True
    )


# ============================================================
# TOPIC ENTROPY
# ============================================================

def calculate_entropy(
    topic_counts
):

    total = sum(
        topic_counts.values()
    )

    if total == 0:
        return 0.0

    entropy = 0.0

    for count in topic_counts.values():

        probability = (
            count / total
        )

        if probability > 0:

            entropy -= (
                probability
                * log2(probability)
            )

    return entropy


# ============================================================
# INTEREST CONCENTRATION
# ============================================================

def calculate_interest_concentration(
    assignments
):

    counts = Counter(
        event.get("topic", "Other")
        for event in assignments
    )

    total = sum(
        counts.values()
    )

    if total == 0:

        return {
            "entropy": 0,
            "topic_count": 0,
            "dominant_topic": None,
            "dominant_share": 0,
        }

    entropy = calculate_entropy(
        counts
    )

    dominant_topic, dominant_count = (
        counts.most_common(1)[0]
    )

    dominant_share = (
        dominant_count / total
    )

    return {

        "entropy": round(
            entropy,
            4
        ),

        "topic_count": len(
            counts
        ),

        "dominant_topic":
            dominant_topic,

        "dominant_share": round(
            dominant_share,
            4
        ),
    }


# ============================================================
# FULL BEHAVIOR ANALYSIS
# ============================================================

def build_behavior_analysis(
    assignments
):

    return {

        "time_of_day":
            analyze_time_of_day(
                assignments
            ),

        "day_of_week":
            analyze_day_of_week(
                assignments
            ),

        "topic_transitions":
            analyze_topic_transitions(
                assignments
            ),

        "rabbit_holes":
            detect_rabbit_holes(
                assignments
            ),

        "interest_concentration":
            calculate_interest_concentration(
                assignments
            ),
    }


# Pipeline compatibility alias
analyze_behavior = build_behavior_analysis
