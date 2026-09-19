from fastapi import APIRouter

from app.config import get_settings
from app.firebase import firebase
from app.rag.store import store

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "nim_configured": s.configured,
        "models": {
            "reasoning": s.nim_model_reasoning,
            "light": s.nim_model_light,
            "vision": s.nim_model_vision,
            "embed": s.nim_model_embed,
            "rerank": s.nim_model_rerank,
        },
        "firebase": {"configured": firebase.configured, "ready": firebase.ready},
        "rag": {
            "chunks": len(store.chunks),
            "dense_index": store.vectors is not None,
            "mode": "dense+rerank" if store.vectors is not None else "lexical",
        },
    }
