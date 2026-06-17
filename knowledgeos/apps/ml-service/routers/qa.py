# apps/ml-service/routers/qa.py
"""POST /ml/qa — RAG-based question answering with streaming responses.

Pipeline:
1. Search top-K relevant chunks (reuses /ml/search logic)
2. Build context string with source citations
3. Call LLM (Anthropic Claude) with system prompt + context
4. Stream response back as Server-Sent Events (SSE)
"""

import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from models.embedder import embed_single
from schemas.requests import QARequest, QASource
from utils.qdrant_client import get_qdrant_client, get_user_collection_name
from qdrant_client.http.models import Filter, FieldCondition, MatchValue

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are a personal knowledge assistant for KnowledgeOS. Answer ONLY using the \
provided context from the user's documents. If the answer is not in the context, say so clearly. \
Always cite your sources using [Source N] notation where N is the source number. \
Be concise, accurate, and helpful."""


async def _stream_qa_response(question: str, user_id: str, top_k: int):
    """Generator that streams the Q&A response as SSE events."""

    # Step 1: Retrieve relevant chunks
    query_embedding = embed_single(question)
    collection_name = get_user_collection_name(user_id)
    client = get_qdrant_client()

    try:
        search_results = client.search(
            collection_name=collection_name,
            query_vector=query_embedding.tolist(),
            query_filter=Filter(
                must=[FieldCondition(key="userId", match=MatchValue(value=user_id))]
            ),
            limit=top_k,
            with_payload=True,
        )
    except Exception as e:
        logger.warning(f"Qdrant search failed for QA: {e}")
        error_data = json.dumps({"error": "No documents indexed yet. Please sync your Drive first."})
        yield f"data: {error_data}\n\n"
        return

    if not search_results:
        error_data = json.dumps({"error": "No relevant documents found for your question."})
        yield f"data: {error_data}\n\n"
        return

    # Step 2: Build context with citations
    sources: list[dict[str, str | int | None]] = []
    context_parts: list[str] = []

    for i, hit in enumerate(search_results):
        payload = hit.payload or {}
        content = payload.get("content", "")
        doc_id = payload.get("documentId", "")
        source_num = i + 1

        context_parts.append(f"[Source {source_num}]: {content}")
        sources.append({
            "documentId": doc_id,
            "title": doc_id,  # Will be enriched by backend
            "page": None,
            "snippet": content[:200] if content else "",
        })

    context = "\n\n".join(context_parts)

    # Step 3: Call LLM
    if ANTHROPIC_API_KEY:
        # Use Anthropic Claude
        try:
            import httpx

            async with httpx.AsyncClient(timeout=60.0) as http_client:
                response = await http_client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-3-5-sonnet-20241022",
                        "max_tokens": 1024,
                        "system": SYSTEM_PROMPT,
                        "messages": [
                            {
                                "role": "user",
                                "content": f"Context:\n{context}\n\nQuestion: {question}",
                            }
                        ],
                        "stream": True,
                    },
                )

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            event = json.loads(data)
                            if event.get("type") == "content_block_delta":
                                delta = event.get("delta", {})
                                text = delta.get("text", "")
                                if text:
                                    chunk_data = json.dumps({"answer_chunk": text})
                                    yield f"data: {chunk_data}\n\n"
                        except json.JSONDecodeError:
                            continue

        except Exception as e:
            logger.error(f"Anthropic API call failed: {e}")
            # Fall back to context-based response
            fallback = _generate_fallback_response(question, context_parts)
            chunk_data = json.dumps({"answer_chunk": fallback})
            yield f"data: {chunk_data}\n\n"
    else:
        # No API key — generate a context-based response without LLM
        logger.info("No ANTHROPIC_API_KEY set, using fallback response")
        fallback = _generate_fallback_response(question, context_parts)
        chunk_data = json.dumps({"answer_chunk": fallback})
        yield f"data: {chunk_data}\n\n"

    # Step 4: Send sources as final event
    sources_data = json.dumps({
        "sources": [
            QASource(
                documentId=str(s["documentId"]),
                title=str(s["title"]),
                page=s.get("page"),  # type: ignore[arg-type]
                snippet=str(s["snippet"]),
            ).model_dump(by_alias=True)
            for s in sources
        ]
    })
    yield f"data: {sources_data}\n\n"
    yield "data: [DONE]\n\n"


def _generate_fallback_response(question: str, context_parts: list[str]) -> str:
    """Generate a simple response from context when no LLM API key is available."""
    response_parts = [
        f"Based on your documents, here's what I found related to your question \"{question}\":\n\n"
    ]

    for part in context_parts[:3]:
        # Clean up the source reference
        response_parts.append(f"• {part}\n\n")

    response_parts.append(
        "\n*Note: For more detailed AI-powered answers, configure your ANTHROPIC_API_KEY "
        "in the environment variables.*"
    )

    return "".join(response_parts)


@router.post("/qa")
async def question_answer(request: QARequest):
    """RAG-based question answering with streaming SSE response.

    Returns a stream of Server-Sent Events:
    - {answer_chunk: str} — partial answer text
    - {sources: [{documentId, title, page, snippet}]} — final source citations
    - [DONE] — end of stream
    """
    try:
        logger.info(f"QA question: '{request.question}' for user {request.user_id}")

        return StreamingResponse(
            _stream_qa_response(
                question=request.question,
                user_id=request.user_id,
                top_k=request.top_k,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.error(f"QA failed: {e}")
        raise HTTPException(status_code=500, detail=f"QA failed: {str(e)}")
