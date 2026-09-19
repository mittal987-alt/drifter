from typing import Any

import numpy as np

from app.analytics.embeddings import (
    create_embeddings,
    create_text,
)

from app.analytics.clustering import (
    cluster_embeddings,
)

from app.analytics.topics import (
    generate_topic_labels,
)

from app.analytics.time_analysis import (
    calculate_monthly_proportions,
    calculate_momentum,
    detect_rising_topics,
    detect_fading_topics,
    detect_emerging_topics,
    calculate_monthly_drift,
)

from app.analytics.interest_map import (
    create_interest_map,
)

from app.analytics.interest_graph import (
    create_interest_graph,
)

from app.analytics.behavior import (
    analyze_behavior,
)


def clean_title(title: str | None) -> str:
    """
    Basic text cleaning before embedding.
    """

    if not title:
        return ""

    text = str(title).strip()

    # Remove common YouTube history prefix.
    if text.lower().startswith("watched "):
        text = text[8:].strip()

    # Normalize whitespace.
    text = " ".join(text.split())

    return text


def build_event_text(
    title: str,
    artist: str | None = None,
) -> str:
    """
    Create the semantic text used for embeddings.
    """

    clean = clean_title(title)

    if artist:
        artist = " ".join(str(artist).split())

        if artist:
            return f"{clean} {artist}"

    return clean


def is_ad_or_promotional(title: str, artist: str | None = None) -> bool:
    low = f"{title} {artist or ''}".lower()
    ad_signatures = [
        "shortened: in-",
        "promoaug",
        "video ad",
        "_1080x1920_",
        "acq_",
        "fbigs",
        "_cvs",
    ]
    return any(sig in low for sig in ad_signatures)


def prepare_events(
    events: list[Any],
) -> list[dict[str, Any]]:
    """
    Convert database HistoryEvent objects into
    clean analysis records.
    """

    prepared = []

    seen = set()

    for event in events:

        title = clean_title(event.title)

        if not title:
            continue

        if is_ad_or_promotional(title, event.artist):
            continue


        # -----------------------------------------------------
        # Deduplication
        # -----------------------------------------------------

        dedupe_key = (
            event.source,
            event.timestamp,
            title.lower(),
            (event.artist or "").lower(),
            event.url or "",
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        # -----------------------------------------------------
        # Text used for embedding
        # -----------------------------------------------------

        text = build_event_text(
            title=title,
            artist=event.artist,
        )

        if not text:
            continue

        prepared.append(
            {
                "event_id": event.id,
                "timestamp": event.timestamp,
                "source": event.source,
                "title": title,
                "artist": event.artist,
                "url": event.url,
                "duration": event.duration,
                "text": text,
            }
        )

    return prepared


def run_analysis_pipeline(
    events: list[Any],
) -> dict[str, Any]:
    """
    Complete Year in Drift analysis pipeline.

    History
      -> Cleaning
      -> Deduplication
      -> Text creation
      -> Embeddings
      -> Clustering
      -> Topic labeling
      -> Time analysis
      -> Interest map
      -> Interest graph
      -> Behavior
    """

    # =========================================================
    # 1. PREPARE
    # =========================================================

    prepared_events = prepare_events(events)

    if not prepared_events:
        return {
            "events": [],
            "cluster_count": 0,
            "noise_count": 0,
            "topics": {},
            "assignments": [],
            "interest_map": {
                "points": [],
                "topic_centers": [],
            },
            "interest_graph": {
                "nodes": [],
                "edges": [],
            },
            "evolution": {
                "monthly_proportions": {},
                "momentum": {},
                "rising": [],
                "fading": [],
                "emerging": [],
                "monthly_drift": {},
            },
            "behavior": {},
        }

    # =========================================================
    # 2. TEXT CREATION
    # =========================================================

    texts = [
        event["text"]
        for event in prepared_events
    ]

    # =========================================================
    # 3. EMBEDDINGS
    # =========================================================

    embeddings = create_embeddings(
        texts,
        batch_size=64,
    )

    # =========================================================
    # 4. CLUSTERING
    # =========================================================

    assignments = cluster_embeddings(
        embeddings,
        min_cluster_size=5,
    )

    # =========================================================
    # 5. TOPIC LABELING
    # =========================================================

    topic_labels = generate_topic_labels(
        texts,
        assignments,
    )

    # =========================================================
    # 6. BUILD ASSIGNMENTS
    # =========================================================

    assignment_rows = []

    for event, cluster_id in zip(
        prepared_events,
        assignments,
    ):

        cluster_id = int(cluster_id)

        assignment_rows.append(
            {
                "event_id": event["event_id"],
                "timestamp": event["timestamp"],
                "source": event["source"],
                "title": event["title"],
                "artist": event["artist"],
                "url": event["url"],
                "cluster": cluster_id,
                "topic": topic_labels.get(
                    cluster_id,
                    "Other",
                ),
            }
        )

    # =========================================================
    # 7. CLUSTER STATS
    # =========================================================

    cluster_ids = sorted(
        set(int(x) for x in assignments)
    )

    real_clusters = [
        cluster_id
        for cluster_id in cluster_ids
        if cluster_id != -1
    ]

    noise_count = int(
        np.sum(assignments == -1)
    )

    topics = {}

    for cluster_id in cluster_ids:

        topics[str(cluster_id)] = {
            "id": cluster_id,
            "label": topic_labels.get(
                cluster_id,
                "Other",
            ),
            "event_count": int(
                np.sum(
                    assignments == cluster_id
                )
            ),
        }

    # =========================================================
    # 8. TIME ANALYSIS
    # =========================================================

    monthly_proportions = (
        calculate_monthly_proportions(
            assignment_rows
        )
    )

    momentum = calculate_momentum(
        monthly_proportions
    )

    rising = detect_rising_topics(
        momentum
    )

    fading = detect_fading_topics(
        momentum
    )

    emerging = detect_emerging_topics(
        monthly_proportions
    )

    monthly_drift = calculate_monthly_drift(
        monthly_proportions
    )

    # =========================================================
    # 9. INTEREST MAP
    # =========================================================

    interest_map = create_interest_map(
        embeddings,
        assignment_rows,
    )

    # =========================================================
    # 10. INTEREST GRAPH
    # =========================================================

    interest_graph = create_interest_graph(
        embeddings,
        assignment_rows,
    )

    # =========================================================
    # 11. BEHAVIOR
    # =========================================================

    behavior = analyze_behavior(
        assignment_rows
    )

    # =========================================================
    # 12. FINAL RESULT
    # =========================================================

    return {
        "events": assignment_rows,

        "cluster_count": len(
            real_clusters
        ),

        "noise_count": noise_count,

        "topics": topics,

        "assignments": assignment_rows,

        "interest_map": interest_map,

        "interest_graph": interest_graph,

        "evolution": {
            "monthly_proportions":
                monthly_proportions,

            "momentum":
                momentum,

            "rising":
                rising,

            "fading":
                fading,

            "emerging":
                emerging,

            "monthly_drift":
                monthly_drift,
        },

        "behavior": behavior,
    }