# apps/ml-service/models/embedder.py
"""Embedding model singleton using SentenceTransformer all-MiniLM-L6-v2.

Generates 384-dimensional dense vectors for text chunks.
Used for semantic search, tagging via similarity, and document clustering.
"""

import numpy as np
from loguru import logger
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None
MODEL_NAME = "all-MiniLM-L6-v2"
VECTOR_DIM = 384
BATCH_SIZE = 32


def load_embedder() -> SentenceTransformer:
    """Load the embedding model singleton."""
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
        logger.info(f"Embedding model loaded: {MODEL_NAME} (dim={VECTOR_DIM})")
    return _model


def embed_texts(texts: list[str], batch_size: int = BATCH_SIZE) -> np.ndarray:
    """Encode a batch of texts into embeddings.

    Args:
        texts: List of text strings to encode.
        batch_size: Batch size for encoding.

    Returns:
        numpy array of shape (len(texts), VECTOR_DIM).
    """
    model = load_embedder()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return np.array(embeddings, dtype=np.float32)


def embed_single(text: str) -> np.ndarray:
    """Encode a single text string into an embedding vector.

    Returns:
        numpy array of shape (VECTOR_DIM,).
    """
    model = load_embedder()
    embedding = model.encode(
        text,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return np.array(embedding, dtype=np.float32)
