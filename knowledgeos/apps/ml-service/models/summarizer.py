# apps/ml-service/models/summarizer.py
"""Summarization model using DistilBART-CNN-12-6.

Supports hierarchical summarization for texts longer than the model's
1024-token context window: chunks are summarized individually,
then the chunk summaries are summarized together.
"""

from loguru import logger
from transformers import pipeline, Pipeline

_model: Pipeline | None = None
MODEL_NAME = "sshleifer/distilbart-cnn-12-6"
MAX_INPUT_TOKENS = 1024


def load_summarizer() -> Pipeline:
    """Load the summarization pipeline singleton."""
    global _model
    if _model is None:
        logger.info(f"Loading summarization model: {MODEL_NAME}")
        _model = pipeline(
            "summarization",
            model=MODEL_NAME,
            tokenizer=MODEL_NAME,
            device=-1,  # CPU; set to 0 for GPU
        )
        logger.info(f"Summarization model loaded: {MODEL_NAME}")
    return _model


def _estimate_tokens(text: str) -> int:
    """Rough token count estimate."""
    return len(text.split())


def _chunk_for_summarization(text: str, max_tokens: int = MAX_INPUT_TOKENS) -> list[str]:
    """Split text into chunks that fit within the model's context window."""
    words = text.split()
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_count = 0

    for word in words:
        if current_count + 1 > max_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_count = 0
        current_chunk.append(word)
        current_count += 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def summarize_text(
    text: str,
    max_length: int = 150,
    min_length: int = 50,
) -> tuple[str, int]:
    """Summarize text with hierarchical strategy for long inputs.

    Args:
        text: The text to summarize.
        max_length: Maximum summary length in tokens.
        min_length: Minimum summary length in tokens.

    Returns:
        Tuple of (summary_text, input_token_count).
    """
    summarizer = load_summarizer()
    input_tokens = _estimate_tokens(text)

    if input_tokens <= MAX_INPUT_TOKENS:
        # Text fits in context window — summarize directly
        result = summarizer(
            text,
            max_length=max_length,
            min_length=min_length,
            do_sample=False,
            truncation=True,
        )
        summary = result[0]["summary_text"]  # type: ignore[index]
        return summary, input_tokens

    # Hierarchical summarization for long texts
    logger.debug(f"Text too long ({input_tokens} tokens), using hierarchical summarization")
    chunks = _chunk_for_summarization(text)

    # Summarize each chunk
    chunk_summaries: list[str] = []
    for chunk in chunks:
        result = summarizer(
            chunk,
            max_length=max(60, max_length // len(chunks)),
            min_length=min(20, min_length // len(chunks)),
            do_sample=False,
            truncation=True,
        )
        chunk_summaries.append(result[0]["summary_text"])  # type: ignore[index]

    # Combine chunk summaries and summarize the combined text
    combined = " ".join(chunk_summaries)
    combined_tokens = _estimate_tokens(combined)

    if combined_tokens > MAX_INPUT_TOKENS:
        # Recursively summarize if still too long
        return summarize_text(combined, max_length, min_length)

    result = summarizer(
        combined,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
        truncation=True,
    )
    summary = result[0]["summary_text"]  # type: ignore[index]
    return summary, input_tokens
