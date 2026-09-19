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
