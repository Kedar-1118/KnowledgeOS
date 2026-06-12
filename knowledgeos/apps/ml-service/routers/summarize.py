# apps/ml-service/routers/summarize.py
"""POST /ml/summarize — Summarize document text using DistilBART-CNN."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from models.summarizer import summarize_text
from schemas.requests import SummarizeRequest, SummarizeResponse

router = APIRouter()


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> SummarizeResponse:
    """Summarize text with hierarchical strategy for long inputs.

    - For texts <= 1024 tokens: direct summarization
    - For longer texts: chunk, summarize each, then summarize summaries
    """
    try:
        if not request.text.strip():
            return SummarizeResponse(summary="", tokenCount=0)

        logger.info(f"Summarizing text ({len(request.text)} chars), max_length={request.max_length}")

        summary, token_count = summarize_text(
            text=request.text,
            max_length=request.max_length,
            min_length=request.min_length,
        )

        logger.info(f"Summary generated: {len(summary)} chars from {token_count} tokens")
        return SummarizeResponse(summary=summary, tokenCount=token_count)

    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
