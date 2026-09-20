from fastapi import APIRouter

from synora_final.backend.app.rag.ingest import build_index
from synora_final.backend.app.rag.retriever import retrieve
from synora_final.backend.app.schemas import SearchRequest, SearchResponse

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/search", response_model=SearchResponse)
async def search(body: SearchRequest) -> SearchResponse:
    hits, retriever, latency = await retrieve(body.query, top_k=body.top_k)
    return SearchResponse(
        hits=[h.__dict__ for h in hits],
        retriever="nim" if retriever == "nim" else "lexical",
        latency_ms=round(latency, 1),
    )


@router.post("/reindex")
async def reindex() -> dict:
    """Rebuild the index after editing the corpus. Put this behind auth in
    production — it costs embedding calls."""
    return await build_index()
