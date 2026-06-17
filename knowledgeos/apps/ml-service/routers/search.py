# apps/ml-service/routers/search.py
"""POST /ml/search — Semantic search against user's document collection in Qdrant.

Pipeline:
1. Encode query with MiniLM
2. Qdrant vector search in user's collection
3. Apply metadata filters if provided
4. Re-rank results using cross-encoder (ms-marco-MiniLM-L-6-v2)
5. Return ranked results with document metadata
"""

import time

from fastapi import APIRouter, HTTPException
from loguru import logger
from qdrant_client.http.models import Filter, FieldCondition, MatchValue

from models.embedder import embed_single
from schemas.requests import SearchRequest, SearchResponse, SearchResultItem, TagResult
from utils.qdrant_client import get_qdrant_client, get_user_collection_name

router = APIRouter()

# Cross-encoder for re-ranking (lazy-loaded)
_cross_encoder = None


def _get_cross_encoder():
    """Lazy-load the cross-encoder re-ranking model."""
    global _cross_encoder
    if _cross_encoder is None:
        try:
            from sentence_transformers import CrossEncoder

            _cross_encoder = CrossEncoder(
                "cross-encoder/ms-marco-MiniLM-L-6-v2",
                max_length=512,
            )
            logger.info("Cross-encoder loaded: ms-marco-MiniLM-L-6-v2")
        except Exception as e:
            logger.warning(f"Cross-encoder not available, skipping re-ranking: {e}")
            return None
    return _cross_encoder


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    """Perform semantic search on user's document collection.

    Steps:
    1. Encode query → 384-dim vector
    2. Search Qdrant with userId filter
    3. Re-rank with cross-encoder (if available)
    4. Return top-K results with metadata
    """
    start_time = time.time()

    try:
        logger.info(f"Search query: '{request.query}' for user {request.user_id}, top_k={request.top_k}")

        # Step 1: Encode query
        query_embedding = embed_single(request.query)

        # Step 2: Build Qdrant filters
        collection_name = get_user_collection_name(request.user_id)
        must_conditions: list[FieldCondition] = [
            FieldCondition(key="userId", match=MatchValue(value=request.user_id))
        ]

        qdrant_filter = Filter(must=must_conditions) if must_conditions else None

        # Step 3: Search Qdrant
        client = get_qdrant_client()

        # Request more results than top_k for re-ranking
        search_limit = min(request.top_k * 3, 50)

        try:
            response = client.query_points(
                collection_name=collection_name,
                query=query_embedding.tolist(),
                query_filter=qdrant_filter,
                limit=search_limit,
                with_payload=True,
            )
            search_results = response.points
        except Exception as e:
            # Collection might not exist yet
            logger.warning(f"Qdrant search failed (collection may not exist): {e}")
            query_time_ms = (time.time() - start_time) * 1000
            return SearchResponse(results=[], totalCount=0, queryTimeMs=round(query_time_ms, 2))

        if not search_results:
            query_time_ms = (time.time() - start_time) * 1000
            return SearchResponse(results=[], totalCount=0, queryTimeMs=round(query_time_ms, 2))

        # Step 4: Re-rank with cross-encoder
        cross_encoder = _get_cross_encoder()
        scored_results: list[tuple[float, dict]] = []

        if cross_encoder is not None:
            # Build query-document pairs for cross-encoder
            pairs = [
                (request.query, hit.payload.get("content", "") if hit.payload else "")
                for hit in search_results
            ]
            ce_scores = cross_encoder.predict(pairs)

            for i, hit in enumerate(search_results):
                payload = hit.payload or {}
                # Combine vector score and cross-encoder score
                combined_score = float(ce_scores[i]) * 0.7 + float(hit.score) * 0.3
                scored_results.append((combined_score, {
                    "documentId": payload.get("documentId", ""),
                    "chunkId": payload.get("chunkId", ""),
                    "content": payload.get("content", ""),
                    "vectorScore": float(hit.score),
                    "ceScore": float(ce_scores[i]),
                }))

            # Sort by combined score descending
            scored_results.sort(key=lambda x: x[0], reverse=True)
        else:
            # No cross-encoder — use vector scores directly
            for hit in search_results:
                payload = hit.payload or {}
                scored_results.append((float(hit.score), {
                    "documentId": payload.get("documentId", ""),
                    "chunkId": payload.get("chunkId", ""),
                    "content": payload.get("content", ""),
                    "vectorScore": float(hit.score),
                    "ceScore": 0.0,
                }))

        # Step 5: Build response (top_k results)
        results: list[SearchResultItem] = []
        seen_doc_ids: set[str] = set()

        for score, data in scored_results[:request.top_k]:
            doc_id = data["documentId"]

            # Apply minimum score filter
            if request.filters and request.filters.min_score:
                if score < request.filters.min_score:
                    continue

            results.append(
                SearchResultItem(
                    documentId=doc_id,
                    documentTitle=doc_id,  # Will be enriched by backend
                    chunkContent=data["content"],
                    score=round(score, 4),
                    pageNumber=None,
                    headingContext=None,
                    fileType="OTHER",
                    tags=[],
                )
            )
            seen_doc_ids.add(doc_id)

        query_time_ms = (time.time() - start_time) * 1000
        logger.info(f"Search returned {len(results)} results in {query_time_ms:.1f}ms")

        return SearchResponse(
            results=results,
            totalCount=len(results),
            queryTimeMs=round(query_time_ms, 2),
        )

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
