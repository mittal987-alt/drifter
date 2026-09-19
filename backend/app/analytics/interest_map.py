import numpy as np
import umap


def create_interest_map(
    embeddings,
    assignments,
):
    """
    Convert high-dimensional embeddings
    into 2D coordinates for visualization.
    """

    if len(embeddings) < 3:
        return {
            "points": [],
            "topic_centers": [],
        }

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(
            15,
            len(embeddings) - 1
        ),
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )

    coordinates = reducer.fit_transform(
        np.asarray(embeddings)
    )

    result = []

    for i, (assignment, coordinate) in enumerate(
        zip(assignments, coordinates)
    ):
        if isinstance(assignment, dict):
            event_id = assignment.get("event_id", i)
            title = assignment.get("title", "")
            artist = assignment.get("artist")
            source = assignment.get("source", "youtube")
            topic = assignment.get("topic", "Other")
            cluster = assignment.get("cluster", -1)
            timestamp = assignment.get("timestamp")
        else:
            event_id = i
            title = ""
            artist = None
            source = "youtube"
            topic = "Other"
            try:
                cluster = int(assignment)
            except (ValueError, TypeError):
                cluster = -1
            timestamp = None

        result.append({
            "event_id": event_id,
            "title": title,
            "artist": artist,
            "source": source,
            "topic": topic,
            "cluster": cluster,
            "x": round(
                float(coordinate[0]),
                5
            ),
            "y": round(
                float(coordinate[1]),
                5
            ),
            "timestamp": timestamp,
        })

    return {
        "points": result,
        "topic_centers": calculate_topic_centers(result),
    }

def calculate_topic_centers(
    points,
):

    topics = {}

    for point in points:

        topic = point["topic"]

        if topic not in topics:

            topics[topic] = {
                "x": [],
                "y": [],
                "count": 0,
            }

        topics[topic]["x"].append(
            point["x"]
        )

        topics[topic]["y"].append(
            point["y"]
        )

        topics[topic]["count"] += 1

    result = []

    for topic, values in topics.items():

        result.append({
            "topic": topic,
            "x": round(
                float(
                    np.mean(values["x"])
                ),
                5
            ),
            "y": round(
                float(
                    np.mean(values["y"])
                ),
                5
            ),
            "count": values["count"],
        })

    return result