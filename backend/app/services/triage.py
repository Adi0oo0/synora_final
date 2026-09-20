"""Deterministic triage scoring plus a grounded, non-diagnostic explanation.

The model never decides the band. `score_triage()` is a pure function: same
input, same output, forever. The reasoning model receives a band that has
already been decided and rewrites it. When the band is `immediate` there is no
model call at all — an emergency is the wrong moment for a network round-trip.
"""

from __future__ import annotations

import time

from synora_final.backend.app.nim import NimError, NimNotConfigured, nim
from synora_final.backend.app.nim.parsing import parse_json
from synora_final.backend.app.nim.prompts import TRIAGE_EXPLAINER
from synora_final.backend.app.rag.retriever import format_context, retrieve
from synora_final.backend.app.safety.redflags import EMERGENCY_TEXT, screen_text

DISCLAIMER = (
    "Triage guidance only. This is not a diagnosis and does not replace a clinician. "
    "In an emergency, call your local emergency number."
)

SYMPTOMS: dict[str, dict[str, dict]] = {
    "head": {
        "headache": {"w": 8, "label": "Headache"},
        "dizzy": {"w": 12, "label": "Dizziness"},
        "blurred": {"w": 16, "label": "Blurred vision"},
        "light": {"w": 8, "label": "Light sensitivity"},
        "droop": {"w": 100, "label": "Facial droop or slurred speech", "red": True},
        "worst_headache": {"w": 100, "label": "Worst headache of my life, sudden", "red": True},
    },
    "chest": {
        "pressure": {"w": 34, "label": "Pressure or tightness"},
        "breath": {"w": 30, "label": "Short of breath"},
        "palpitations": {"w": 18, "label": "Racing or skipping beats"},
        "burning": {"w": 8, "label": "Burning behind the breastbone"},
        "cough": {"w": 8, "label": "Persistent cough"},
        "radiating": {"w": 100, "label": "Pain spreading to arm or jaw", "red": True},
    },
    "abdomen": {
        "nausea": {"w": 10, "label": "Nausea"},
        "bloating": {"w": 6, "label": "Bloating after eating"},
        "upper_pain": {"w": 18, "label": "Pain under the ribs"},
        "reflux": {"w": 8, "label": "Reflux when lying down"},
        "rigid": {"w": 34, "label": "Belly hard and painful"},
        "blood": {"w": 100, "label": "Blood in stool or vomit", "red": True},
    },
    "joints": {
        "knee_pain": {"w": 8, "label": "Joint pain on movement"},
        "stiffness": {"w": 8, "label": "Morning stiffness"},
        "swelling": {"w": 16, "label": "Swollen or warm to touch"},
        "range": {"w": 10, "label": "Reduced range of motion"},
        "numbness": {"w": 18, "label": "Numbness or tingling"},
    },
    "general": {
        "fever": {"w": 16, "label": "Fever"},
        "fatigue": {"w": 8, "label": "Unusual fatigue"},
        "weight_loss": {"w": 22, "label": "Unintentional weight loss"},
        "night_sweats": {"w": 18, "label": "Night sweats"},
        "fainting": {"w": 100, "label": "Fainting or collapse", "red": True},
    },
}

TRIGGERS = {
    "exertion": 14, "meals": 4, "lying": 4, "stress": 5, "cold": 2, "night": 8, "rest": 10,
}
DURATIONS = {"today": 4, "days": 8, "week": 12, "longer": 16}

# Why a single red-flag symptom is an emergency by itself. Mirrors the wording in
# frontend/src/lib/triage.js so the person reads the same reason either way.
RED_FLAG_REASONS = {
    "droop": "Facial drooping or slurred speech is a stroke red flag. Call emergency services now — minutes change the outcome.",
    "worst_headache": "A sudden, worst-ever headache needs emergency assessment even if it eases off.",
    "radiating": "Chest pain spreading to the arm or jaw is treated as a possible heart attack until proven otherwise.",
    "blood": "Blood in stool or vomit always needs same-day medical assessment.",
    "fainting": "Fainting or collapse needs urgent in-person assessment.",
}

