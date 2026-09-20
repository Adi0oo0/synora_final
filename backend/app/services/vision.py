"""Multimodal meal recognition.

The VLM sees a photo and returns JSON. Everything after that is validation:
bounds checks, a macro/calorie consistency test, and the condition rules from
`nutrition.py`. The model's output is an estimate to be checked, not an answer
to be printed.
"""

from __future__ import annotations

import time

from synora_final.backend.app.nim import NimError, NimNotConfigured, nim
from synora_final.backend.app.nim.prompts import MEAL_VISION
from synora_final.backend.app.rag.retriever import retrieve
from synora_final.backend.app.nim.parsing import parse_json
from synora_final.backend.app.services import nutrition

DISCLAIMER = (
    "Portion estimates from a photograph are approximate. Weigh food when precision matters, "
    "and treat condition warnings as prompts to check, not clinical advice."
)

# Sanity bounds for a single serving. Anything outside is a bad parse, not a meal.
BOUNDS = {
    "kcal": (0, 3000),
    "carbs_g": (0, 400),
    "protein_g": (0, 250),
    "fat_g": (0, 250),
    "fibre_g": (0, 100),
    "sodium_mg": (0, 8000),
    "glycemic_index": (0, 110),
}


def _clamp(food: dict) -> tuple[dict, list[str]]:
    clean: dict = {}
    warnings: list[str] = []
    for key, (low, high) in BOUNDS.items():
        try:
            value = float(food.get(key, 0) or 0)
        except (TypeError, ValueError):
            value = 0.0
            warnings.append(f"{key} was not a number")
        if value < low or value > high:
            warnings.append(f"{key}={value} outside plausible range, clamped")
        clean[key] = int(max(low, min(high, value)))
    clean["name"] = str(food.get("name") or "Meal from photo")[:120]
    clean["portion"] = str(food.get("portion") or "as photographed")[:60]
    items = food.get("items") or []
    clean["items"] = [str(i)[:60] for i in items][:12] if isinstance(items, list) else []
    tags = food.get("tags") or []
    clean["tags"] = [str(t).lower()[:20] for t in tags][:6] if isinstance(tags, list) else []
    confidence = str(food.get("confidence") or "low").lower()
    clean["confidence"] = confidence if confidence in ("low", "medium", "high") else "low"
    return clean, warnings


async def analyse_meal(image_data_url: str, condition_ids: list[str], note: str = "") -> dict:
    started = time.perf_counter()

    prompt = "Estimate the nutrition of this meal."
    if note:
        prompt += f" The person adds: {note[:200]}"

    try:
        raw, usage = await nim.vision(system=MEAL_VISION, text=prompt, image_data_url=image_data_url)
    except NimNotConfigured as exc:
        raise RuntimeError("vision model not configured") from exc
    except NimError as exc:
        raise RuntimeError(f"vision call failed: {exc}") from exc

    parsed = parse_json(raw, {})
    if not parsed:
        raise RuntimeError("vision model returned an unusable shape")

    food, warnings = _clamp(parsed)
    consistency = nutrition.macro_consistency(food)
    if consistency["delta_pct"] > 20:
        warnings.append(
            f"stated calories were {consistency['delta_pct']}% from the macro-derived figure; "
            f"using {consistency['reconciled']} kcal"
        )
        food["kcal"] = int(consistency["reconciled"])
        if food["confidence"] == "high":
            food["confidence"] = "medium"

    impacts = nutrition.analyse(food, condition_ids)

    # Ground the warnings in the corpus so the frontend can cite them.
    citations = []
    if impacts:
        query = " ".join(i["label"] for i in impacts if i["level"] != "good") or food["name"]
        hits, _r, _l = await retrieve(query, top_k=3)
        citations = [{"id": h.id, "title": h.title, "source": h.source, "score": h.score} for h in hits]

    return {
        "food": food,
        "impacts": impacts,
        "overall": nutrition.overall(impacts),
        "consistency": consistency,
        "warnings": warnings,
        "citations": citations,
        "disclaimer": DISCLAIMER,
        "model": usage.model,
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
    }
