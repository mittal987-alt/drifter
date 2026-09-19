from collections import Counter, defaultdict
from datetime import datetime
from math import log2


def parse_timestamp(timestamp):
    if isinstance(timestamp, datetime):
        return timestamp
    if isinstance(timestamp, str):
        try:
            return datetime.fromisoformat(
                timestamp.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        except Exception:
            pass
    return None


# ============================================================
# TIME OF DAY
# ============================================================

def get_time_of_day(hour: int):

    if 5 <= hour < 12:
        return "morning"

    if 12 <= hour < 17:
        return "afternoon"

    if 17 <= hour < 21:
        return "evening"

    return "night"


def analyze_time_of_day(assignments):

    result = defaultdict(Counter)

    for event in assignments:

        timestamp = parse_timestamp(
            event.get("timestamp")
        )

        if not timestamp:
            continue

        period = get_time_of_day(
            timestamp.hour
        )

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

        timestamp = parse_timestamp(
            event.get("timestamp")
        )

        if not timestamp:
            continue

        day = timestamp.strftime(
            "%A"
        )

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
        key=lambda x: parse_timestamp(x.get("timestamp")) or datetime.min
    )

    transitions = Counter()

    for previous, current in zip(
        events,
        events[1:]
    ):

        previous_time = parse_timestamp(
            previous.get("timestamp")
        )

        current_time = parse_timestamp(
            current.get("timestamp")
        )

        if not previous_time or not current_time:
            continue

        gap = (
            current_time
            - previous_time
        ).total_seconds() / 60

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
        key=lambda x: parse_timestamp(x.get("timestamp")) or datetime.min
    )

    sessions = []

    current_session = [
        events[0]
    ]

    for event in events[1:]:

        previous = current_session[-1]

        previous_time = parse_timestamp(
            previous.get("timestamp")
        )

        current_time = parse_timestamp(
            event.get("timestamp")
        )

        if not previous_time or not current_time:
            current_session = [event]
            continue

        gap = (
            current_time
            - previous_time
        ).total_seconds() / 60

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

        start = parse_timestamp(
            session[0].get("timestamp")
        ) or datetime.utcnow()

        end = parse_timestamp(
            session[-1].get("timestamp")
        ) or datetime.utcnow()

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
        event["topic"]
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
