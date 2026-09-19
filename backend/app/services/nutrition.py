"""Condition constraints override general wellness advice.

That is the requirement in the brief, so it is enforced structurally: the
model estimates *what the food is*, and this module decides *what it means for
this person*. A model that is talked out of a sodium warning cannot happen,
because the model is never asked.
"""

from __future__ import annotations

CONDITION_LABELS = {
    "t2d": "Type 2 diabetes",
    "gerd": "Acid reflux (GERD)",
    "htn": "Hypertension",
    "ckd": "Chronic kidney disease",
}

REFLUX_TAGS = {"fatty", "fried", "spicy", "caffeine", "acidic", "sugary"}
DEFAULT_SODIUM_TARGET = 1500


def _diabetes(food: dict) -> dict:
    gi = int(food.get("glycemic_index") or 0)
    carbs = int(food.get("carbs_g") or 0)
    load = round(gi * carbs / 100)
    if gi >= 70 or load >= 20:
        return {"level": "warn", "text": f"High glycaemic load (GI {gi}, {carbs} g carbs, load ≈ {load}). "
                                         f"Expect a sharp rise — split the portion or pair it with protein."}
    if gi >= 56 or load >= 11:
        return {"level": "caution", "text": f"Medium glycaemic load (GI {gi}, load ≈ {load}). "
                                            f"Fibre or protein alongside will flatten the peak."}
    return {"level": "good", "text": f"Low glycaemic load (GI {gi}, load ≈ {load}). A steadier response."}


def _hypertension(food: dict, target: int = DEFAULT_SODIUM_TARGET) -> dict:
    sodium = int(food.get("sodium_mg") or 0)
    pct = round(sodium / target * 100)
    if sodium >= 800:
        return {"level": "warn", "text": f"High sodium: {sodium} mg is {pct}% of a {target} mg day in one serving."}
    if sodium >= 400:
        return {"level": "caution", "text": f"Moderate sodium: {sodium} mg, {pct}% of the daily room."}
    return {"level": "good", "text": f"Low sodium: {sodium} mg, comfortable against the target."}


def _reflux(food: dict) -> dict:
    tags = {t.lower() for t in (food.get("tags") or [])}
    hits = sorted(tags & REFLUX_TAGS)
    fat = int(food.get("fat_g") or 0)
    if len(hits) >= 2 or fat >= 30:
        detail = " and ".join(hits) if hits else "high fat"
        return {"level": "warn", "text": f"Rich and {detail}. A common reflux trigger — keep it more than "
                                         f"three hours from lying down."}
    if hits:
        return {"level": "caution", "text": f"Mildly reflux-prone ({hits[0]}). Better earlier in the day."}
    return {"level": "good", "text": "Unlikely to set off reflux."}


def _kidney(food: dict) -> dict:
    sodium = int(food.get("sodium_mg") or 0)
    protein = int(food.get("protein_g") or 0)
    if sodium >= 800 or protein >= 45:
        return {"level": "warn", "text": f"{sodium} mg sodium and {protein} g protein in one serving. Both are "
                                         f"worth raising with whoever manages your kidney care."}
    if sodium >= 400 or protein >= 30:
        return {"level": "caution", "text": "Moderate sodium and protein. Keep an eye on the day's total."}
    return {"level": "good", "text": "Light on sodium and protein for a single serving."}


RULES = {"t2d": _diabetes, "htn": _hypertension, "gerd": _reflux, "ckd": _kidney}
PRECEDENCE = {"good": 0, "caution": 1, "warn": 2}


def analyse(food: dict, condition_ids: list[str], sodium_target: int = DEFAULT_SODIUM_TARGET) -> list[dict]:
    out = []
    for cid in condition_ids:
        rule = RULES.get(cid)
        if not rule:
            continue
        verdict = rule(food, sodium_target) if cid == "htn" else rule(food)
        out.append({"condition_id": cid, "label": CONDITION_LABELS.get(cid, cid), **verdict})
    return out


def overall(impacts: list[dict]) -> str:
    return max((i["level"] for i in impacts), key=lambda l: PRECEDENCE[l], default="good")


def macro_consistency(food: dict) -> dict:
    """Vision models routinely return macros that do not add up to their own
    calorie figure. Measure the gap, report it, and trust the macros — they are
    the numbers the condition rules use."""
    carbs = float(food.get("carbs_g") or 0)
    protein = float(food.get("protein_g") or 0)
    fat = float(food.get("fat_g") or 0)
    stated = float(food.get("kcal") or 0)
    derived = carbs * 4 + protein * 4 + fat * 9
    if derived <= 0:
        return {"derived_kcal": 0.0, "stated_kcal": stated, "delta_pct": 0.0, "reconciled": 0.0}
    delta = abs(stated - derived) / derived * 100
    return {
        "derived_kcal": round(derived, 1),
        "stated_kcal": round(stated, 1),
        "delta_pct": round(delta, 1),
        # >20% apart means the stated figure is unreliable; use the macro-derived one.
        "reconciled": round(derived if delta > 20 else stated, 1),
    }
