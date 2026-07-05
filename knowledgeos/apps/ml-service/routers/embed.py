# apps/ml-service/routers/embed.py
"""POST /ml/embed — Generate embeddings for document chunks and store in Qdrant."""

import uuid

from fastapi import APIRouter, HTTPException
from loguru import logger
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchValue

from models.embedder import embed_texts
from schemas.requests import EmbedRequest, EmbedResponse, EmbedPointResult, DeleteDocumentRequest
from utils.qdrant_client import get_qdrant_client, ensure_collection, get_user_collection_name

router = APIRouter()


@router.post("/embed", response_model=EmbedResponse)
async def embed_chunks(request: EmbedRequest) -> EmbedResponse:
    """Generate embeddings for document chunks and upsert into Qdrant.

    1. Batch-encode all chunks with all-MiniLM-L6-v2 (batch_size=32)
    2. Auto-create Qdrant collection if it doesn't exist (384-dim, cosine)
    3. Delete existing vectors for this document
    4. Upsert points with metadata payload
    5. Return chunk-to-point ID mapping
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

        client = get_qdrant_client()

        # Delete any existing points for this document in Qdrant to avoid orphaned duplicate vectors
        if request.document_id:
            try:
                client.delete(
                    collection_name=collection_name,
                    points_selector=Filter(
                        must=[
                            FieldCondition(
                                key="documentId", match=MatchValue(value=request.document_id)
                            )
                        ]
                    ),
                )
                logger.info(f"Deleted old Qdrant points for document {request.document_id}")
            except Exception as e:
                logger.warning(f"Failed to delete old Qdrant points for document {request.document_id}: {e}")

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


@router.post("/delete-document")
async def delete_document_vectors(request: DeleteDocumentRequest):
    """Delete all vectors matching a documentId for a specific user collection."""
    try:
        collection_name = get_user_collection_name(request.user_id)
        client = get_qdrant_client()
        
        # Ensure collection exists before attempting delete to avoid collection-not-found errors
        ensure_collection(collection_name)
        
        client.delete(
            collection_name=collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="documentId", match=MatchValue(value=request.document_id)
                    )
                ]
            ),
        )
        logger.info(f"Deleted Qdrant points for document {request.document_id} and user {request.user_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete Qdrant points: {e}")
        raise HTTPException(status_code=500, detail=str(e))

