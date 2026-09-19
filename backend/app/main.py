from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    routes_chat,
    routes_health,
    routes_me,
    routes_meal,
    routes_rag,
    routes_route,
    routes_triage,
    routes_vitals,
)
from app.config import get_settings
from app.firebase import firebase, init_store
from app.nim import nim
from app.rag.ingest import build_index
from app.rag.store import store

settings = get_settings()
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("zenhealth")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await nim.open()
    firebase.init()
    init_store()
    if not store.load():
        log.info("no index on disk — building")
        log.info("index built: %s", await build_index())
    else:
        log.info("index loaded: %s chunks, dense=%s", len(store.chunks), store.vectors is not None)
    yield
    await nim.close()
    firebase.shutdown()


app = FastAPI(
    title="ZenHealth agent API",
    version="1.0.0",
    description=(
        "Holistic health agent backend: deterministic triage, condition-aware nutrition, "
        "multimodal meal recognition, RAG over a clinical corpus, and real-time wearable "
        "anomaly detection. The model never decides urgency."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,  # explicit allowlist, never a wildcard with credentials
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def timing_and_headers(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Response-Time-ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error", exc_info=exc)
    # Never leak internals to a health app's client.
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side."})


for module in (
    routes_health,
    routes_route,
    routes_triage,
    routes_meal,
    routes_rag,
    routes_vitals,
    routes_chat,
    routes_me,
):
    app.include_router(module.router, prefix="/api")
