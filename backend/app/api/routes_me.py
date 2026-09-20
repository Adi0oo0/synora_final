"""The signed-in user's own data. Every route needs a verified Firebase token,
and every query is scoped to that token's uid, never to a client-supplied id."""

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from synora_final.backend.app.config import get_settings
from synora_final.backend.app.firebase import AuthUser, HistoryStore, get_store, require_user, safe_call
from synora_final.backend.app.schemas import CHAT_ID_PATTERN, ProfileUpdate, StateUpdate

router = APIRouter(prefix="/me", tags=["me"])


def _limit(limit: int | None) -> int:
    cap = get_settings().firebase_history_limit
    return max(1, min(limit or cap, cap))


@router.get("")
async def me(user: AuthUser = Depends(require_user), store: HistoryStore = Depends(get_store)) -> dict:
    """Who the server thinks you are. Also a cheap way for the client to check a token."""
    return {"uid": user.uid, "email": user.email, "name": user.name, "persistence": store.enabled}


@router.get("/profile")
async def get_profile(user: AuthUser = Depends(require_user), store: HistoryStore = Depends(get_store)) -> dict:
    return await store.get_profile(user.uid)


@router.put("/profile")
async def put_profile(
    body: ProfileUpdate,
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update.")
    return await store.put_profile(user.uid, data)


@router.get("/state")
async def get_state(user: AuthUser = Depends(require_user), store: HistoryStore = Depends(get_store)) -> dict:
    """The app's saved record for this person, or null if nothing has been saved yet."""
    return {"state": await store.get_state(user.uid)}


@router.put("/state")
async def put_state(
    body: StateUpdate,
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    if not store.enabled:
        raise HTTPException(status_code=503, detail="Account storage is not configured on this server.")
    await store.put_state(user.uid, body.state)
    return {"saved": True}


@router.get("/triage")
async def triage_history(
    limit: int | None = Query(default=None, ge=1, le=200),
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    return {"items": await store.list_triage(user.uid, _limit(limit))}


@router.get("/meals")
async def meal_history(
    limit: int | None = Query(default=None, ge=1, le=200),
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    return {"items": await store.list_meals(user.uid, _limit(limit))}


@router.get("/chats")
async def chat_list(
    limit: int | None = Query(default=None, ge=1, le=200),
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    return {"items": await store.list_chats(user.uid, _limit(limit))}


@router.get("/chats/{chat_id}")
async def chat_detail(
    chat_id: str = Path(pattern=CHAT_ID_PATTERN),
    user: AuthUser = Depends(require_user),
    store: HistoryStore = Depends(get_store),
) -> dict:
    chat = await store.get_chat(user.uid, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@router.delete("/data")
async def delete_my_data(user: AuthUser = Depends(require_user), store: HistoryStore = Depends(get_store)) -> dict:
    """Erase the profile, triage history, meals and chats for this account.

    This deletes what ZenHealth stored. It does not delete the Firebase Auth
    account itself; the client does that with its own SDK (or the Admin SDK
    can be added here later).
    """
    await store.delete_user_data(user.uid)
    return {"deleted": True}
