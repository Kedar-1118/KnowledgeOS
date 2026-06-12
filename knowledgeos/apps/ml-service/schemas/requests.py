# apps/ml-service/schemas/requests.py
"""Pydantic v2 request/response models for all ML service endpoints."""

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════
# Embed
# ═══════════════════════════════════════════

class ChunkInput(BaseModel):
    """A single chunk to embed."""
    id: str
    content: str


class EmbedRequest(BaseModel):
    """Request to generate embeddings for document chunks."""
    chunks: list[ChunkInput]
    user_id: str = Field(alias="userId")
    document_id: str = Field(default="", alias="documentId")

    model_config = {"populate_by_name": True}


class EmbedPointResult(BaseModel):
    """Result for a single embedded chunk."""
    id: str
    qdrant_point_id: str = Field(alias="qdrantPointId", serialization_alias="qdrantPointId")

    model_config = {"populate_by_name": True}


class EmbedResponse(BaseModel):
    """Response from the embed endpoint."""
    points: list[EmbedPointResult]


# ═══════════════════════════════════════════
# Summarize
# ═══════════════════════════════════════════

class SummarizeRequest(BaseModel):
    """Request to summarize a text."""
    text: str
    max_length: int = Field(default=150, alias="maxLength")
    min_length: int = Field(default=50, alias="minLength")

    model_config = {"populate_by_name": True}


class SummarizeResponse(BaseModel):
    """Response from the summarize endpoint."""
    summary: str
    token_count: int = Field(alias="tokenCount", serialization_alias="tokenCount")

    model_config = {"populate_by_name": True}


# ═══════════════════════════════════════════
# Tag
# ═══════════════════════════════════════════

class TagRequest(BaseModel):
    """Request to auto-tag a document based on title and summary."""
    title: str
    summary: str
    user_id: str = Field(alias="userId")

    model_config = {"populate_by_name": True}


class TagResult(BaseModel):
    """A single tag prediction."""
    label: str
    category: str
    confidence: float


class TagResponse(BaseModel):
    """Response from the tag endpoint."""
    tags: list[TagResult]


# ═══════════════════════════════════════════
# Entity Extraction
# ═══════════════════════════════════════════

class EntityExtractRequest(BaseModel):
    """Request to extract entities from text."""
    text: str
    document_id: str = Field(alias="documentId")
    user_id: str = Field(alias="userId")

    model_config = {"populate_by_name": True}


class EntityResult(BaseModel):
    """An extracted entity."""
    text: str
    type: str
    count: int


class RelationResult(BaseModel):
    """An extracted relation between entities."""
    source: str
    target: str
    type: str
    strength: float


class EntityExtractResponse(BaseModel):
    """Response from the entity extraction endpoint."""
    entities: list[EntityResult]
    relations: list[RelationResult]


# ═══════════════════════════════════════════
# Search
# ═══════════════════════════════════════════

class DateRange(BaseModel):
    """Date range filter."""
    from_date: str = Field(alias="from")
    to_date: str = Field(alias="to")

    model_config = {"populate_by_name": True}


class SearchFilters(BaseModel):
    """Optional search filters."""
    tags: list[str] | None = None
    file_type: list[str] | None = Field(default=None, alias="fileType")
    date_range: DateRange | None = Field(default=None, alias="dateRange")
    min_score: float | None = Field(default=None, alias="minScore")

    model_config = {"populate_by_name": True}


class SearchRequest(BaseModel):
    """Request to perform semantic search."""
    query: str
    user_id: str = Field(alias="userId")
    top_k: int = Field(default=10, alias="topK")
    filters: SearchFilters | None = None

    model_config = {"populate_by_name": True}


class SearchResultItem(BaseModel):
    """A single search result."""
    document_id: str = Field(alias="documentId", serialization_alias="documentId")
    document_title: str = Field(alias="documentTitle", serialization_alias="documentTitle")
    chunk_content: str = Field(alias="chunkContent", serialization_alias="chunkContent")
    score: float
    page_number: int | None = Field(alias="pageNumber", serialization_alias="pageNumber")
    heading_context: str | None = Field(alias="headingContext", serialization_alias="headingContext")
    file_type: str = Field(alias="fileType", serialization_alias="fileType")
    tags: list[TagResult] = []

    model_config = {"populate_by_name": True}


class SearchResponse(BaseModel):
    """Response from the search endpoint."""
    results: list[SearchResultItem]
    total_count: int = Field(alias="totalCount", serialization_alias="totalCount")
    query_time_ms: float = Field(alias="queryTimeMs", serialization_alias="queryTimeMs")

    model_config = {"populate_by_name": True}


# ═══════════════════════════════════════════
# Q&A (RAG)
# ═══════════════════════════════════════════

class QARequest(BaseModel):
    """Request for question answering via RAG."""
    question: str
    user_id: str = Field(alias="userId")
    top_k: int = Field(default=5, alias="topK")

    model_config = {"populate_by_name": True}


class QASource(BaseModel):
    """A source citation for a Q&A answer."""
    document_id: str = Field(alias="documentId", serialization_alias="documentId")
    title: str
    page: int | None = None
    snippet: str
