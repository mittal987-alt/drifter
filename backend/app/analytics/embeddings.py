from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """
    Load the embedding model once and reuse it.
    """

    return SentenceTransformer(MODEL_NAME)


def create_text(
    title: str,
    artist: str | None = None,
) -> str:
    """
    Create the text representation used for embeddings.
    """

    parts = [title.strip()]

    if artist:
        parts.append(artist.strip())

    return " ".join(
        part for part in parts if part
    )


def create_embeddings(
    texts: list[str],
    batch_size: int = 64,
) -> np.ndarray:
    """
    Convert text into normalized semantic embeddings.
    """

    if not texts:
        return np.empty(
            (0, 384),
            dtype=np.float32,
        )

    model = get_embedding_model()

    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    return np.asarray(
        embeddings,
        dtype=np.float32,
    )