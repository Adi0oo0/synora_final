from app.config import Settings
from app.nim.client import NimClient


def _client(**overrides) -> NimClient:
    c = NimClient()
    c.s = Settings(**overrides)
    return c


def test_answer_budgets_are_generous_by_default():
    s = Settings()
    assert s.nim_max_tokens_chat >= 4096
    assert s.nim_max_tokens_triage >= 1024
    assert s.nim_max_tokens_vision >= 1024
    assert s.nim_max_tokens_router >= 128


def test_thinking_budget_is_added_on_top_of_the_answer_budget():
    c = _client(nim_reasoning_budget=8192)
    assert c._token_limit(4096, thinking=False) == 4096
    assert c._token_limit(4096, thinking=True) == 4096 + 8192


def test_limits_are_env_configurable(monkeypatch):
    monkeypatch.setenv("NIM_MAX_TOKENS_CHAT", "6000")
    assert Settings().nim_max_tokens_chat == 6000


def test_settings_load_with_an_empty_environment(monkeypatch):
    """Regression: a deploy with no NIM_* variables used to crash at import."""
    for name in (
        "NVIDIA_API_KEY", "NIM_BASE_URL", "NIM_MODEL_REASONING", "NIM_MODEL_LIGHT",
        "NIM_MODEL_VISION", "NIM_MODEL_EMBED", "NIM_MODEL_RERANK",
    ):
        monkeypatch.delenv(name, raising=False)
    s = Settings(_env_file=None)
    assert s.configured is False
    assert s.nim_base_url.startswith("https://")
    assert s.nim_model_reasoning and s.nim_model_embed
