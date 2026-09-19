"""Vector store with a lexical fallback.

Deliberately dependency-light: a numpy matrix plus a JSON sidecar. At this
corpus size that is faster than any external database and it means the whole
backend runs offline for tests and for anyone without a key.

Swap `VectorStore` for pgvector or Milvus when the corpus outgrows memory —
`search()` is the only method the retriever calls.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

INDEX_DIR = Path(__file__).resolve().parent.parent / "data" / "index"
_TOKEN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


@dataclass
class Chunk:
    id: str
    title: str
    source: str
    text: str
    tags: list[str]


class VectorStore:
    def __init__(self) -> None:
        self.chunks: list[Chunk] = []
        self.vectors: np.ndarray | None = None
        self._df: Counter[str] = Counter()
        self._tokens: list[list[str]] = []
        self._avg_len: float = 1.0

    # ── persistence ──────────────────────────────────────────────────────
    def save(self, directory: Path = INDEX_DIR) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "chunks.json").write_text(
            json.dumps([asdict(c) for c in self.chunks], indent=2), encoding="utf-8"
        )
        if self.vectors is not None:
            np.save(directory / "vectors.npy", self.vectors)

    def load(self, directory: Path = INDEX_DIR) -> bool:
        chunks_path = directory / "chunks.json"
        if not chunks_path.exists():
            return False
        raw = json.loads(chunks_path.read_text(encoding="utf-8"))
        self.chunks = [Chunk(**c) for c in raw]
        vectors_path = directory / "vectors.npy"
        self.vectors = np.load(vectors_path) if vectors_path.exists() else None
        self._build_lexical()
        return True

    # ── building ─────────────────────────────────────────────────────────
    def set_chunks(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self._build_lexical()

    def set_vectors(self, vectors: list[list[float]]) -> None:
        matrix = np.asarray(vectors, dtype=np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        self.vectors = matrix / np.clip(norms, 1e-8, None)

    def _build_lexical(self) -> None:
        self._tokens = [tokenize(f"{c.title} {c.text}") for c in self.chunks]
        self._df = Counter()
        for toks in self._tokens:
            for term in set(toks):
                self._df[term] += 1
        self._avg_len = (sum(len(t) for t in self._tokens) / len(self._tokens)) if self._tokens else 1.0

    # ── search ───────────────────────────────────────────────────────────
    def search_dense(self, query_vector: list[float], top_k: int) -> list[tuple[int, float]]:
        if self.vectors is None or not len(self.chunks):
            return []
        q = np.asarray(query_vector, dtype=np.float32)
        q = q / max(float(np.linalg.norm(q)), 1e-8)
        scores = self.vectors @ q
        idx = np.argsort(-scores)[:top_k]
        return [(int(i), float(scores[i])) for i in idx]

    def search_lexical(self, query: str, top_k: int) -> list[tuple[int, float]]:
        """BM25. Good enough to keep the app honest when NIM is unreachable."""
        if not self.chunks:
            return []
        k1, b = 1.5, 0.75
        n = len(self.chunks)
        q_terms = tokenize(query)
        scored: list[tuple[int, float]] = []
        for i, toks in enumerate(self._tokens):
            if not toks:
                continue
            tf = Counter(toks)
            length = len(toks)
            score = 0.0
            for term in q_terms:
                if term not in tf:
                    continue
                df = self._df.get(term, 0) or 1
                idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
                freq = tf[term]
                score += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * length / self._avg_len))
            if score > 0:
                scored.append((i, score))
        scored.sort(key=lambda r: -r[1])
        top = scored[:top_k]
        if not top:
            return []
        ceiling = top[0][1] or 1.0
        return [(i, s / ceiling) for i, s in top]  # normalised so thresholds mean something


store = VectorStore()
