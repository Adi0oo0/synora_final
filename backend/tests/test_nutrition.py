import pytest

from app.services.nutrition import analyse, macro_consistency, overall

RAMEN = dict(name="ramen", kcal=480, carbs_g=62, protein_g=10, fat_g=20, fibre_g=2,
             sodium_mg=1720, glycemic_index=73, tags=["fatty", "spicy"])
EDAMAME = dict(name="edamame", kcal=190, carbs_g=14, protein_g=17, fat_g=8, fibre_g=8,
               sodium_mg=9, glycemic_index=18, tags=[])
WHITE_RICE = dict(name="white rice", kcal=240, carbs_g=53, protein_g=4, fat_g=1, fibre_g=1,
                  sodium_mg=2, glycemic_index=73, tags=[])


def test_condition_constraints_override_calorie_logic():
    """The whole point: a light meal can still be the wrong meal."""
    impacts = {i["condition_id"]: i for i in analyse(WHITE_RICE, ["t2d", "htn"])}
    assert impacts["t2d"]["level"] == "warn"   # high GI
    assert impacts["htn"]["level"] == "good"   # but almost no sodium


@pytest.mark.parametrize("condition,level", [("t2d", "warn"), ("htn", "warn"), ("gerd", "warn")])
def test_ramen_warns_on_every_condition(condition, level):
    assert analyse(RAMEN, [condition])[0]["level"] == level


def test_clean_food_passes_everything():
    assert all(i["level"] == "good" for i in analyse(EDAMAME, ["t2d", "gerd", "htn", "ckd"]))


def test_only_profile_conditions_are_scored():
    assert len(analyse(RAMEN, ["t2d"])) == 1
    assert analyse(RAMEN, []) == []
    assert analyse(RAMEN, ["unknown_condition"]) == []


def test_overall_takes_the_worst():
    assert overall(analyse(RAMEN, ["t2d", "htn", "gerd"])) == "warn"
    assert overall(analyse(EDAMAME, ["t2d"])) == "good"
    assert overall([]) == "good"


def test_sodium_target_is_configurable():
    strict = analyse(dict(RAMEN, sodium_mg=600), ["htn"], sodium_target=1000)[0]
    assert "60%" in strict["text"]


def test_macro_consistency_flags_and_reconciles():
    bad = macro_consistency(dict(kcal=900, carbs_g=62, protein_g=10, fat_g=20))
    assert bad["delta_pct"] > 20
    assert bad["reconciled"] == bad["derived_kcal"]

    good = macro_consistency(dict(kcal=468, carbs_g=62, protein_g=10, fat_g=20))
    assert good["delta_pct"] <= 20
    assert good["reconciled"] == 468.0


def test_macro_consistency_survives_empty_input():
    assert macro_consistency({})["derived_kcal"] == 0.0
