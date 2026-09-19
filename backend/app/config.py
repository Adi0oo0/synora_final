from functools import lru_cache
from dotenv import load_dotenv
from os import getenv

load_dotenv()



from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Everything configurable, nothing hardcoded.

    Model ids are settings rather than constants on purpose: the NIM catalogue
    changes faster than any release cycle, and swapping a model should never
    require a code change.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    nvidia_api_key: str = getenv("NVIDIA_API_KEY")
    nim_base_url: str = getenv("NIM_BASE_URL")

    nim_model_reasoning: str = getenv("NIM_MODEL_REASONING")
    nim_model_light: str = getenv("NIM_MODEL_LIGHT")
    nim_model_vision: str = getenv("NIM_MODEL_VISION")
    nim_model_embed: str = getenv("NIM_MODEL_EMBED")
    nim_model_rerank: str = getenv("NIM_MODEL_RERANK")

    nim_min_interval_s: float = 1.5
    # Longer answers take longer to generate; 45s was tuned for short replies.
    nim_timeout_s: float = 90.0
    nim_max_retries: int = 3

    # Output budgets (tokens). Every model call reads its limit from here, so
    # raising a limit is an .env change rather than a code change. Env names
    # are the upper-cased field names, e.g. NIM_MAX_TOKENS_CHAT.
    nim_max_tokens_default: int = 4096   # generic complete() calls
    nim_max_tokens_chat: int = 4096      # streamed coach answer
    nim_max_tokens_triage: int = 1536    # triage summary (JSON)
    nim_max_tokens_vision: int = 2048    # meal-photo estimate (JSON)
    nim_max_tokens_router: int = 256     # intent tiebreak (JSON)
    # Thinking tokens are budgeted separately and ADDED on top of the answer
    # budget above, so turning Thinking on can no longer eat the answer.
    nim_reasoning_budget: int = 8192

    rag_top_k: int = 8
    rag_rerank_to: int = 4
    rag_min_score: float = 0.15

    # ── Firebase (optional) ──────────────────────────────────────────────
    # Credential sources, first match wins: inline JSON (raw or base64), a path
    # to a service-account file, or Application Default Credentials. With none
    # of them set, Firebase is simply off: the API stays open and nothing is
    # persisted.
    firebase_project_id: str = ""
    firebase_credentials_json: str = ""
    firebase_credentials_path: str = ""
    firebase_use_adc: bool = False
    # Extra network call per request; catches tokens revoked at sign-out.
    firebase_check_revoked: bool = False
    firebase_history_limit: int = 50
    # Await history writes inside the request instead of after the response.
    # Serverless hosts can freeze the instance the moment a response is sent,
    # which would drop background writes. Turned on automatically on Vercel.
    firebase_save_inline: bool = False

    allowed_origins: str = "http://localhost:5173"
    log_level: str = "INFO"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def configured(self) -> bool:
        return bool(self.nvidia_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
