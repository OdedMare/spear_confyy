import re
from typing import Dict, Iterable, List, Set


STOP_WORDS = {
    "איך",
    "מה",
    "עם",
    "של",
    "את",
    "אני",
    "זה",
    "the",
    "and",
    "how",
    "what",
    "can",
}


def _tokens(value: str) -> Set[str]:
    words = re.findall(r"[\w\-]+", value.lower(), flags=re.UNICODE)
    return {word for word in words if len(word) > 1 and word not in STOP_WORDS}


def retrieve_documents(
    query: str,
    documents: Iterable[Dict[str, str]],
    limit: int = 4,
) -> List[Dict[str, str]]:
    """Small V1 lexical search; PostgreSQL FTS replaces the in-memory list later."""
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    ranked = []
    for document in documents:
        searchable = "%s %s" % (document.get("title", ""), document.get("content", ""))
        overlap = len(query_tokens.intersection(_tokens(searchable)))
        if overlap:
            ranked.append((overlap, document))

    ranked.sort(key=lambda item: (-item[0], item[1].get("title", "")))
    return [item[1] for item in ranked[:limit]]


SECRET_PATTERNS = (
    re.compile(r"(?i)(bearer\s+)[a-z0-9._\-]+"),
    re.compile(r"(?i)((?:api[_-]?key|token|password)\s*[:=]\s*)\S+"),
)


def sanitize_public_question(message: str, limit: int = 160) -> str:
    cleaned = " ".join(message.split())
    for pattern in SECRET_PATTERNS:
        cleaned = pattern.sub(r"\1[הוסר]", cleaned)
    return cleaned[:limit].rstrip()

