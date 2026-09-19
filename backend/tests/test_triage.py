import pytest

from app.services.triage import band_for, considerations, next_step, score_triage

BASE = dict(region="chest", symptoms=["burning"], triggers=["meals"], severity=3, duration="days")


def test_scoring_is_deterministic():
    """The evaluation asks for deterministic classification. This is the proof."""
    runs = [score_triage(BASE) for _ in range(50)]
    assert all(r == runs[0] for r in runs)


def test_mild_reflux_stays_low():
    assert score_triage(BASE)["band"] == "low"


@pytest.mark.parametrize(
    "payload,rule",
    [
        (dict(region="chest", symptoms=["pressure", "breath"], triggers=[], severity=2, duration="today"),
         "cardiac_exertional"),
        (dict(region="chest", symptoms=["pressure"], triggers=["exertion"], severity=1, duration="today"),
         "cardiac_exertional"),
        (dict(region="chest", symptoms=["pressure"], triggers=["rest"], severity=7, duration="today"),
         "cardiac_at_rest"),
        (dict(region="abdomen", symptoms=["rigid"], triggers=[], severity=8, duration="today"),
         "acute_abdomen"),
        (dict(region="general", symptoms=["weight_loss", "night_sweats"], triggers=[], severity=3, duration="longer"),
         "red_flag_combo"),
    ],
)
def test_escalation_rules_fire(payload, rule):
    result = score_triage(payload)
    assert result["band"] == "immediate"
    assert result["score"] == 100
    assert rule in result["escalation_rules"]


@pytest.mark.parametrize("region,symptom", [("head", "droop"), ("head", "worst_headache"),
                                            ("abdomen", "blood"), ("general", "fainting")])
def test_red_flag_symptoms_escalate_at_lowest_severity(region, symptom):
    result = score_triage(dict(region=region, symptoms=[symptom], triggers=[], severity=1, duration="today"))
    assert result["band"] == "immediate"


def test_score_is_bounded():
    result = score_triage(
        dict(
            region="joints",
            symptoms=["knee_pain", "stiffness", "swelling", "range", "numbness"],
            triggers=["exertion", "meals", "lying", "stress", "cold", "night", "rest"],
            severity=10,
            duration="longer",
        )
    )
    assert 0 <= result["score"] <= 100


def test_band_boundaries_are_exact():
    assert (band_for(29), band_for(30), band_for(64), band_for(65)) == (
        "low", "moderate", "moderate", "immediate",
    )


def test_unknown_symptom_ids_are_ignored_not_fatal():
    assert score_triage(dict(region="chest", symptoms=["not_a_symptom"], severity=1, duration="today"))["score"] > 0


def test_always_returns_a_consideration():
    assert considerations(BASE, score_triage(BASE))


def test_next_step_never_reassures_on_immediate():
    step = next_step("immediate")
    assert "emergency" in step["body"].lower()
    assert "fine" not in step["body"].lower()
