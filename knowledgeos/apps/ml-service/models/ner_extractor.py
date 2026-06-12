# apps/ml-service/models/ner_extractor.py
"""Named Entity Recognition and relation extraction using spaCy.

Extracts entities (PERSON, ORG, TECHNOLOGY, CONCEPT) and
co-occurrence-based relations from document text.
Uses spaCy's en_core_web_sm model (en_core_web_trf for production).
Includes custom rule-based patterns for tech/CS terms.
"""

import re
from collections import Counter, defaultdict

from loguru import logger

_nlp = None

# ─── Custom Technology Term Patterns ───
# Maps specific terms to their parent concept categories
TECH_TERM_MAPPINGS: dict[str, str] = {
    "cnn": "Deep Learning",
    "convolutional neural network": "Deep Learning",
    "rnn": "Deep Learning",
    "recurrent neural network": "Deep Learning",
    "lstm": "Deep Learning",
    "transformer": "Deep Learning",
    "bert": "NLP",
    "gpt": "NLP",
    "attention mechanism": "Deep Learning",
    "backpropagation": "Neural Networks",
    "gradient descent": "Optimization",
    "random forest": "Machine Learning",
    "decision tree": "Machine Learning",
    "svm": "Machine Learning",
    "support vector machine": "Machine Learning",
    "k-means": "Clustering",
    "naive bayes": "Machine Learning",
    "linear regression": "Machine Learning",
    "logistic regression": "Machine Learning",
    "mutex": "Operating Systems",
    "semaphore": "Operating Systems",
    "deadlock": "Operating Systems",
    "process scheduling": "Operating Systems",
    "tcp": "Networking",
    "http": "Networking",
    "dns": "Networking",
    "sql": "Databases",
    "nosql": "Databases",
    "b-tree": "Data Structures",
    "hash table": "Data Structures",
    "linked list": "Data Structures",
    "binary search": "Algorithms",
    "dynamic programming": "Algorithms",
    "dijkstra": "Algorithms",
    "docker": "DevOps",
    "kubernetes": "DevOps",
    "react": "Web Development",
    "python": "Programming Languages",
    "javascript": "Programming Languages",
    "typescript": "Programming Languages",
    "java": "Programming Languages",
    "c++": "Programming Languages",
    "rust": "Programming Languages",
    "neural network": "Deep Learning",
    "machine learning": "Artificial Intelligence",
    "deep learning": "Artificial Intelligence",
    "natural language processing": "Artificial Intelligence",
    "computer vision": "Artificial Intelligence",
    "reinforcement learning": "Artificial Intelligence",
}

# Regex patterns for detecting tech terms in text
TECH_PATTERNS = [
    re.compile(r'\b(?:' + '|'.join(
        re.escape(term) for term in TECH_TERM_MAPPINGS.keys()
    ) + r')\b', re.IGNORECASE)
]


def load_nlp():
    """Load spaCy model singleton. Falls back to sm if trf is not installed."""
    global _nlp
    if _nlp is None:
        try:
            import spacy
            try:
                _nlp = spacy.load("en_core_web_trf")
                logger.info("Loaded spaCy model: en_core_web_trf")
            except OSError:
                try:
                    _nlp = spacy.load("en_core_web_sm")
                    logger.info("Loaded spaCy model: en_core_web_sm (fallback)")
                except OSError:
                    logger.warning("No spaCy model found. Downloading en_core_web_sm...")
                    import subprocess
                    subprocess.run(
                        ["python", "-m", "spacy", "download", "en_core_web_sm"],
                        check=True,
                    )
                    _nlp = spacy.load("en_core_web_sm")
                    logger.info("Downloaded and loaded en_core_web_sm")
        except ImportError:
            logger.error("spaCy not installed")
            raise
    return _nlp