ESCALATION_RULES = [
    (
        "cardiac_exertional",
        lambda r, s, t, sev: r == "chest" and "pressure" in s and ("breath" in s or "exertion" in t),
        "Chest pressure together with breathlessness or exertion is treated as an emergency pattern, "
        "not a wait-and-see combination.",
    ),
    (
        "cardiac_at_rest",
        lambda r, s, t, sev: r == "chest" and "pressure" in s and "rest" in t and sev >= 6,
        "Significant chest pressure occurring at rest needs urgent assessment.",
    ),
    (
        "acute_abdomen",
        lambda r, s, t, sev: r == "abdomen" and "rigid" in s and sev >= 7,
        "A rigid, severely painful abdomen needs urgent in-person assessment.",
    ),
    (
        "systemic_infection",
        lambda r, s, t, sev: r == "general" and "fever" in s and sev >= 8,
        "High fever with severe illness needs same-day assessment.",
    ),
    (
        "red_flag_combo",
        lambda r, s, t, sev: {"weight_loss", "night_sweats"}.issubset(set(s)),
        "Unintentional weight loss with night sweats should be reviewed by a clinician promptly.",
    ),
]

BAND_LABELS = {
    "low": "Low — keep monitoring",
    "moderate": "Moderate — see someone soon",
    "immediate": "Immediate care needed",
}


def band_for(score: int) -> str:
    if score >= 65:
        return "immediate"
    if score >= 30:
        return "moderate"
    return "low"


def score_triage(payload: dict) -> dict:
    """Pure. No I/O, no clock, no randomness — so it is testable and repeatable."""
    region = payload.get("region", "general")
    symptoms = list(payload.get("symptoms") or [])
    triggers = list(payload.get("triggers") or [])
    severity = int(payload.get("severity") or 1)
    duration = payload.get("duration", "days")

    catalogue = SYMPTOMS.get(region, {})
    symptom_score = 0
    red_flag = False
    fired: list[str] = []
    reasons: list[str] = []
    for sid in symptoms:
        entry = catalogue.get(sid)
        if not entry:
            continue
        symptom_score += int(entry["w"])
        if entry.get("red"):
            red_flag = True
            if sid in RED_FLAG_REASONS:
                reasons.append(RED_FLAG_REASONS[sid])

    trigger_score = sum(TRIGGERS.get(t, 0) for t in triggers)
    duration_score = DURATIONS.get(duration, 8)
    severity_score = severity * 3

    for name, test, reason in ESCALATION_RULES:
        if test(region, symptoms, triggers, severity):
            red_flag = True
            fired.append(name)
            reasons.append(reason)

    raw = symptom_score + trigger_score + duration_score + severity_score
    score = 100 if red_flag else max(0, min(100, raw))

    return {
        "score": score,
        "band": band_for(score),
        "red_flag": red_flag,
        "escalation_rules": fired,
        "reasons": reasons,
        "breakdown": {
            "symptoms": symptom_score,
            "triggers": trigger_score,
            "duration": duration_score,
            "severity": severity_score,
        },
    }


def considerations(payload: dict, result: dict) -> list[dict]:
    """Discussion points, never diagnoses. Wording matters more than coverage."""
    region = payload.get("region")
    symptoms = set(payload.get("symptoms") or [])
    triggers = set(payload.get("triggers") or [])
    conditions = set(payload.get("condition_ids") or [])
    out = [{"text": r, "warn": True} for r in result["reasons"]]

    if region == "chest":
        if "burning" in symptoms and (triggers & {"meals", "lying"}):
            text = (
                "Burning that follows meals or lying down fits the reflux you have listed. "
                "Worth raising, not worth panicking over."
                if "gerd" in conditions
                else "Burning that follows meals or lying down is often reflux. Worth raising if it keeps coming back."
            )
            out.append({"text": text, "warn": False})
        if "palpitations" in symptoms:
            out.append({"text": "Note when the palpitations happen and, if you have a monitor, your heart rate "
                                "at the time. That is what a clinician will ask.", "warn": False})
    if region == "abdomen":
        if "nausea" in symptoms and "bloating" in symptoms and "t2d" in conditions:
            out.append({"text": "Nausea with bloating can follow slow stomach emptying, which is more common "
                                "with long-standing diabetes. Mention the pairing.", "warn": False})
    if region == "head" and (symptoms & {"dizzy", "blurred"}):
        out.append({"text": "Dizziness and vision changes track with both blood sugar and blood pressure "
                            "swings. Check both before your next log.", "warn": False})
    if region == "joints" and "numbness" in symptoms and "t2d" in conditions:
        out.append({"text": "Numbness in the feet or legs sits on the diabetic review checklist. Flag it at "
                            "your next appointment.", "warn": False})

    if not out:
        out.append({"text": "Nothing in this combination matches an escalation rule. Keep logging so the "
                            "pattern has something to sit against.", "warn": False})
    return out


