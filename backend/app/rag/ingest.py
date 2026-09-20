"""Corpus ingestion: markdown with frontmatter to embedded chunks.

Run once at startup (or `python -m app.rag.ingest`). If embeddings are
unavailable the index still builds — lexical search covers it.
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

from synora_final.backend.app.nim import NimError, NimNotConfigured, nim
from synora_final.backend.app.rag.store import Chunk, VectorStore, store

log = logging.getLogger("zenhealth.rag")

CORPUS_DIR = Path(__file__).resolve().parent.parent / "data" / "corpus"
FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.S)

# Paragraph-level chunks with a small overlap. Clinical guidance is written in
# self-contained paragraphs, so splitting on them beats a fixed token window.
TARGET_CHARS = 900
OVERLAP_CHARS = 150


def _parse_frontmatter(raw: str) -> tuple[dict[str, str | list[str]], str]:
    match = FRONTMATTER.match(raw)
    if not match:
        return {}, raw
    meta: dict[str, str | list[str]] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            meta[key.strip()] = [v.strip() for v in value[1:-1].split(",") if v.strip()]
        else:
            meta[key.strip()] = value
    return meta, raw[match.end():]


def chunk_document(doc_id: str, title: str, source: str, tags: list[str], body: str) -> list[Chunk]:
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    chunks: list[Chunk] = []
    buffer = ""
    for para in paragraphs:
        if buffer and len(buffer) + len(para) > TARGET_CHARS:
            chunks.append(buffer)
            buffer = (buffer[-OVERLAP_CHARS:] + "\n\n" + para) if OVERLAP_CHARS else para
        else:
            buffer = f"{buffer}\n\n{para}".strip()
    if buffer:
        chunks.append(buffer)
    return [
        Chunk(id=f"{doc_id}#{i}", title=title, source=source, text=text, tags=tags)
        for i, text in enumerate(chunks)
    ]


def load_chunks(corpus_dir: Path = CORPUS_DIR) -> list[Chunk]:
    out: list[Chunk] = []
    for path in sorted(corpus_dir.glob("*.md")):
        meta, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
        tags = meta.get("tags", [])
        out.extend(
            chunk_document(
                doc_id=path.stem,
                title=str(meta.get("title", path.stem)),
                source=str(meta.get("source", "internal")),
                tags=tags if isinstance(tags, list) else [str(tags)],
                body=body,
            )
        )
    return out


async def build_index(target: VectorStore | None = None) -> dict[str, object]:
    target = target or store
    chunks = load_chunks()
    target.set_chunks(chunks)

    embedded = False
    try:
        await nim.open()
        vectors: list[list[float]] = []
        for i in range(0, len(chunks), 32):  # batch — embedding endpoints cap input size
            batch = [f"{c.title}\n{c.text}" for c in chunks[i : i + 32]]
            vectors.extend(await nim.embed(batch, input_type="passage"))
        target.set_vectors(vectors)
        embedded = True
    except (NimNotConfigured, NimError) as exc:
        log.warning("embeddings unavailable (%s) — index is lexical only", exc)

    try:
        target.save()
    except OSError as exc:
        # Read-only filesystems (Vercel, most serverless hosts): the index stays
        # in memory for this process. Prebuild and commit it to avoid rebuilding.
        log.warning("could not write the index to disk (%s) — keeping it in memory", exc)
    return {"chunks": len(chunks), "embedded": embedded}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(asyncio.run(build_index()))
