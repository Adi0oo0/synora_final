from fastapi import APIRouter

from app.schemas import RouteRequest, RouteResponse
from app.services.router import classify

router = APIRouter(prefix="/route", tags=["routing"])


@router.post("", response_model=RouteResponse)
async def route(body: RouteRequest) -> RouteResponse:
    """Deterministic intent classification.

    Same text in, same route out — rules decide, the model only breaks ties on
    text that matches no lexicon at all.
    """
    return RouteResponse(**await classify(body.text, body.allow_model_tiebreak))
