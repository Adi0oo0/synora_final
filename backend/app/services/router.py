"""Intent routing between wellness coaching and clinical triage.

The brief asks for *deterministic* intent classification, so the decision is
made by rules first and the model is only a tiebreaker on genuinely ambiguous
text. Precedence is fixed:

    red flag  >  clinical lexicon  >  admin lexicon  >  wellness lexicon
    >  model tiebreak  >  clinical (default)

Ties break toward clinical. Under-triage is the expensive error.
"""

from __future__ import annotations

import re
import time

from app.nim import NimError, NimNotConfigured, nim
from app.nim.prompts import INTENT_TIEBREAK
from app.nim.parsing import parse_json
from app.safety.redflags import screen_text

CLINICAL_TERMS = [
    "pain", "ache", "aching", "hurts", "hurting", "sore", "burning", "cramp",
    "dizzy", "dizziness", "faint", "nausea", "nauseous", "vomit", "diarrhoea",
    "diarrhea", "fever", "chills", "rash", "swelling", "swollen", "numb",
    "numbness", "tingling", "palpitation", "breathless", "short of breath",
    "cough", "bleeding", "blood", "symptom", "migraine", "headache", "cramping",
    "reflux", "heartburn", "chest", "wheezing", "lump", "blurred vision",
]
ADMIN_TERMS = [
    "appointment", "reschedule", "book", "booking", "prescription", "refill",
    "my medication", "my medicine", "my meds", "records", "settings", "profile",
    "cancel", "invoice", "insurance", "referral letter",
]
WELLNESS_TERMS = [
    "diet", "nutrition", "calories", "macros", "protein", "meal", "recipe",
    "workout", "exercise", "training", "run", "walk", "steps", "sleep",
    "hydration", "weight", "habit", "routine", "stretch", "yoga", "eat",
    "breakfast", "lunch", "dinner", "snack",
]

_WORD = re.compile(r"[a-z']+")


def _term_hit(term: str, words: set[str]) -> bool:
    """Exact word, simple plural, or a prefix for terms long enough to be safe.

    Prefix matching is capped at five characters on purpose: "workout" should
    catch "workouts", but "run" must not catch "runny".
    """
    if term in words or f"{term}s" in words or f"{term}es" in words:
        return True
    return len(term) >= 5 and any(w.startswith(term) for w in words)


def _matches(text: str, terms: list[str]) -> list[str]:
    low = text.lower()
    words = set(_WORD.findall(low))
    found = []
    for term in terms:
        if " " in term:
            if term in low:
                found.append(term)
        elif _term_hit(term, words):
            found.append(term)
    return found


async def classify(text: str, allow_model_tiebreak: bool = True) -> dict:
    started = time.perf_counter()

    flags = screen_text(text)
    if flags.triggered:
        return {
            "route": "clinical",
            "confidence": 1.0,
            "decided_by": "rule",
            "matched": flags.categories,
            "red_flag": True,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }

    clinical = _matches(text, CLINICAL_TERMS)
    admin = _matches(text, ADMIN_TERMS)
    wellness = _matches(text, WELLNESS_TERMS)

    # Any clinical term wins outright, even mixed with wellness language:
    # "is it ok to run with this chest pain" is a clinical question.
    if clinical:
        return _decision("clinical", 0.9 if not wellness else 0.75, "rule", clinical, started)
    if admin and not wellness:
        return _decision("admin", 0.85, "rule", admin, started)
    if wellness and not admin:
        return _decision("wellness", 0.85, "rule", wellness, started)
    if wellness and admin:
        return _decision("admin", 0.6, "rule", admin + wellness, started)

    if allow_model_tiebreak:
        try:
            raw, _ = await nim.complete(
                messages=[
                    {"role": "system", "content": INTENT_TIEBREAK},
                    {"role": "user", "content": text[:500]},
                ],
                model=nim.s.nim_model_light,
                temperature=0.0,  # determinism is the requirement, not creativity
                max_tokens=nim.s.nim_max_tokens_router,
                json_only=True,
            )
            verdict = parse_json(raw, {})
            route = verdict.get("route")
            if route in ("clinical", "wellness", "admin"):
                return _decision(route, float(verdict.get("confidence") or 0.5), "model", [], started)
        except (NimNotConfigured, NimError):
            pass

    return _decision("clinical", 0.3, "fallback", [], started)


def _decision(route: str, confidence: float, decided_by: str, matched: list[str], started: float) -> dict:
    return {
        "route": route,
        "confidence": round(min(1.0, max(0.0, confidence)), 2),
        "decided_by": decided_by,
        "matched": matched[:8],
        "red_flag": False,
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
    }
