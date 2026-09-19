from collections import defaultdict
from datetime import datetime

import numpy as np
from scipy.spatial.distance import jensenshannon


# ============================================================
# HELPERS
# ============================================================

def parse_timestamp(timestamp):
    """
    Convert timestamp into a datetime object.

    Supports:
    - datetime
    - ISO timestamp string
    """

    if isinstance(timestamp, datetime):
        return timestamp

    if isinstance(timestamp, str):
        return datetime.fromisoformat(
            timestamp.replace("Z", "+00:00")
        )

    raise ValueError(
        f"Unsupported timestamp type: {type(timestamp)}"
    )


def get_month(timestamp):
    """
    Convert timestamp to YYYY-MM.
    """

    timestamp = parse_timestamp(timestamp)

    return timestamp.strftime("%Y-%m")


# ============================================================
# GROUP EVENTS BY MONTH
# ============================================================

def group_by_month(assignments):
    """
    Group assignment records by month.
    """

    monthly = defaultdict(list)

    for item in assignments:

        month = get_month(
            item["timestamp"]
        )

        monthly[month].append(item)

    return dict(
        sorted(monthly.items())
    )


# ============================================================
# MONTHLY TOPIC COUNTS
# ============================================================

def calculate_monthly_topic_counts(
    assignments
):
    """
    Calculate how many events belong to each
    topic for every month.
    """

    monthly = group_by_month(
        assignments
    )

    result = {}

    for month, events in monthly.items():

        counts = defaultdict(int)

        for event in events:

            topic = event.get(
                "topic",
                "Other"
            )

            counts[topic] += 1

        result[month] = dict(counts)

    return result


# ============================================================
# MONTHLY TOPIC PROPORTIONS
# ============================================================

def calculate_topic_proportions(
    assignments
):
    """
    Convert monthly topic counts into proportions.

    Example:

    {
        "2026-01": {
            "Programming": 0.60,
            "Gaming": 0.40
        }
    }
    """

    monthly_counts = (
        calculate_monthly_topic_counts(
            assignments
        )
    )

    result = {}

    for month, counts in monthly_counts.items():

        total = sum(
            counts.values()
        )

        if total == 0:
            continue

        result[month] = {
            topic: count / total
            for topic, count
            in counts.items()
        }

    return result


# ============================================================
# ALIAS
# ============================================================

def calculate_monthly_proportions(
    assignments
):
    """
    Compatibility wrapper used by analytics_service.py.
    """

    return calculate_topic_proportions(
        assignments
    )


# ============================================================
# TOPIC MOMENTUM
# ============================================================

def calculate_topic_momentum(
    monthly_proportions
):
    """
    Compare the latest month with the previous month.

    Positive value = rising
    Negative value = fading
    """

    months = sorted(
        monthly_proportions.keys()
    )

    if len(months) < 2:
        return {}

    current = monthly_proportions[
        months[-1]
    ]

    previous = monthly_proportions[
        months[-2]
    ]

    topics = (
        set(current)
        | set(previous)
    )

    momentum = {}

    for topic in topics:

        current_value = current.get(
            topic,
            0.0
        )

        previous_value = previous.get(
            topic,
            0.0
        )

        momentum[topic] = (
            current_value
            - previous_value
        )

    return dict(
        sorted(
            momentum.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    )


# ============================================================
# ALIAS
# ============================================================

def calculate_momentum(
    monthly_proportions
):
    """
    Compatibility wrapper used by analytics_service.py.
    """

    return calculate_topic_momentum(
        monthly_proportions
    )


# ============================================================
# RISING INTERESTS
# ============================================================

def get_rising_interests(
    momentum,
    threshold=0.03,
):
    """
    Topics whose share increased by at least
    the threshold.
    """

    return [
        {
            "topic": topic,
            "change": round(
                change,
                4,
            ),
        }
        for topic, change
        in momentum.items()
        if change >= threshold
    ]


# ============================================================
# ALIAS
# ============================================================

def detect_rising_topics(
    momentum,
    threshold=0.03,
):
    """
    Compatibility wrapper.
    """

    return get_rising_interests(
        momentum,
        threshold,
    )


# ============================================================
# FADING INTERESTS
# ============================================================

def get_fading_interests(
    momentum,
    threshold=-0.03,
):
    """
    Topics whose share decreased by at least
    the threshold.
    """

    return [
        {
            "topic": topic,
            "change": round(
                change,
                4,
            ),
        }
        for topic, change
        in momentum.items()
        if change <= threshold
    ]


# ============================================================
# ALIAS
# ============================================================

def detect_fading_topics(
    momentum,
    threshold=-0.03,
):
    """
    Compatibility wrapper.
    """

    return get_fading_interests(
        momentum,
        threshold,
    )


# ============================================================
# EMERGING INTERESTS
# ============================================================

def get_emerging_interests(
    monthly_proportions,
    minimum_share=0.03,
):
    """
    Detect topics that appear in the latest month
    but did not exist in the previous month.
    """

    months = sorted(
        monthly_proportions.keys()
    )

    if len(months) < 2:
        return []

    current = monthly_proportions[
        months[-1]
    ]

    previous = monthly_proportions[
        months[-2]
    ]

    emerging = []

    for topic, value in current.items():

        if (
            value >= minimum_share
            and topic not in previous
        ):
            emerging.append(
                {
                    "topic": topic,
                    "share": round(
                        value,
                        4,
                    ),
                }
            )

    return sorted(
        emerging,
        key=lambda item: item["share"],
        reverse=True,
    )


# ============================================================
# ALIAS
# ============================================================

def detect_emerging_topics(
    monthly_proportions,
    minimum_share=0.03,
):
    """
    Compatibility wrapper.
    """

    return get_emerging_interests(
        monthly_proportions,
        minimum_share,
    )


# ============================================================
# JENSEN-SHANNON DRIFT
# ============================================================

def calculate_drift_score(
    previous_distribution,
    current_distribution,
):
    """
    Calculate Jensen-Shannon divergence between
    two topic distributions.

    Result:

    0.0 = very similar
    1.0 = maximally different

    With base=2.
    """

    topics = sorted(
        set(previous_distribution)
        | set(current_distribution)
    )

    if not topics:
        return 0.0

    previous = np.array(
        [
            previous_distribution.get(
                topic,
                0.0,
            )
            for topic in topics
        ],
        dtype=float,
    )

    current = np.array(
        [
            current_distribution.get(
                topic,
                0.0,
            )
            for topic in topics
        ],
        dtype=float,
    )

    # --------------------------------------------------------
    # Avoid zero probability issues
    # --------------------------------------------------------

    epsilon = 1e-10

    previous += epsilon
    current += epsilon

    # --------------------------------------------------------
    # Normalize
    # --------------------------------------------------------

    previous /= previous.sum()
    current /= current.sum()

    # --------------------------------------------------------
    # Jensen-Shannon distance
    # --------------------------------------------------------

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
    monthly_proportions,
):
    """
    Calculate drift between every consecutive month.

    Example:

    {
        "2026-02": 0.12,
        "2026-03": 0.41,
        "2026-04": 0.18
    }
    """

    months = sorted(
        monthly_proportions.keys()
    )

    drift = {}

    if len(months) < 2:
        return drift

    for index in range(
        1,
        len(months),
    ):

        previous_month = months[
            index - 1
        ]

        current_month = months[
            index
        ]

        score = calculate_drift_score(
            monthly_proportions[
                previous_month
            ],
            monthly_proportions[
                current_month
            ],
        )

        drift[current_month] = round(
            score,
            4,
        )

    return drift