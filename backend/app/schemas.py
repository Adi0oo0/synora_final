from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Band = Literal["low", "moderate", "immediate"]
Route = Literal["clinical", "wellness", "admin"]
Level = Literal["good", "caution", "warn"]

CONDITION_IDS = ("t2d", "gerd", "htn", "ckd", "none")


# ── routing ──────────────────────────────────────────────────────────────
class RouteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    allow_model_tiebreak: bool = True


class RouteResponse(BaseModel):
    route: Route
    confidence: float
    decided_by: Literal["rule", "model", "fallback"]
    matched: list[str] = []
    red_flag: bool = False
    latency_ms: float = 0.0


# ── triage ───────────────────────────────────────────────────────────────
class TriageRequest(BaseModel):
    region: Literal["head", "chest", "abdomen", "joints", "general"]
    symptoms: list[str] = []
    triggers: list[str] = []
    severity: int = Field(ge=1, le=10, default=4)
    duration: Literal["today", "days", "week", "longer"] = "days"
    notes: str = Field(default="", max_length=800)
    condition_ids: list[str] = []
    explain: bool = True

    @field_validator("condition_ids")
    @classmethod
    def known_conditions(cls, v: list[str]) -> list[str]:
        return [c for c in v if c in CONDITION_IDS]


class Finding(BaseModel):
    text: str
    warn: bool = False


class Citation(BaseModel):
    id: str
    title: str
    source: str
    score: float


class TriageResponse(BaseModel):
    band: Band
    score: int
    red_flag: bool
    escalation_rules: list[str] = []
    findings: list[Finding] = []
    next_step: dict[str, str]
    summary: str | None = None
    citations: list[Citation] = []
    breakdown: dict[str, int] = {}
    disclaimer: str
    decided_by: Literal["rules"] = "rules"
    latency_ms: float = 0.0


# ── meal ─────────────────────────────────────────────────────────────────
class MealRequest(BaseModel):
    image: str = Field(description="data:image/...;base64,...")
    condition_ids: list[str] = []
    note: str = Field(default="", max_length=300)

    @field_validator("image")
    @classmethod
    def must_be_data_url(cls, v: str) -> str:
        if not v.startswith("data:image/"):
            raise ValueError("image must be a data URL")
        if len(v) > 8_000_000:
            raise ValueError("image too large; resize below ~5 MB")
        return v


class Macro(BaseModel):
    name: str
    portion: str
    items: list[str] = []
    kcal: int
    carbs_g: int
    protein_g: int
    fat_g: int
    fibre_g: int
    sodium_mg: int
    glycemic_index: int
    tags: list[str] = []
    confidence: Literal["low", "medium", "high"] = "low"


class Impact(BaseModel):
    condition_id: str
    label: str
    level: Level
    text: str


class MealResponse(BaseModel):
    food: Macro
    impacts: list[Impact]
    overall: Level
    consistency: dict[str, float]
    citations: list[Citation] = []
    disclaimer: str
    latency_ms: float = 0.0


# ── chat ─────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


CHAT_ID_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    condition_ids: list[str] = []
    thinking: bool = False
    use_rag: bool = True
    # Only used for signed-in users: continues a saved thread. Omit it to start
    # a new one; the server announces the id it chose in a `chat` SSE event.
    chat_id: str | None = Field(default=None, pattern=CHAT_ID_PATTERN)


# ── profile / history ────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    condition_ids: list[str] | None = None
    display_name: str | None = Field(default=None, max_length=80)

    @field_validator("condition_ids")
    @classmethod
    def known_conditions(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else [c for c in v if c in CONDITION_IDS]


# ── rag ──────────────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=4, ge=1, le=12)


class SearchHit(BaseModel):
    id: str
    title: str
    source: str
    text: str
    score: float


class SearchResponse(BaseModel):
    hits: list[SearchHit]
    retriever: Literal["nim", "lexical"]
    latency_ms: float


# ── vitals ───────────────────────────────────────────────────────────────
class AnomalyEvent(BaseModel):
    stream_id: str
    label: str
    unit: str
    start_index: int
    end_index: int
    samples: int
    peak_value: float
    baseline: float
    delta: float
    z: float
    direction: Literal["above", "below"]
    severity: Literal["info", "caution", "warn"]
    message: str
    detect_latency_ms: float
    emitted_at: float
