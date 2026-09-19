import numpy as np
import hdbscan


def cluster_embeddings(
    embeddings: np.ndarray,
    min_cluster_size: int = 5,
) -> np.ndarray:
    """
    Cluster semantic embeddings using HDBSCAN.

    Cluster label -1 means noise / unassigned.
    """

    if len(embeddings) == 0:
        return np.array([], dtype=int)

    # Adaptively adjust min_cluster_size for smaller datasets so HDBSCAN can form clusters
    effective_min_size = min(min_cluster_size, max(2, len(embeddings) // 4))

    if len(embeddings) < effective_min_size:
        return np.full(
            len(embeddings),
            -1,
            dtype=int,
        )

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=effective_min_size,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=False,
    )

    labels = clusterer.fit_predict(
        embeddings
    )

    return labels.astype(int)