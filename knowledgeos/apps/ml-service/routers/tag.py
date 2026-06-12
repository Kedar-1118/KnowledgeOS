# apps/ml-service/routers/tag.py
"""POST /ml/tag — Auto-tag a document based on title and summary."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from models.tagger import tag_document
from schemas.requests import TagRequest, TagResponse, TagResult

router = APIRouter()


@router.post("/tag", response_model=TagResponse)
async def tag(request: TagRequest) -> TagResponse:
    """Tag a document using cosine similarity against predefined topic embeddings.

    Returns top-5 tags with confidence > 0.35.
    """
    try:
        logger.info(f"Tagging document: '{request.title}' for user {request.user_id}")

        raw_tags = tag_document(
            title=request.title,
            summary=request.summary,
        )

        tags = [
            TagResult(
                label=str(t["label"]),
                category=str(t["category"]),
                confidence=float(t["confidence"]),
            )
            for t in raw_tags
        ]

        logger.info(f"Assigned {len(tags)} tags to '{request.title}'")
        return TagResponse(tags=tags)

    except Exception as e:
        logger.error(f"Tagging failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tagging failed: {str(e)}")
