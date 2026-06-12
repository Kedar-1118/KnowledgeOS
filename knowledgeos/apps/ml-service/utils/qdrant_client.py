# apps/ml-service/utils/qdrant_client.py
"""Qdrant vector database connection singleton."""

import os

from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)

# Vector dimensions for all-MiniLM-L6-v2
VECTOR_SIZE = 384

_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Get or create the Qdrant client singleton."""
    global _client
    if _client is None:
        _client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY if QDRANT_API_KEY else None,
            timeout=30,
        )
        logger.info(f"Qdrant client connected to {QDRANT_URL}")
    return _client


def ensure_collection(collection_name: str) -> None:
    """Create a Qdrant collection if it doesn't exist."""
    client = get_qdrant_client()

    collections = client.get_collections().collections
    existing_names = [c.name for c in collections]

    if collection_name not in existing_names:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )
        logger.info(f"Created Qdrant collection: {collection_name}")
    else:
        logger.debug(f"Qdrant collection already exists: {collection_name}")


def get_user_collection_name(user_id: str) -> str:
    """Get the collection name for a specific user."""
    return f"knowledgeos_{user_id}"
