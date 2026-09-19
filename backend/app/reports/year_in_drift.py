from collections import Counter
from datetime import datetime
from typing import Any


def _parse_ts(ts: Any) -> datetime | None:
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def generate_year_in_drift_report(
    events: list[dict[str, Any]],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate an interactive 5-slide 'Spotify Wrapped'-style recap for personal
    interest evolution and digital attention drift.
    """
    assignments = analysis.get("assignments") or events
    total_events = len(assignments)
    evolution = analysis.get("evolution", {})
    behavior = analysis.get("behavior", {})

    # 1. Total active days & sources
    active_days: set[str] = set()
    sources: Counter = Counter()
    topic_counts: Counter = Counter()

    for ev in assignments:
        ts = _parse_ts(ev.get("timestamp"))
        if ts:
            active_days.add(ts.strftime("%Y-%m-%d"))
        sources[ev.get("source", "unknown")] += 1
        topic_counts[ev.get("topic", "Other")] += 1

    num_unique_topics = len(topic_counts)  # int — number of distinct interest clusters

    # Meaningful topics (exclude unclustered noise "Other")
    meaningful_topics = [
        {
            "topic": topic,
            "count": count,
            "share": round(count / max(total_events, 1), 3),
        }
        for topic, count in topic_counts.most_common()
        if topic != "Other"
    ]

    top_topics = meaningful_topics[:5] if meaningful_topics else [
        {
            "topic": topic,
            "count": count,
            "share": round(count / max(total_events, 1), 3),
        }
        for topic, count in topic_counts.most_common(5)
    ]
    dominant_topic = top_topics[0]["topic"] if top_topics else "General Exploration"
    dominant_share = int(top_topics[0]["share"] * 100) if top_topics else 0

    # Top sample traces under dominant topic
    dominant_items = [
        ev.get("title")
        for ev in assignments
        if ev.get("topic") == dominant_topic and ev.get("title")
    ][:5]

    # 2. Peak Drift Month
    monthly_drift = evolution.get("monthly_drift", {})
    peak_drift_month = "Unknown"
    peak_drift_val = 0.0
    for m, val in monthly_drift.items():
        if isinstance(val, (int, float)) and float(val) > peak_drift_val:
            peak_drift_val = float(val)
            peak_drift_month = m

    # 3. Deepest Rabbit Hole (prefer named topic over raw 'Other')
    rabbit_holes = behavior.get("rabbit_holes", [])
    meaningful_holes = [h for h in rabbit_holes if h.get("dominant_topic") != "Other"]
    deepest_hole: dict | None = meaningful_holes[0] if meaningful_holes else (rabbit_holes[0] if rabbit_holes else None)

    # 4. Night owl ratio
    night_count = sum(
        1 for ev in assignments
        if (ts := _parse_ts(ev.get("timestamp"))) and (ts.hour >= 23 or ts.hour < 5)
    )
    night_ratio = night_count / max(total_events, 1)

    # 5. Attention Archetype
    if night_ratio > 0.35:
        archetype = {
            "title": "The Midnight Synthesizer",
            "tagline": "You do your most profound wandering when the rest of the world is asleep.",
            "gradient": "from-indigo-600 via-purple-600 to-pink-500",
            "accent_color": "#a855f7",
            "key_traits": ["Nocturnal Curiosity", "Unbounded Focus", "Eclectic Depth"],
        }
    elif num_unique_topics > 12:
        archetype = {
            "title": "The Polymorphic Explorer",
            "tagline": "Your mind refuses a single lane. You build unexpected bridges between distant ideas.",
            "gradient": "from-cyan-500 via-blue-600 to-fuchsia-500",
            "accent_color": "#06b6d4",
            "key_traits": ["High Drift Velocity", "Cross-Domain Learner", "Endless Curiosity"],
        }
    elif dominant_share > 40:
        archetype = {
            "title": "The Deep-Sea Specialist",
            "tagline": "When a spark catches your interest, you plunge straight down into the abyss until you master it.",
            "gradient": "from-emerald-500 via-teal-600 to-cyan-500",
            "accent_color": "#10b981",
            "key_traits": ["Laser Focus", "High Concentration", "Obsessive Craft"],
        }
    else:
        archetype = {
            "title": "The Kinetic Nomad",
            "tagline": "Always in motion, gracefully shifting between obsessions without ever staying static.",
            "gradient": "from-amber-500 via-rose-500 to-purple-600",
            "accent_color": "#f59e0b",
            "key_traits": ["Dynamic Tastes", "Adaptive Rhythm", "Subtle Metamorphosis"],
        }

    # 6. Streak stats
    sorted_days = sorted(active_days)
    max_streak = 1
    cur_streak = 1
    for i in range(1, len(sorted_days)):
        prev = datetime.strptime(sorted_days[i - 1], "%Y-%m-%d")
        curr = datetime.strptime(sorted_days[i], "%Y-%m-%d")
        if (curr - prev).days == 1:
            cur_streak += 1
            max_streak = max(max_streak, cur_streak)
        else:
            cur_streak = 1
    longest_streak = max_streak if len(sorted_days) > 1 else len(sorted_days)

    # 7. Construct the 5 Story Slides
    slides = [
        {
            "id": "volume",
            "eyebrow": "Chapter 01 // Scale",
            "title": f"You lived through {total_events:,} moments of curiosity.",
            "subtitle": (
                f"Across {len(active_days)} active days and "
                f"{num_unique_topics} discovered interest realms."
            ),
            "metrics": [
                {"label": "Total Traces", "value": f"{total_events:,}"},
                {"label": "Active Days", "value": str(len(active_days))},
                {"label": "Interest Clusters", "value": str(num_unique_topics)},
                {"label": "Longest Streak", "value": f"{longest_streak}d"},
            ],
            "accent": "#f2b56b",
        },
        {
            "id": "dominant",
            "eyebrow": "Chapter 02 // Gravity Well",
            "title": f"{dominant_topic} pulled you in hardest.",
            "subtitle": f"Accounting for {dominant_share}% of your total attention bandwidth.",
            "top_topics": top_topics,
            "sample_traces": [t for t in dominant_items if t],
            "accent": "#75d6c2",
        },
        {
            "id": "drift",
            "eyebrow": "Chapter 03 // The Pivot",
            "title": (
                f"{peak_drift_month} was your month of greatest change."
                if peak_drift_month != "Unknown"
                else "Your interests shifted steadily all year."
            ),
            "subtitle": (
                f"Your interest distribution swung by a drift velocity of "
                f"{peak_drift_val:.3f}, breaking out into fresh territory."
                if peak_drift_val > 0
                else "Your curiosity evolved gradually across the period."
            ),
            "metrics": [
                {"label": "Peak Month", "value": peak_drift_month},
                {"label": "Drift Velocity", "value": f"{peak_drift_val:.3f}"},
                {"label": "Emerging Topics", "value": str(len(evolution.get("emerging", [])))},
            ],
            "accent": "#a7b8ff",
        },
        {
            "id": "rabbit_hole",
            "eyebrow": "Chapter 04 // The Deep Dive",
            "title": "You fell down the rabbit hole.",
            "subtitle": (
                f"Your deepest single session was in "
                f"{'Eclectic Exploration' if deepest_hole.get('dominant_topic') == 'Other' else deepest_hole.get('dominant_topic', dominant_topic)}, "
                f"capturing {deepest_hole.get('event_count', 'multiple')} "
                f"back-to-back traces over "
                f"{deepest_hole.get('duration_minutes', 0):.0f} minutes."
                if deepest_hole
                else "Your attention stayed balanced and exploratory throughout."
            ),
            "nocturnal_share": f"{int(night_ratio * 100)}%",
            "deepest_session": deepest_hole,
            "accent": "#f28f9b",
        },
        {
            "id": "archetype",
            "eyebrow": "Chapter 05 // Your Archetype",
            "title": archetype["title"],
            "subtitle": archetype["tagline"],
            "archetype": archetype,
            "accent": archetype["accent_color"],
        },
    ]

    return {
        "slides": slides,
        "archetype": archetype,
        "summary": {
            "total_events": total_events,
            "active_days": len(active_days),
            "longest_streak": longest_streak,
            "dominant_topic": dominant_topic,
            "dominant_share_pct": dominant_share,
            "peak_drift_month": peak_drift_month,
            "num_unique_topics": num_unique_topics,
            "night_owl_pct": int(night_ratio * 100),
        },
    }
