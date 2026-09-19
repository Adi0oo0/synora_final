from fastapi import APIRouter, BackgroundTasks, Depends

from app.firebase import AuthUser, HistoryStore, current_user, get_store, persist
from app.schemas import TriageRequest, TriageResponse
from app.services.triage import run_triage

router = APIRouter(prefix="/triage", tags=["triage"])


@router.post("", response_model=TriageResponse)
async def triage(
    body: TriageRequest,
    background: BackgroundTasks,
    user: AuthUser | None = Depends(current_user),
    store: HistoryStore = Depends(get_store),
) -> TriageResponse:
    request = body.model_dump()
    response = TriageResponse(**await run_triage(request))
    if user and store.enabled:
        # History must never break a symptom check: queued after the response
        # normally, awaited in-request on serverless hosts (see persist()).
        await persist(background, store.save_triage, user.uid, request, response.model_dump())
    return response
