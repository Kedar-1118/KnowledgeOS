# apps/ml-service/routers/entities.py
"""POST /ml/extract-entities — Extract named entities and relations from text."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from models.ner_extractor import extract_entities
from schemas.requests import (
    EntityExtractRequest,
    EntityExtractResponse,
    EntityResult,
    RelationResult,
)

router = APIRouter()


@router.post("/extract-entities", response_model=EntityExtractResponse)
async def extract(request: EntityExtractRequest) -> EntityExtractResponse:
    """Extract named entities and co-occurrence relations from document text.

    Uses spaCy NER + custom tech-term pattern matching.
    Returns entities with types and counts, plus relation pairs.
    """
    try:
        if not request.text.strip():
            return EntityExtractResponse(entities=[], relations=[])

        logger.info(
            f"Extracting entities from document {request.document_id} "
            f"({len(request.text)} chars)"
        )

        raw_entities, raw_relations = extract_entities(request.text)

        entities = [
            EntityResult(
                text=str(e["text"]),
                type=str(e["type"]),
                count=int(e["count"]),
            )
            for e in raw_entities
        ]

        relations = [
            RelationResult(
                source=str(r["source"]),
                target=str(r["target"]),
                type=str(r["type"]),
                strength=float(r["strength"]),
            )
            for r in raw_relations
        ]

        logger.info(
            f"Extracted {len(entities)} entities, {len(relations)} relations "
            f"from document {request.document_id}"
        )

        return EntityExtractResponse(entities=entities, relations=relations)

    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Entity extraction failed: {str(e)}"
        )
