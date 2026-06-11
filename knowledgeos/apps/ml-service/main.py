# apps/ml-service/main.py
"""KnowledgeOS ML Service — FastAPI application entry point."""

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
    logger.info("Model loading will be implemented in Phase 2")

    # Phase 2 will load models here:
    # - SentenceTransformer('all-MiniLM-L6-v2')
    # - DistilBART-CNN summarizer
    # - DistilBERT tagger
    # - spaCy en_core_web_trf

    yield

    logger.info("Shutting down KnowledgeOS ML Service...")


app = FastAPI(
    title="KnowledgeOS ML Service",
    description="Machine learning inference service for KnowledgeOS",
    version="0.1.0",
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
    return HealthResponse(
        status="ok",
        version="0.1.0",
        uptime=time.time() - _start_time,
        models_loaded={
            "embedder": False,  # Phase 2
            "summarizer": False,  # Phase 2
            "tagger": False,  # Phase 2
            "ner": False,  # Phase 2
            "recommender": False,  # Phase 4
        },
    )


# Phase 2 routers will be mounted here:
# from routers import embed, summarize, tag, search, qa, entities
# app.include_router(embed.router, prefix="/ml", tags=["Embedding"])
# app.include_router(summarize.router, prefix="/ml", tags=["Summarization"])
# app.include_router(tag.router, prefix="/ml", tags=["Tagging"])
# app.include_router(search.router, prefix="/ml", tags=["Search"])
# app.include_router(qa.router, prefix="/ml", tags=["Q&A"])
# app.include_router(entities.router, prefix="/ml", tags=["Entities"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("ML_SERVICE_PORT", "8000")),
        reload=os.getenv("NODE_ENV", "development") == "development",
    )
