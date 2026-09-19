from collections import Counter, defaultdict
from typing import Any


def predict_next_interests(
    assignments: list[dict[str, Any]],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Markov transition & semantic trajectory model that projects the user's
    next likely topic obsessions and rabbit holes.
    """
    if not assignments:
        return {
            "predictions": [],
            "transition_matrix": {},
            "current_focus": "Unknown",
            "projection_horizon": "Insufficient data",
        }

    behavior = analysis.get("behavior", {})
    evolution = analysis.get("evolution", {})
    transitions_raw = behavior.get("topic_transitions", [])
    rising_topics = [
        item.get("topic")
        for item in evolution.get("rising", [])
        if isinstance(item, dict)
    ]
    emerging_topics = [
        item.get("topic")
        for item in evolution.get("emerging", [])
        if isinstance(item, dict)
    ]
    interest_graph = analysis.get("visualizations", {}).get("interest_graph", {})

    # Build transition counts & transition probabilities
    transition_counts = defaultdict(Counter)
    for t in transitions_raw:
        src = t.get("source") or t.get("from")
        tgt = t.get("target") or t.get("to")
        count = t.get("count", 1)
        if src and tgt and src != tgt:
            transition_counts[src][tgt] += count

    # Determine current focus (most frequent in recent 20% of events, preferring meaningful topic)
    recent_window = assignments[-max(10, len(assignments) // 5):]
    recent_counts = Counter(e.get("topic", "Other") for e in recent_window)
    meaningful_recent = [t for t, _ in recent_counts.most_common() if t != "Other"]
    current_focus = meaningful_recent[0] if meaningful_recent else (
        recent_counts.most_common(1)[0][0] if recent_counts else "General Exploration"
    )

    # Forward scoring candidates
    candidate_scores = Counter()

    # 1. Markov forward transitions from current focus
    if current_focus in transition_counts:
        src_total = sum(transition_counts[current_focus].values())
        for target, count in transition_counts[current_focus].items():
            if target != "Other":
                prob = count / max(src_total, 1)
                candidate_scores[target] += prob * 45.0

    # 2. Rising & emerging velocity boost (filter Other)
    for idx, top in enumerate([t for t in rising_topics if t != "Other"][:4]):
        candidate_scores[top] += (4 - idx) * 12.0
    for idx, top in enumerate([t for t in emerging_topics if t != "Other"][:3]):
        candidate_scores[top] += (3 - idx) * 10.0

    # 3. Interest graph neighbor similarity boost
    graph_edges = interest_graph.get("edges", [])
    for edge in graph_edges:
        s, t = edge.get("source"), edge.get("target")
        weight = edge.get("weight") or edge.get("similarity") or 0.3
        if s == current_focus and t != current_focus and t != "Other":
            candidate_scores[t] += float(weight) * 25.0
        elif t == current_focus and s != current_focus and s != "Other":
            candidate_scores[s] += float(weight) * 25.0

    # Sort candidates (exclude current_focus and unclustered 'Other')
    predictions = []
    horizons = ["Next 7-14 days", "Next 2-4 weeks", "Next 1-2 months", "Emerging horizon"]
    sorted_candidates = [
        (topic, score)
        for topic, score in candidate_scores.most_common()
        if topic != current_focus and topic != "Other"
    ]

    # If few candidates, pull from general top topics
    if len(sorted_candidates) < 3:
        all_topics = Counter(e.get("topic", "Other") for e in assignments)
        for top, _ in all_topics.most_common():
            if top != current_focus and top != "Other" and top not in [c[0] for c in sorted_candidates]:
                sorted_candidates.append((top, 20.0))

    for idx, (topic, raw_score) in enumerate(sorted_candidates[:4]):
        confidence = min(96, max(48, int(50 + (raw_score / 2.5))))
        horizon = horizons[min(idx, len(horizons) - 1)]

        # Formulate rationale
        if topic in rising_topics:
            rationale = f"Strong upward velocity in recent activity combined with high transition frequency from {current_focus}."
        elif topic in emerging_topics:
            rationale = f"New curiosity cluster appearing in your latest logs; likely to mature into an active focus."
        elif current_focus in transition_counts and topic in transition_counts[current_focus]:
            rationale = f"Frequent historical pathway: when you explore {current_focus}, you consistently branch into {topic}."
        else:
            rationale = f"Semantic neighbor in your interest topology with strong conceptual overlap to your current center of gravity."

        # Extract real title seeds from assignments if available
        matching_titles = [
            e.get("title", "").strip()
            for e in assignments
            if e.get("topic") == topic and e.get("title")
        ]
        seeds = []
        for t_name in matching_titles[:3]:
            # Clean up title
            clean_title = t_name.split("|")[0].split("-")[0].strip()
            if clean_title and len(clean_title) < 35 and clean_title not in seeds:
                seeds.append(clean_title)

        if not seeds:
            seeds = [f"Deep dive into {topic}", f"{topic} foundations", f"Next-gen {topic}"]
        elif len(seeds) < 3:
            seeds.append(f"Exploring advanced {topic}")

        predictions.append({
            "topic": topic,
            "confidence": confidence,
            "horizon": horizon,
            "rationale": rationale,
            "transition_from": current_focus,
            "seed_keywords": seeds[:4],
        })

    # Convert transition counts into serializable dict
    serializable_matrix = {
        src: dict(targets.most_common(5))
        for src, targets in list(transition_counts.items())[:8]
    }

    return {
        "current_focus": current_focus,
        "predictions": predictions,
        "transition_matrix": serializable_matrix,
        "projection_horizon": "30-Day Predictive Horizon",
    }
