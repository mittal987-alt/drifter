from collections import defaultdict
import numpy as np


def create_interest_graph(
    embeddings,
    assignments,
    similarity_threshold: float = 0.35,
):
    """
    Build a network graph of topics where nodes represent topics
    and edges represent semantic similarity between their centroid embeddings.
    """
    if len(assignments) == 0 or len(embeddings) == 0:
        return {
            "nodes": [],
            "edges": [],
        }

    # Group embeddings and counts by topic
    topic_embeddings = defaultdict(list)
    topic_sizes = defaultdict(int)

    for embedding, assignment in zip(embeddings, assignments):
        if isinstance(assignment, dict):
            topic = assignment.get("topic", "Unknown")
        else:
            topic = str(assignment)
        topic_embeddings[topic].append(embedding)
        topic_sizes[topic] += 1

    # Calculate centroid embedding for each topic
    centroids = {}
    nodes = []

    for topic, emb_list in topic_embeddings.items():
        centroid = np.mean(emb_list, axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        centroids[topic] = centroid

        nodes.append({
            "id": topic,
            "label": topic,
            "size": topic_sizes[topic],
        })

    # Compute cosine similarities between topic centroids to generate edges
    topic_names = list(centroids.keys())
    edges = []

    for i in range(len(topic_names)):
        for j in range(i + 1, len(topic_names)):
            t1 = topic_names[i]
            t2 = topic_names[j]

            sim = float(np.dot(centroids[t1], centroids[t2]))

            if sim >= similarity_threshold:
                edges.append({
                    "source": t1,
                    "target": t2,
                    "weight": round(sim, 4),
                })

    return {
        "nodes": nodes,
        "edges": edges,
    }