# apps/ml-service/main.py
"""KnowledgeOS ML Service — FastAPI application entry point.

Loads ML models on startup and exposes endpoints for:
- Embedding generation (POST /ml/embed)
- Summarization (POST /ml/summarize)
- Auto-tagging (POST /ml/tag)
- Entity extraction (POST /ml/extract-entities)
- Semantic search (POST /ml/search)
- Q&A / RAG (POST /ml/qa)
"""

import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel

load_dotenv()

# Track startup time for health checks
_start_time: float = 0.0
_models_loaded: dict[str, bool] = {
    "embedder": False,
    "summarizer": False,
    "tagger": False,
    "ner": False,
    "cross_encoder": False,
    "recommender": False,
}


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    version: str
    uptime: float
    models_loaded: dict[str, bool]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — load models on startup, cleanup on shutdown."""
    global _start_time
    _start_time = time.time()

    logger.info("Starting KnowledgeOS ML Service...")

    # Load embedding model (required for search, tagging, embedding)
    try:
        from models.embedder import load_embedder

        load_embedder()
        _models_loaded["embedder"] = True
    except Exception as e:
        logger.error(f"Failed to load embedder: {e}")

    # Load summarization model
    try:
        from models.summarizer import load_summarizer

        load_summarizer()
        _models_loaded["summarizer"] = True
    except Exception as e:
        logger.error(f"Failed to load summarizer: {e}")

    # Pre-compute topic embeddings for tagger
    try:
        from models.tagger import _load_topic_embeddings

        _load_topic_embeddings()
        _models_loaded["tagger"] = True
    except Exception as e:
        logger.error(f"Failed to load tagger: {e}")

    # Load spaCy NER model
    try:
        from models.ner_extractor import load_nlp

        load_nlp()
        _models_loaded["ner"] = True
    except Exception as e:
        logger.error(f"Failed to load NER model: {e}")

    logger.info(f"Models loaded: {_models_loaded}")
    logger.info(f"ML Service startup completed in {time.time() - _start_time:.1f}s")

    yield

    logger.info("Shutting down KnowledgeOS ML Service...")


app = FastAPI(
    title="KnowledgeOS ML Service",
    description="Machine learning inference service for KnowledgeOS",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware — allow backend service to call ML endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("BACKEND_URL", "http://localhost:4000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint returning service status and loaded models."""
    all_critical_loaded = all(
        _models_loaded.get(m, False) for m in ["embedder", "summarizer", "ner"]
    )
    status = "ok" if all_critical_loaded else "degraded"

    return HealthResponse(
        status=status,
        version="0.2.0",
        uptime=time.time() - _start_time,
        models_loaded=_models_loaded,
    )


# ─── Mount Routers ───
from routers import embed, summarize, tag, entities, search, qa  # noqa: E402

app.include_router(embed.router, prefix="/ml", tags=["Embedding"])
app.include_router(summarize.router, prefix="/ml", tags=["Summarization"])
app.include_router(tag.router, prefix="/ml", tags=["Tagging"])
app.include_router(entities.router, prefix="/ml", tags=["Entities"])
app.include_router(search.router, prefix="/ml", tags=["Search"])
app.include_router(qa.router, prefix="/ml", tags=["Q&A"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("ML_SERVICE_PORT", "8000")),
        reload=os.getenv("NODE_ENV", "development") == "development",
    )
