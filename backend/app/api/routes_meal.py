from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.firebase import AuthUser, HistoryStore, current_user, get_store, persist
from app.schemas import MealRequest, MealResponse
from app.services.vision import analyse_meal

router = APIRouter(prefix="/meal", tags=["nutrition"])


@router.post("/analyse", response_model=MealResponse)
async def analyse(
    body: MealRequest,
    background: BackgroundTasks,
    user: AuthUser | None = Depends(current_user),
    store: HistoryStore = Depends(get_store),
) -> MealResponse:
    try:
        result = await analyse_meal(body.image, body.condition_ids, body.note)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    response = MealResponse(**{k: v for k, v in result.items() if k in MealResponse.model_fields})
    if user and store.enabled:
        await persist(background, store.save_meal, user.uid, response.model_dump(), body.note, body.condition_ids)
    return response
