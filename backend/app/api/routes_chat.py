import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.firebase import AuthUser, HistoryStore, current_user, get_store, safe_call
from app.nim import NimError, NimNotConfigured, nim
from app.nim.prompts import WELLNESS_COACH
from app.rag.retriever import format_context, retrieve
from app.safety.redflags import EMERGENCY_TEXT, screen_text
from app.schemas import ChatRequest
from app.services.router import classify

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    user: AuthUser | None = Depends(current_user),
    store: HistoryStore = Depends(get_store),
) -> StreamingResponse:
    """Streaming coach: red-flag escalation, routing, RAG, then the model.

    Model output is streamed as-is; nothing filters or rewrites it. The one
    thing that runs ahead of the model is the deterministic red-flag screen, so
    an emergency never waits on the model.

    For a signed-in user the finished turn (their message and the reply) is
    saved to Firestore after the stream ends. Anonymous callers are answered
    exactly the same and nothing is stored.
    """
    last = body.messages[-1].content
    persist = bool(user and store.enabled)
    chat_id = (body.chat_id or uuid.uuid4().hex) if persist else None

    reply: list[str] = []           # everything streamed as `content`, for saving
    meta: dict = {}                 # route / red_flag, saved with the reply
    keep = {"turn": True}           # False when the turn failed and should not be saved

    def content(text: str) -> str:
        reply.append(text)
        return _sse("content", {"text": text})

    async def events():
        if persist:
            yield _sse("chat", {"chat_id": chat_id})

        flags = screen_text(last)
        if flags.triggered:
            meta.update(route="clinical", red_flag=True)
            yield _sse("route", {"route": "clinical", "red_flag": True, "categories": flags.categories})
            yield content(EMERGENCY_TEXT)
            yield _sse("done", {"reason": "red_flag", "model_called": False})
            return

        decision = await classify(last)
        meta.update(route=decision["route"], red_flag=False)
        yield _sse("route", decision)

        if decision["route"] == "clinical":
            yield content(
                "That sounds like something for the symptom check rather than coaching — "
                "it scores urgency against fixed rules and tells you whether to see someone. "
                "Open it and I will carry this message across."
            )
            yield _sse("done", {"reason": "handoff", "model_called": False})
            return

        context = ""
        if body.use_rag:
            hits, retriever, latency = await retrieve(last)
            context = format_context(hits)
            yield _sse(
                "citations",
                {
                    "retriever": retriever,
                    "latency_ms": round(latency, 1),
                    "hits": [{"id": h.id, "title": h.title, "source": h.source, "score": h.score} for h in hits],
                },
            )

        system = WELLNESS_COACH
        if body.condition_ids:
            system += f"\n\nThe person's conditions on file: {', '.join(body.condition_ids)}. " \
                      f"Their constraints override any general advice you would otherwise give."

        history = [{"role": m.role, "content": m.content} for m in body.messages[-6:]]
        messages = [{"role": "system", "content": system}]
        if context:
            messages.append({"role": "system", "content": f"CONTEXT:\n{context}"})
        messages.extend(history)

        try:
            async for kind, text in nim.stream(messages=messages, temperature=0.4, thinking=body.thinking):
                if kind == "reasoning":
                    yield _sse("reasoning", {"text": text})
                    continue
                yield content(text)
        except NimNotConfigured:
            keep["turn"] = False
            yield _sse("content", {"text": "The coaching model is not configured on this server, so I can only "
                                           "give you what the rules and the reference library already hold."})
            yield _sse("done", {"reason": "not_configured", "model_called": False})
            return
        except NimError as exc:
            keep["turn"] = False
            yield _sse("error", {"message": f"Model call failed: {exc}"})
            yield _sse("done", {"reason": "error", "model_called": True})
            return

        yield _sse("done", {"reason": "complete", "model_called": True})

    async def gen():
        async for frame in events():
            yield frame
        # Runs once the client has read the final `done` frame, so saving never
        # delays the visible answer. Skipped if the client aborts mid-stream.
        if persist and keep["turn"]:
            await safe_call(store.save_chat_turn, user.uid, chat_id, last, "".join(reply), meta)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
