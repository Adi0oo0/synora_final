import pytest

from app.safety.redflags import screen_text
from app.services.router import classify


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text,expected",
    [
        ("my chest hurts when I climb stairs", "clinical"),
        ("I've had a headache for three days", "clinical"),
        ("what should I eat for lunch", "wellness"),
        ("help me plan workouts this week", "wellness"),
        ("how much protein should I aim for", "wellness"),
        ("reschedule my appointment", "admin"),
        ("I need a refill on my prescription", "admin"),
        # The interesting one: wellness framing, clinical content.
        ("is it ok to run with this chest pain", "clinical"),
    ],
)
async def test_rule_routing(text, expected):
    result = await classify(text, allow_model_tiebreak=False)
    assert result["route"] == expected
    assert result["decided_by"] in ("rule", "fallback")


@pytest.mark.asyncio
async def test_routing_is_repeatable():
    text = "is it ok to run with this chest pain"
    first = await classify(text, allow_model_tiebreak=False)
    for _ in range(20):
        assert (await classify(text, allow_model_tiebreak=False))["route"] == first["route"]


@pytest.mark.asyncio
async def test_unmatched_text_defaults_to_clinical():
    result = await classify("qwerty zxcvb", allow_model_tiebreak=False)
    assert result["route"] == "clinical"
    assert result["decided_by"] == "fallback"


@pytest.mark.asyncio
async def test_red_flag_short_circuits_before_any_model_call():
    result = await classify("crushing chest pressure spreading to my jaw", allow_model_tiebreak=True)
    assert result["route"] == "clinical"
    assert result["red_flag"] is True
    assert result["decided_by"] == "rule"
    assert result["confidence"] == 1.0


@pytest.mark.parametrize(
    "text,flagged",
    [
        ("woke with chest pressure and pain spreading to my jaw", True),
        ("my face is drooping and my speech is slurred", True),
        ("coughing up blood this morning", True),
        ("worst headache of my life, came on in seconds", True),
        ("what should I eat for lunch today", False),
        ("my knee is sore after running", False),
        ("mild heartburn after dinner", False),
    ],
)
def test_red_flag_lexicon(text, flagged):
    assert screen_text(text).triggered is flagged
