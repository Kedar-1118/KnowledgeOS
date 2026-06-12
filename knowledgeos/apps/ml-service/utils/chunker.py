# apps/ml-service/utils/chunker.py
"""Text chunking utility for the ML service.

Mirrors the chunking logic in the Node backend's fileParser.ts
to ensure consistency when re-chunking is needed on the ML side.
"""


APPROXIMATE_CHARS_PER_TOKEN = 4
MAX_CHUNK_TOKENS = 512
CHUNK_OVERLAP_TOKENS = 50


def estimate_tokens(text: str) -> int:
    """Estimate token count using character-based approximation (~4 chars/token)."""
    return max(1, len(text) // APPROXIMATE_CHARS_PER_TOKEN)


def split_sentences(text: str) -> list[str]:
    """Split text into sentences at sentence-ending punctuation."""
    import re

    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_text(
    text: str,
    max_tokens: int = MAX_CHUNK_TOKENS,
    overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
) -> list[str]:
    """Split text into overlapping chunks respecting sentence boundaries.

    Args:
        text: The input text to chunk.
        max_tokens: Maximum tokens per chunk.
        overlap_tokens: Number of overlap tokens between chunks.

    Returns:
        A list of chunk strings.
    """
    sentences = split_sentences(text)
    chunks: list[str] = []
    current_sentences: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = estimate_tokens(sentence)

        # If a single sentence exceeds max, split by words
        if sentence_tokens > max_tokens and not current_sentences:
            words = sentence.split()
            word_chunk: list[str] = []
            word_tokens = 0

            for word in words:
                w_tokens = estimate_tokens(word + " ")
                if word_tokens + w_tokens > max_tokens and word_chunk:
                    chunks.append(" ".join(word_chunk))
                    word_chunk = []
                    word_tokens = 0
                word_chunk.append(word)
                word_tokens += w_tokens

            if word_chunk:
                chunks.append(" ".join(word_chunk))
            continue

        # Would adding this sentence exceed the limit?
        if current_tokens + sentence_tokens > max_tokens and current_sentences:
            chunks.append(" ".join(current_sentences))

            # Calculate overlap
            overlap_token_count = 0
            overlap_start = len(current_sentences)
            for j in range(len(current_sentences) - 1, -1, -1):
                overlap_token_count += estimate_tokens(current_sentences[j])
                overlap_start = j
                if overlap_token_count >= overlap_tokens:
                    break

            current_sentences = current_sentences[overlap_start:]
            current_tokens = sum(estimate_tokens(s) for s in current_sentences)

        current_sentences.append(sentence)
        current_tokens += sentence_tokens

    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks
