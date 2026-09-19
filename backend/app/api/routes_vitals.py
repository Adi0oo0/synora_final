import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services.vitals import STREAM_SPECS, batch_detect, stream_with_detection

router = APIRouter(prefix="/vitals", tags=["vitals"])


@router.get("/streams")
async def streams() -> dict:
    return {"streams": [{"id": k, **v} for k, v in STREAM_SPECS.items()]}


@router.get("/snapshot")
async def snapshot(
    stream_id: str = Query("hr"),
    count: int = Query(120, ge=20, le=2000),
    window: int = Query(12, ge=4, le=120),
    threshold: float = Query(2.5, ge=1.0, le=6.0),
    min_run: int = Query(3, ge=1, le=20),
) -> dict:
    """Batch detection for first paint — no waiting on a live stream."""
    return batch_detect(stream_id, count, window=window, threshold=threshold, min_run=min_run)


@router.get("/stream")
async def live(
    stream_id: str = Query("hr"),
    count: int = Query(120, ge=10, le=2000),
    interval_ms: int = Query(250, ge=0, le=5000),
    window: int = Query(12, ge=4, le=120),
    threshold: float = Query(2.5, ge=1.0, le=6.0),
    min_run: int = Query(3, ge=1, le=20),
) -> StreamingResponse:
    """Server-sent events: one `sample` per tick, `anomaly` as detected.

    SSE rather than websockets because this is one-directional and survives
    proxies and CDNs without special handling.
    """

    async def gen():
        async for event in stream_with_detection(
            stream_id,
            count=count,
            interval_s=interval_ms / 1000,
            window=window,
            threshold=threshold,
            min_run=min_run,
        ):
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
