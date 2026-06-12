# apps/ml-service/models/tagger.py
"""Auto-tagging model using cosine similarity against predefined topic embeddings.

Uses the MiniLM embedder to encode document titles/summaries, then compares
against pre-computed embeddings for known topic categories.
Returns top-5 tags with confidence > 0.35.
"""

import numpy as np
from loguru import logger

from models.embedder import embed_single, load_embedder

# ─── Predefined Topics ───
# Each topic has a label, category, and representative description
# that will be embedded for similarity comparison.

TOPIC_DEFINITIONS: list[dict[str, str]] = [
    {"label": "Computer Science", "category": "CS", "desc": "computer science algorithms data structures programming software engineering"},
    {"label": "Machine Learning", "category": "ML", "desc": "machine learning classification regression supervised unsupervised learning features training"},
    {"label": "Deep Learning", "category": "DL", "desc": "deep learning neural networks layers backpropagation gradient descent convolutional recurrent"},
    {"label": "Natural Language Processing", "category": "NLP", "desc": "natural language processing text mining tokenization embeddings transformers language models"},
    {"label": "Operating Systems", "category": "OS", "desc": "operating systems processes threads scheduling memory management file systems kernel"},
    {"label": "Database Systems", "category": "DBMS", "desc": "database systems SQL queries indexing normalization transactions ACID relational schema"},
    {"label": "Computer Networks", "category": "Networks", "desc": "computer networks TCP IP protocols routing switching HTTP DNS network security"},
    {"label": "Mathematics", "category": "Math", "desc": "mathematics calculus linear algebra probability statistics discrete math proofs theorems"},
    {"label": "Physics", "category": "Physics", "desc": "physics mechanics electromagnetism thermodynamics quantum mechanics relativity optics"},
    {"label": "Chemistry", "category": "Chemistry", "desc": "chemistry organic inorganic physical chemistry reactions molecular bonds periodic table"},
    {"label": "Biology", "category": "Biology", "desc": "biology genetics molecular cell biology evolution ecology microbiology biochemistry"},
    {"label": "Law", "category": "Law", "desc": "law legal jurisprudence constitutional criminal civil contract tort legislation courts"},
    {"label": "Medicine", "category": "Medicine", "desc": "medicine clinical diagnosis treatment pathology pharmacology anatomy physiology"},
    {"label": "Finance", "category": "Finance", "desc": "finance economics markets investment banking portfolio risk management accounting"},
    {"label": "History", "category": "History", "desc": "history civilization ancient medieval modern world war revolution culture society"},
    {"label": "Literature", "category": "Literature", "desc": "literature poetry prose fiction novel drama criticism literary analysis writing"},
    {"label": "Philosophy", "category": "Philosophy", "desc": "philosophy ethics metaphysics epistemology logic aesthetics existentialism mind"},
    {"label": "Artificial Intelligence", "category": "ML", "desc": "artificial intelligence AI agents search planning reasoning knowledge representation"},
    {"label": "Computer Vision", "category": "DL", "desc": "computer vision image recognition object detection segmentation CNN image processing"},
    {"label": "Data Science", "category": "ML", "desc": "data science analytics visualization pandas numpy statistics exploratory data analysis"},
    {"label": "Web Development", "category": "CS", "desc": "web development frontend backend HTML CSS JavaScript React Node.js API REST"},
    {"label": "Cybersecurity", "category": "CS", "desc": "cybersecurity encryption authentication vulnerability penetration testing malware firewall"},
]

_topic_embeddings: np.ndarray | None = None
_topic_labels: list[dict[str, str]] | None = None


def _load_topic_embeddings() -> tuple[np.ndarray, list[dict[str, str]]]:
    """Pre-compute embeddings for all topic descriptions."""
    global _topic_embeddings, _topic_labels

    if _topic_embeddings is not None and _topic_labels is not None:
        return _topic_embeddings, _topic_labels

    logger.info("Computing topic embeddings for tagger...")
    model = load_embedder()

    descriptions = [t["desc"] for t in TOPIC_DEFINITIONS]
    embeddings = model.encode(
        descriptions,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    _topic_embeddings = np.array(embeddings, dtype=np.float32)
    _topic_labels = [{"label": t["label"], "category": t["category"]} for t in TOPIC_DEFINITIONS]

    logger.info(f"Topic embeddings computed: {len(TOPIC_DEFINITIONS)} topics")
    return _topic_embeddings, _topic_labels


def tag_document(
    title: str,
    summary: str,
    top_k: int = 5,
    min_confidence: float = 0.35,
) -> list[dict[str, str | float]]:
    """Assign tags to a document based on title + summary similarity.

    Args:
        title: Document title.
        summary: Document summary text.
        top_k: Maximum number of tags to return.
        min_confidence: Minimum cosine similarity threshold.

    Returns:
        List of dicts with label, category, and confidence.
    """
    topic_embeddings, topic_labels = _load_topic_embeddings()

    # Combine title and summary for embedding
    text = f"{title}. {summary}" if summary else title
    doc_embedding = embed_single(text)

    # Compute cosine similarities (embeddings are already normalized)
    similarities = np.dot(topic_embeddings, doc_embedding)

    # Get top-K above threshold
    top_indices = np.argsort(similarities)[::-1][:top_k]

    results: list[dict[str, str | float]] = []
    for idx in top_indices:
        confidence = float(similarities[idx])
        if confidence >= min_confidence:
            label_info = topic_labels[idx]
            results.append({
                "label": label_info["label"],
                "category": label_info["category"],
                "confidence": round(confidence, 4),
            })

    logger.debug(f"Tagged '{title}': {[r['label'] for r in results]}")
    return results
