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
import math

@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    """Perform hybrid semantic search on user's document collection.

    Steps:
    1. Encode query → 384-dim vector
    2. Search Qdrant with userId filter
    3. Merge with BM25 candidates from backend (if provided)
    4. Re-rank with cross-encoder
    5. Calculate hybrid weighted scores and explanations (BM25, Vector, CE)
    6. Return top-K results
    """
    start_time = time.time()

    try:
        logger.info(f"Hybrid Search query: '{request.query}' for user {request.user_id}, top_k={request.top_k}")

        # Step 1: Vector Search in Qdrant
        query_embedding = embed_single(request.query)
        collection_name = get_user_collection_name(request.user_id)
        must_conditions: list[FieldCondition] = [
            FieldCondition(key="userId", match=MatchValue(value=request.user_id))
        ]
        qdrant_filter = Filter(must=must_conditions)

        client = get_qdrant_client()
        search_limit = min(request.top_k * 3, 50)

        vector_hits = []
        try:
            response = client.query_points(
                collection_name=collection_name,
                query=query_embedding.tolist(),
                query_filter=qdrant_filter,
                limit=search_limit,
                with_payload=True,
            )
            vector_hits = response.points
        except Exception as e:
            logger.warning(f"Qdrant vector search failed (using empty vector results): {e}")

        # Step 2: Build candidate map combining Vector and BM25 results
        candidates: dict[str, dict] = {}

        # Process Vector candidates
        for hit in vector_hits:
            payload = hit.payload or {}
            chunk_id = payload.get("chunkId")
            if not chunk_id:
                continue
            candidates[chunk_id] = {
                "chunkId": chunk_id,
                "documentId": payload.get("documentId", ""),
                "content": payload.get("content", ""),
                "vectorScore": float(hit.score),
                "bm25Score": 0.0,
            }

        # Process BM25 candidates
        max_bm25_raw = 0.0
        if request.bm25_results:
            for item in request.bm25_results:
                max_bm25_raw = max(max_bm25_raw, item.score)

            for item in request.bm25_results:
                # Normalize raw BM25 score relative to max in set
                norm_bm25 = (item.score / max_bm25_raw) if max_bm25_raw > 0 else 0.0
                if item.chunkId in candidates:
                    candidates[item.chunkId]["bm25Score"] = norm_bm25
                else:
                    candidates[item.chunkId] = {
                        "chunkId": item.chunkId,
                        "documentId": item.documentId,
                        "content": item.content,
                        "vectorScore": 0.3, # default baseline for keyword-only matches
                        "bm25Score": norm_bm25,
                    }

        if not candidates:
            query_time_ms = (time.time() - start_time) * 1000
            return SearchResponse(results=[], totalCount=0, queryTimeMs=round(query_time_ms, 2))

        # Convert to list of candidate dicts
        candidate_list = list(candidates.values())

        # Step 3: Run Cross-Encoder Re-ranking
        cross_encoder = _get_cross_encoder()
        ce_scores = []
        if cross_encoder is not None:
            pairs = [(request.query, c["content"]) for c in candidate_list]
            try:
                ce_scores = cross_encoder.predict(pairs).tolist()
            except Exception as e:
                logger.error(f"Cross-encoder predict failed: {e}")
                ce_scores = [0.0] * len(candidate_list)
        else:
            ce_scores = [0.0] * len(candidate_list)

        # Step 4: Compute final hybrid scores and explanations
        # Formula: 40% BM25 + 30% Vector + 30% Cross Encoder (with CE mapped via sigmoid to [0,1])
        scored_results: list[tuple[float, dict]] = []

        # Simple function to extract query terms for entity overlap
        query_words = [w.lower() for w in request.query.split() if len(w) > 3]

        for i, c in enumerate(candidate_list):
            # Sigmoid scaling for logits
            logit = ce_scores[i]
            ce_norm = 1.0 / (1.0 + math.exp(-logit)) if logit != 0.0 else 0.5

            v_score = c["vectorScore"]
            b_score = c["bm25Score"]

            # Hybrid score
            final_score = 0.40 * b_score + 0.30 * v_score + 0.30 * ce_norm

            # Calculate entity overlap
            overlap = 0
            if query_words:
                content_lower = c["content"].lower()
                for w in query_words:
                    if w in content_lower:
                        overlap += 1
                entity_ratio = overlap / len(query_words)
            else:
                entity_ratio = 0.0

            # Calculate explanations (Semantic, Shared Entities, Keyword)
            # Normalize them to sum to 100%
            w_sem = max(0.01, ce_norm * 0.7 + v_score * 0.3)
            w_kw = max(0.01, b_score)
            w_ent = max(0.01, entity_ratio)

            total_w = w_sem + w_kw + w_ent
            sem_pct = round((w_sem / total_w) * 100)
            kw_pct = round((w_kw / total_w) * 100)
            ent_pct = max(0, 100 - sem_pct - kw_pct)

            scored_results.append((final_score, {
                "documentId": c["documentId"],
                "content": c["content"],
                "score": final_score,
                "explanation": {
                    "semantic": sem_pct,
                    "keyword": kw_pct,
                    "entities": ent_pct
                }
            }))

        # Sort by final score descending
        scored_results.sort(key=lambda x: x[0], reverse=True)

        # Step 5: Build Response
        results: list[SearchResultItem] = []
        for score, data in scored_results[:request.top_k]:
            if request.filters and request.filters.min_score:
                if score < request.filters.min_score:
                    continue

            results.append(
                SearchResultItem(
                    documentId=data["documentId"],
                    documentTitle=data["documentId"],  # Enriched by backend
                    chunkContent=data["content"],
                    score=round(score, 4),
                    pageNumber=None,
                    headingContext=None,
                    fileType="OTHER",
                    tags=[],
                    explanation=data["explanation"]
                )
            )

        query_time_ms = (time.time() - start_time) * 1000
        logger.info(f"Hybrid Search returned {len(results)} results in {query_time_ms:.1f}ms")

        return SearchResponse(
            results=results,
            totalCount=len(results),
            queryTimeMs=round(query_time_ms, 2),
        )

    except Exception as e:
        logger.error(f"Hybrid Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Hybrid Search failed: {str(e)}")
