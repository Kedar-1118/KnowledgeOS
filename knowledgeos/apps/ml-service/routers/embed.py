# apps/ml-service/routers/embed.py
"""POST /ml/embed — Generate embeddings for document chunks and store in Qdrant."""

import uuid

from fastapi import APIRouter, HTTPException
from loguru import logger
from qdrant_client.http.models import PointStruct

from models.embedder import embed_texts
from schemas.requests import EmbedRequest, EmbedResponse, EmbedPointResult
from utils.qdrant_client import get_qdrant_client, ensure_collection, get_user_collection_name

router = APIRouter()


@router.post("/embed", response_model=EmbedResponse)
async def embed_chunks(request: EmbedRequest) -> EmbedResponse:
    """Generate embeddings for document chunks and upsert into Qdrant.

    1. Batch-encode all chunks with all-MiniLM-L6-v2 (batch_size=32)
    2. Auto-create Qdrant collection if it doesn't exist (384-dim, cosine)
    3. Upsert points with metadata payload
    4. Return chunk-to-point ID mapping
    """
    try:
        if not request.chunks:
            return EmbedResponse(points=[])

        # Get text contents for encoding
        texts = [chunk.content for chunk in request.chunks]
        logger.info(f"Embedding {len(texts)} chunks for user {request.user_id}")

        # Generate embeddings
        embeddings = embed_texts(texts)

        # Ensure Qdrant collection exists
        collection_name = get_user_collection_name(request.user_id)
        ensure_collection(collection_name)

        # Build Qdrant points
        points: list[PointStruct] = []
        results: list[EmbedPointResult] = []

        for i, chunk in enumerate(request.chunks):
            point_id = str(uuid.uuid4())
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embeddings[i].tolist(),
                    payload={
                        "chunkId": chunk.id,
                        "documentId": request.document_id,
                        "userId": request.user_id,
                        "content": chunk.content[:500],  # Store truncated content for retrieval
                    },
                )
            )
            results.append(
                EmbedPointResult(id=chunk.id, qdrantPointId=point_id)
            )

        # Upsert to Qdrant in batches of 100
        client = get_qdrant_client()
        batch_size = 100
        for j in range(0, len(points), batch_size):
            batch = points[j : j + batch_size]
            client.upsert(
                collection_name=collection_name,
                points=batch,
            )

        logger.info(f"Upserted {len(points)} points to collection {collection_name}")
        return EmbedResponse(points=results)

    except Exception as e:
        logger.error(f"Embed failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")
