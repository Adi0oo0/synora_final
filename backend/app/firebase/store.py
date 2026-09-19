"""Per-user history in Firestore.

Layout (every path is scoped by the verified token's uid, never by anything the
client sends, so one user cannot address another's data):

    users/{uid}                          profile: condition_ids, display_name
    users/{uid}/triage/{auto}            one document per symptom check
    users/{uid}/meals/{auto}             one document per analysed meal (no image)
    users/{uid}/chats/{chat_id}          title, created_at, updated_at
    users/{uid}/chats/{chat_id}/messages/{auto}

Writes are best-effort. A Firestore outage must never break a symptom check or
an emergency response, so callers go through ``safe_call`` and failures are
logged by exception type only (never message text, which could echo health data).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Protocol

from app.config import get_settings
from app.firebase.client import firebase

log = logging.getLogger("zenhealth.store")

MESSAGE_LIMIT = 500


# ── record shaping (shared by every store so they cannot drift) ─────────────
def triage_record(request: dict, result: dict) -> dict:
    return {
        "request": {
            "region": request.get("region"),
            "symptoms": request.get("symptoms") or [],
            "triggers": request.get("triggers") or [],
            "severity": request.get("severity"),
            "duration": request.get("duration"),
            "notes": request.get("notes") or "",
            "condition_ids": request.get("condition_ids") or [],
        },
        "result": {
            "band": result.get("band"),
            "score": result.get("score"),
            "red_flag": result.get("red_flag"),
            "escalation_rules": result.get("escalation_rules") or [],
            "findings": result.get("findings") or [],
            "next_step": result.get("next_step") or {},
            "summary": result.get("summary"),
            "citations": result.get("citations") or [],
        },
    }


def meal_record(result: dict, note: str, condition_ids: list[str]) -> dict:
    # The photo itself is deliberately not stored: it can exceed a Firestore
    # document's 1 MiB limit and is the most identifying thing in the request.
    return {
        "food": result.get("food") or {},
        "impacts": result.get("impacts") or [],
        "overall": result.get("overall"),
        "consistency": result.get("consistency") or {},
        "citations": result.get("citations") or [],
        "note": note or "",
        "condition_ids": condition_ids or [],
    }


def chat_title(text: str) -> str:
    one_line = " ".join((text or "").split())
    return (one_line[:57] + "...") if len(one_line) > 60 else (one_line or "New chat")


def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def _public(doc_id: str, data: dict) -> dict:
    return {"id": doc_id, **{k: _iso(v) for k, v in data.items()}}


class HistoryStore(Protocol):
    enabled: bool

    async def save_triage(self, uid: str, request: dict, result: dict) -> None: ...
    async def save_meal(self, uid: str, result: dict, note: str, condition_ids: list[str]) -> None: ...
    async def save_chat_turn(self, uid: str, chat_id: str, user_text: str, reply_text: str, meta: dict) -> None: ...
    async def list_triage(self, uid: str, limit: int) -> list[dict]: ...
    async def list_meals(self, uid: str, limit: int) -> list[dict]: ...
    async def list_chats(self, uid: str, limit: int) -> list[dict]: ...
    async def get_chat(self, uid: str, chat_id: str) -> dict | None: ...
    async def get_profile(self, uid: str) -> dict: ...
    async def put_profile(self, uid: str, data: dict) -> dict: ...
    async def delete_user_data(self, uid: str) -> None: ...


# ── no-op: Firebase switched off ────────────────────────────────────────────
class NullStore:
    enabled = False

    async def save_triage(self, *a: Any, **k: Any) -> None: ...
    async def save_meal(self, *a: Any, **k: Any) -> None: ...
    async def save_chat_turn(self, *a: Any, **k: Any) -> None: ...
    async def list_triage(self, *a: Any, **k: Any) -> list[dict]: return []
    async def list_meals(self, *a: Any, **k: Any) -> list[dict]: return []
    async def list_chats(self, *a: Any, **k: Any) -> list[dict]: return []
    async def get_chat(self, *a: Any, **k: Any) -> dict | None: return None
    async def get_profile(self, *a: Any, **k: Any) -> dict: return {}
    async def put_profile(self, uid: str, data: dict) -> dict: return data
    async def delete_user_data(self, *a: Any, **k: Any) -> None: ...


# ── in-memory: tests and local hacking, same shape as Firestore ─────────────
class MemoryStore:
    enabled = True

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}
        self._n = 0

    def _u(self, uid: str) -> dict:
        return self.users.setdefault(uid, {"profile": {}, "triage": [], "meals": [], "chats": {}})

    def _id(self) -> str:
        self._n += 1
        return f"doc{self._n:06d}"

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    async def save_triage(self, uid, request, result):
        self._u(uid)["triage"].append((self._id(), {**triage_record(request, result), "created_at": self._now()}))

    async def save_meal(self, uid, result, note, condition_ids):
        self._u(uid)["meals"].append((self._id(), {**meal_record(result, note, condition_ids), "created_at": self._now()}))

    async def save_chat_turn(self, uid, chat_id, user_text, reply_text, meta):
        now = self._now()
        chat = self._u(uid)["chats"].setdefault(
            chat_id, {"title": chat_title(user_text), "created_at": now, "updated_at": now, "messages": []}
        )
        chat["updated_at"] = now
        chat["messages"].append((self._id(), {"role": "user", "content": user_text, "created_at": now}))
        if reply_text:
            chat["messages"].append(
                (self._id(), {"role": "assistant", "content": reply_text, "created_at": now + timedelta(milliseconds=1), **meta})
            )

    async def list_triage(self, uid, limit):
        return [_public(i, d) for i, d in reversed(self._u(uid)["triage"])][:limit]

    async def list_meals(self, uid, limit):
        return [_public(i, d) for i, d in reversed(self._u(uid)["meals"])][:limit]

    async def list_chats(self, uid, limit):
        chats = self._u(uid)["chats"]
        rows = sorted(chats.items(), key=lambda kv: kv[1]["updated_at"], reverse=True)
        return [_public(i, {k: v for k, v in d.items() if k != "messages"}) for i, d in rows][:limit]

    async def get_chat(self, uid, chat_id):
        chat = self._u(uid)["chats"].get(chat_id)
        if chat is None:
            return None
        head = _public(chat_id, {k: v for k, v in chat.items() if k != "messages"})
        return {**head, "messages": [_public(i, d) for i, d in chat["messages"][:MESSAGE_LIMIT]]}

    async def get_profile(self, uid):
        return {k: _iso(v) for k, v in self._u(uid)["profile"].items()}

    async def put_profile(self, uid, data):
        self._u(uid)["profile"].update({**data, "updated_at": self._now()})
        return await self.get_profile(uid)

    async def delete_user_data(self, uid):
        self.users.pop(uid, None)


# ── Firestore ───────────────────────────────────────────────────────────────
class FirestoreStore:
    """firebase-admin's Firestore client is synchronous, so every call runs in a
    worker thread rather than blocking the event loop."""

    enabled = True

    @staticmethod
    def _user(uid: str) -> Any:
        return firebase.db().collection("users").document(uid)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    async def save_triage(self, uid, request, result):
        doc = {**triage_record(request, result), "created_at": self._now()}
        await asyncio.to_thread(lambda: self._user(uid).collection("triage").add(doc))

    async def save_meal(self, uid, result, note, condition_ids):
        doc = {**meal_record(result, note, condition_ids), "created_at": self._now()}
        await asyncio.to_thread(lambda: self._user(uid).collection("meals").add(doc))

    async def save_chat_turn(self, uid, chat_id, user_text, reply_text, meta):
        def write() -> None:
            db = firebase.db()
            now = self._now()
            chat = self._user(uid).collection("chats").document(chat_id)
            batch = db.batch()
            if chat.get().exists:
                batch.set(chat, {"updated_at": now}, merge=True)
            else:
                batch.set(chat, {"title": chat_title(user_text), "created_at": now, "updated_at": now})
            msgs = chat.collection("messages")
            batch.set(msgs.document(), {"role": "user", "content": user_text, "created_at": now})
            if reply_text:
                batch.set(
                    msgs.document(),
                    {"role": "assistant", "content": reply_text, "created_at": now + timedelta(milliseconds=1), **meta},
                )
            batch.commit()

        await asyncio.to_thread(write)

    async def _recent(self, uid: str, name: str, order: str, limit: int) -> list[dict]:
        def read() -> list[dict]:
            from google.cloud.firestore_v1 import Query

            q = self._user(uid).collection(name).order_by(order, direction=Query.DESCENDING).limit(limit)
            return [_public(s.id, s.to_dict() or {}) for s in q.stream()]

        return await asyncio.to_thread(read)

    async def list_triage(self, uid, limit):
        return await self._recent(uid, "triage", "created_at", limit)

    async def list_meals(self, uid, limit):
        return await self._recent(uid, "meals", "created_at", limit)

    async def list_chats(self, uid, limit):
        return await self._recent(uid, "chats", "updated_at", limit)

    async def get_chat(self, uid, chat_id):
        def read() -> dict | None:
            chat = self._user(uid).collection("chats").document(chat_id)
            snap = chat.get()
            if not snap.exists:
                return None
            msgs = chat.collection("messages").order_by("created_at").limit(MESSAGE_LIMIT).stream()
            return {**_public(chat_id, snap.to_dict() or {}), "messages": [_public(m.id, m.to_dict() or {}) for m in msgs]}

        return await asyncio.to_thread(read)

    async def get_profile(self, uid):
        def read() -> dict:
            snap = self._user(uid).get()
            return {k: _iso(v) for k, v in (snap.to_dict() or {}).items()} if snap.exists else {}

        return await asyncio.to_thread(read)

    async def put_profile(self, uid, data):
        def write() -> None:
            self._user(uid).set({**data, "updated_at": self._now()}, merge=True)

        await asyncio.to_thread(write)
        return await self.get_profile(uid)

    async def delete_user_data(self, uid):
        # Deletes the profile document and every subcollection under it.
        await asyncio.to_thread(lambda: firebase.db().recursive_delete(self._user(uid)))


# ── wiring ──────────────────────────────────────────────────────────────────
_store: HistoryStore = NullStore()


def init_store() -> HistoryStore:
    """Called once from the app lifespan, after ``firebase.init()``."""
    global _store
    _store = FirestoreStore() if firebase.ready else NullStore()
    return _store


def get_store() -> HistoryStore:
    """FastAPI dependency. Tests override it with a MemoryStore."""
    return _store


def save_inline() -> bool:
    """True when writes must finish inside the request (serverless hosts)."""
    return get_settings().firebase_save_inline or bool(os.getenv("VERCEL"))


async def persist(background: Any, fn: Callable[..., Awaitable[Any]], *args: Any) -> None:
    """Save history without ever raising into the request.

    Normally the write is queued to run after the response is sent, so it adds
    no latency. On serverless hosts it is awaited before responding instead.
    """
    if save_inline():
        await safe_call(fn, *args)
    else:
        background.add_task(safe_call, fn, *args)


async def safe_call(fn: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any) -> Any:
    """Run a store write without ever raising into the request."""
    try:
        return await fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001 - persistence must not break a response
        log.warning("history write failed (%s)", type(exc).__name__)
        return None
