"""Retrieve → rerank → format.

Dense recall with a reranker on top is the standard two-stage setup: the
embedding pass is cheap and over-fetches, the reranker is expensive and
precise. Lexical BM25 covers the no-key path so nothing downstream has to
branch on whether NIM is reachable.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from synora_final.backend.app.config import get_settings
from synora_final.backend.app.nim import NimError, NimNotConfigured, nim
from synora_final.backend.app.rag.store import store

log = logging.getLogger("zenhealth.rag")


@dataclass
class Hit:
    id: str
    title: str
    source: str
    text: str
    score: float


async def retrieve(query: str, top_k: int | None = None) -> tuple[list[Hit], str, float]:
    """Returns ``(hits, retriever_used, latency_ms)``."""
    s = get_settings()
    started = time.perf_counter()
    top_k = top_k or s.rag_rerank_to
    fetch = max(top_k, s.rag_top_k)
    retriever = "lexical"
    candidates: list[tuple[int, float]] = []

    if s.configured and store.vectors is not None:
        try:
            [vector] = await nim.embed([query], input_type="query")
            candidates = store.search_dense(vector, fetch)
            retriever = "nim"
        except (NimNotConfigured, NimError) as exc:
            log.warning("dense retrieval failed (%s) — falling back to lexical", exc)

    if not candidates:
        candidates = store.search_lexical(query, fetch)

    if not candidates:
        return [], retriever, (time.perf_counter() - started) * 1000

    # Rerank the shortlist. If it fails, dense order is still a decent answer.
    if retriever == "nim" and len(candidates) > top_k:
        try:
            passages = [store.chunks[i].text for i, _ in candidates]
            ranked = await nim.rerank(query, passages)
            candidates = [(candidates[idx][0], logit) for idx, logit in ranked]
            retriever = "nim"
        except (NimNotConfigured, NimError) as exc:
            log.warning("rerank failed (%s) — keeping dense order", exc)

    hits = [
        Hit(
            id=store.chunks[i].id,
            title=store.chunks[i].title,
            source=store.chunks[i].source,
            text=store.chunks[i].text,
            score=round(float(score), 4),
        )
        for i, score in candidates[:top_k]
    ]
    return hits, retriever, (time.perf_counter() - started) * 1000


def format_context(hits: list[Hit], max_chars: int = 4000) -> str:
    """Numbered, id-tagged context so the model can cite and we can verify."""
    parts: list[str] = []
    used = 0
    for hit in hits:
        block = f"[{hit.id}] {hit.title} ({hit.source})\n{hit.text}"
        if used + len(block) > max_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n\n---\n\n".join(parts) if parts else "(no relevant passages retrieved)"