def _extract_tech_terms(text: str) -> list[dict[str, str | int]]:
    """Extract technology terms using pattern matching."""
    found: Counter[str] = Counter()
    text_lower = text.lower()

    for term in TECH_TERM_MAPPINGS:
        # Count occurrences (case-insensitive)
        count = len(re.findall(r'\b' + re.escape(term) + r'\b', text_lower))
        if count > 0:
            found[term] = count

    results: list[dict[str, str | int]] = []
    for term, count in found.most_common():
        results.append({
            "text": term.title(),
            "type": "TECHNOLOGY",
            "count": count,
        })

    return results


def extract_entities(text: str) -> tuple[list[dict[str, str | int]], list[dict[str, str | float]]]:
    """Extract named entities and relations from text.

    Args:
        text: Input text to analyze.

    Returns:
        Tuple of (entities, relations) where:
        - entities: list of {text, type, count}
        - relations: list of {source, target, type, strength}
    """
    nlp = load_nlp()

    # Truncate very long texts to prevent memory issues
    max_chars = 100_000
    if len(text) > max_chars:
        text = text[:max_chars]
        logger.debug(f"Truncated text to {max_chars} chars for NER")

    doc = nlp(text)

    # ─── Entity Extraction ───
    entity_counter: Counter[tuple[str, str]] = Counter()

    # spaCy NER entities
    type_mapping = {
        "PERSON": "PERSON",
        "ORG": "TECHNOLOGY",
        "GPE": "PLACE",
        "LOC": "PLACE",
        "PRODUCT": "TECHNOLOGY",
        "WORK_OF_ART": "CONCEPT",
        "EVENT": "CONCEPT",
        "LAW": "CONCEPT",
        "NORP": "CONCEPT",
    }

    for ent in doc.ents:
        mapped_type = type_mapping.get(ent.label_, None)
        if mapped_type:
            clean_text = ent.text.strip()
            if len(clean_text) > 2:  # Skip very short entities
                entity_counter[(clean_text, mapped_type)] += 1

    # Custom tech term extraction
    tech_entities = _extract_tech_terms(text)
    for tech in tech_entities:
        entity_counter[(str(tech["text"]), "TECHNOLOGY")] += int(tech["count"])

    # Build entity list
    entities: list[dict[str, str | int]] = []
    for (entity_text, entity_type), count in entity_counter.most_common(50):
        entities.append({
            "text": entity_text,
            "type": entity_type,
            "count": count,
        })

    # ─── Relation Extraction ───
    # Co-occurrence within same sentence = relation
    sentence_entities: dict[int, list[str]] = defaultdict(list)

    for sent_idx, sent in enumerate(doc.sents):
        for ent in sent.ents:
            mapped_type = type_mapping.get(ent.label_, None)
            if mapped_type and len(ent.text.strip()) > 2:
                sentence_entities[sent_idx].append(ent.text.strip())

    # Also add tech terms per sentence
    for sent_idx, sent in enumerate(doc.sents):
        sent_text = sent.text.lower()
        for term in TECH_TERM_MAPPINGS:
            if term in sent_text:
                sentence_entities[sent_idx].append(term.title())

    # Build relations from co-occurrences
    relation_counter: Counter[tuple[str, str]] = Counter()
    for entities_in_sent in sentence_entities.values():
        unique_ents = list(set(entities_in_sent))
        for i in range(len(unique_ents)):
            for j in range(i + 1, len(unique_ents)):
                pair = tuple(sorted([unique_ents[i], unique_ents[j]]))
                relation_counter[(pair[0], pair[1])] += 1

    relations: list[dict[str, str | float]] = []
    for (source, target), count in relation_counter.most_common(30):
        # Strength based on co-occurrence count (normalized to 0-1)
        strength = min(1.0, count / 5.0)
        if strength >= 0.2:  # Only include meaningful relations
            relations.append({
                "source": source,
                "target": target,
                "type": "CO_OCCURS",
                "strength": round(strength, 3),
            })

    logger.info(f"Extracted {len(entities)} entities and {len(relations)} relations")
    return entities, relations
