"""Auth and persistence, exercised against the in-memory store.

No credentials, no network, and no model call: the chat cases use messages that
the rules answer (red flag, clinical handoff) so nothing reaches NIM even if a
key happens to be in .env.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app.firebase import (
    AuthError,
    AuthUser,
    MemoryStore,
    NullStore,
    current_user,
    firebase,
    get_store,
    require_user,
)
from app.firebase.store import chat_title, safe_call, save_inline
from app.main import app

TRIAGE = dict(region="chest", symptoms=["burning"], triggers=["meals"], severity=3, duration="days", explain=False)
EMERGENCY = "I have chest pain spreading to my arm"


@pytest.fixture
def api():
    store = MemoryStore()
    who = {"user": AuthUser(uid="alice", email="alice@example.com")}
    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[current_user] = lambda: who["user"]
    app.dependency_overrides[require_user] = lambda: who["user"]
    yield TestClient(app), store, who
    app.dependency_overrides.clear()


def sse(text: str) -> list[tuple[str, dict]]:
    frames = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.split("\n") if ": " in line)
        frames.append((lines["event"], json.loads(lines["data"])))
    return frames


# ── triage / meals ───────────────────────────────────────────────────────
def test_signed_in_triage_is_saved_under_the_users_uid(api):
    client, store, _ = api
    assert client.post("/api/triage", json=TRIAGE).status_code == 200
    rows = client.get("/api/me/triage").json()["items"]
    assert len(rows) == 1
    assert rows[0]["request"]["region"] == "chest"
    assert rows[0]["result"]["band"] == "low"
    assert "created_at" in rows[0]
    assert set(store.users) == {"alice"}


def test_anonymous_triage_is_answered_and_not_saved(api):
    client, store, who = api
    who["user"] = None
    assert client.post("/api/triage", json=TRIAGE).status_code == 200
    assert store.users == {}


def test_one_user_cannot_see_anothers_history(api):
    client, _, who = api
    client.post("/api/triage", json=TRIAGE)
    who["user"] = AuthUser(uid="bob")
    assert client.get("/api/me/triage").json()["items"] == []


def test_history_endpoint_respects_limit_and_newest_first(api):
    client, _, _ = api
    for sev in (2, 5, 8):
        client.post("/api/triage", json={**TRIAGE, "severity": sev})
    rows = client.get("/api/me/triage?limit=2").json()["items"]
    assert [r["request"]["severity"] for r in rows] == [8, 5]


# ── chat ─────────────────────────────────────────────────────────────────
def test_chat_turn_is_saved_and_the_thread_can_be_read_back(api):
    client, _, _ = api
    res = client.post("/api/chat/stream", json={"messages": [{"role": "user", "content": EMERGENCY}]})
    frames = sse(res.text)
    assert frames[0][0] == "chat"
    chat_id = frames[0][1]["chat_id"]
    assert ("done", {"reason": "red_flag", "model_called": False}) in frames

    thread = client.get(f"/api/me/chats/{chat_id}").json()
    assert [m["role"] for m in thread["messages"]] == ["user", "assistant"]
    assert thread["messages"][0]["content"] == EMERGENCY
    assert thread["messages"][1]["red_flag"] is True
    assert client.get("/api/me/chats").json()["items"][0]["id"] == chat_id


def test_client_supplied_chat_id_continues_the_same_thread(api):
    client, _, _ = api
    body = {"chat_id": "thread-0001", "messages": [{"role": "user", "content": EMERGENCY}]}
    client.post("/api/chat/stream", json=body)
    client.post("/api/chat/stream", json=body)
    thread = client.get("/api/me/chats/thread-0001").json()
    assert len(thread["messages"]) == 4
    assert len(client.get("/api/me/chats").json()["items"]) == 1


def test_anonymous_chat_streams_normally_with_no_chat_event(api):
    client, store, who = api
    who["user"] = None
    res = client.post("/api/chat/stream", json={"messages": [{"role": "user", "content": EMERGENCY}]})
    events = [e for e, _ in sse(res.text)]
    assert "chat" not in events and events[-1] == "done"
    assert store.users == {}


@pytest.mark.parametrize("bad", ["short", "has space here", "../../etc/passwd", "x" * 65])
def test_malformed_chat_ids_are_rejected(api, bad):
    client, _, _ = api
    res = client.post("/api/chat/stream", json={"chat_id": bad, "messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 422
    assert client.get(f"/api/me/chats/{bad}").status_code in (404, 422)


def test_unknown_chat_is_404(api):
    client, _, _ = api
    assert client.get("/api/me/chats/does-not-exist").status_code == 404


# ── profile / deletion ───────────────────────────────────────────────────
def test_profile_round_trip_drops_unknown_conditions(api):
    client, _, _ = api
    res = client.put("/api/me/profile", json={"condition_ids": ["t2d", "made_up", "htn"], "display_name": "Ana"})
    assert res.status_code == 200
    profile = client.get("/api/me/profile").json()
    assert profile["condition_ids"] == ["t2d", "htn"]
    assert profile["display_name"] == "Ana"


def test_empty_profile_update_is_rejected(api):
    client, _, _ = api
    assert client.put("/api/me/profile", json={}).status_code == 422


def test_delete_removes_everything_for_that_user_only(api):
    client, store, who = api
    client.post("/api/triage", json=TRIAGE)
    client.put("/api/me/profile", json={"condition_ids": ["gerd"]})
    who["user"] = AuthUser(uid="bob")
    client.post("/api/triage", json=TRIAGE)

    who["user"] = AuthUser(uid="alice")
    assert client.delete("/api/me/data").json() == {"deleted": True}
    assert "alice" not in store.users and "bob" in store.users
    assert client.get("/api/me/triage").json()["items"] == []


# ── auth dependencies (the real ones, no overrides) ──────────────────────
@pytest.fixture
def bare():
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_me_routes_report_503_when_firebase_is_off(bare, monkeypatch):
    monkeypatch.setattr(firebase, "ready", False)
    assert bare.get("/api/me").status_code == 503


def test_me_routes_need_a_token_when_firebase_is_on(bare, monkeypatch):
    monkeypatch.setattr(firebase, "ready", True)
    res = bare.get("/api/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_invalid_token_is_401_on_me_but_never_blocks_a_symptom_check(bare, monkeypatch):
    async def reject(token: str):
        raise AuthError("ExpiredIdTokenError")

    monkeypatch.setattr(firebase, "ready", True)
    monkeypatch.setattr(firebase, "verify", reject)
    headers = {"Authorization": "Bearer expired"}
    assert bare.get("/api/me", headers=headers).status_code == 401
    assert bare.post("/api/triage", json=TRIAGE, headers=headers).status_code == 200


def test_valid_token_resolves_to_a_user(bare, monkeypatch):
    async def accept(token: str):
        return AuthUser(uid="carol", email="c@example.com")

    monkeypatch.setattr(firebase, "ready", True)
    monkeypatch.setattr(firebase, "verify", accept)
    monkeypatch.setattr("app.firebase.store._store", MemoryStore())
    res = bare.get("/api/me", headers={"Authorization": "Bearer good"})
    assert res.status_code == 200 and res.json()["uid"] == "carol"


# ── store behaviour ──────────────────────────────────────────────────────
async def test_a_failing_write_never_raises_into_the_request():
    async def boom():
        raise RuntimeError("firestore is down")

    assert await safe_call(boom) is None


async def test_null_store_is_inert():
    s = NullStore()
    assert s.enabled is False
    assert await s.list_triage("u", 5) == [] and await s.get_chat("u", "abc12345") is None


def test_chat_titles_are_one_line_and_short():
    assert chat_title("hello\n\nthere") == "hello there"
    assert len(chat_title("x" * 200)) == 60 and chat_title("x" * 200).endswith("...")
    assert chat_title("   ") == "New chat"


# ── serverless: saves must finish inside the request ─────────────────────
def test_saves_are_queued_after_the_response_by_default(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    assert save_inline() is False


def test_saves_are_awaited_in_request_on_vercel(api, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    assert save_inline() is True
    client, store, _ = api
    assert client.post("/api/triage", json=TRIAGE).status_code == 200
    assert len(store.users["alice"]["triage"]) == 1