def next_step(band: str) -> dict[str, str]:
    if band == "immediate":
        return {
            "title": "Get emergency care now",
            "body": "Call your local emergency number or go to the nearest emergency department. "
                    "Do not drive yourself.",
            "tone": "crimson",
        }
    if band == "moderate":
        return {
            "title": "Book a consult in the next 24 to 48 hours",
            "body": "Bring this summary with you. Come sooner if anything sharpens or spreads.",
            "tone": "sand",
        }
    return {
        "title": "Self-care and monitoring look reasonable",
        "body": "Log again later today. Come back sooner if anything sharpens, spreads, or wakes you up.",
        "tone": "sage",
    }


def _retrieval_query(payload: dict, result: dict) -> str:
    labels = [
        SYMPTOMS.get(payload["region"], {}).get(s, {}).get("label", s)
        for s in payload.get("symptoms") or []
    ]
    return f"{payload['region']} {' '.join(labels)} {' '.join(payload.get('triggers') or [])}".strip()


async def run_triage(payload: dict) -> dict:
    started = time.perf_counter()

    # Free-text red flags are checked before scoring — someone can describe an
    # emergency in the notes box while ticking mild boxes above it.
    note_flags = screen_text(payload.get("notes", ""))
    result = score_triage(payload)
    if note_flags.triggered:
        result["red_flag"] = True
        result["score"] = 100
        result["band"] = "immediate"
        result["escalation_rules"] = result["escalation_rules"] + [f"text:{c}" for c in note_flags.categories]
        result["reasons"] = result["reasons"] + note_flags.reasons

    findings = considerations(payload, result)
    response = {
        "band": result["band"],
        "score": result["score"],
        "red_flag": result["red_flag"],
        "escalation_rules": result["escalation_rules"],
        "findings": findings,
        "next_step": next_step(result["band"]),
        "breakdown": result["breakdown"],
        "citations": [],
        "summary": None,
        "disclaimer": DISCLAIMER,
        "decided_by": "rules",
    }

    if result["band"] == "immediate":
        response["summary"] = EMERGENCY_TEXT
        response["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
        return response

    if not payload.get("explain", True):
        response["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
        return response

    hits, _retriever, _ = await retrieve(_retrieval_query(payload, result))
    response["citations"] = [
        {"id": h.id, "title": h.title, "source": h.source, "score": h.score} for h in hits
    ]

    notes = payload.get("notes", "")

    user_block = "\n".join(
        [
            f"Urgency band: {result['band']} (score {result['score']}/100).",
            f"Region: {payload['region']}.",
            f"Symptoms: {', '.join(payload.get('symptoms') or []) or 'none selected'}.",
            f"Triggers: {', '.join(payload.get('triggers') or []) or 'none'}.",
            f"Severity at worst: {payload.get('severity')}/10. Duration: {payload.get('duration')}.",
            f"Known conditions: {', '.join(payload.get('condition_ids') or []) or 'none on file'}.",
            f'Their own words: "{notes}"' if notes else "",
            "",
            "CONTEXT:",
            format_context(hits),
        ]
    )

    try:
        raw, _usage = await nim.complete(
            messages=[
                {"role": "system", "content": TRIAGE_EXPLAINER},
                {"role": "user", "content": user_block},
            ],
            temperature=0.2,
            max_tokens=nim.s.nim_max_tokens_triage,
            json_only=True,
        )
        parsed = parse_json(raw, {})
        summary = str(parsed.get("summary") or "").strip()
        if summary:
            response["summary"] = summary
    except (NimNotConfigured, NimError):
        response["summary"] = None  # rules-only result is still a complete answer

    response["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return response
