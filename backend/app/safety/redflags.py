"""Deterministic red-flag detection on free text.

This runs before any model sees the message. It is regex over a curated
lexicon, not a classifier, because the cost of a missed stroke phrase is not
symmetric with the cost of an unnecessary escalation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Ordered: the first match wins for reporting, but all matches are returned.
RED_FLAG_PATTERNS: list[tuple[str, str, str]] = [
    (
        "cardiac",
        r"\b(chest (pain|pressure|tightness|tight)|crushing chest|pain (radiat|spread)\w* to (my )?(arm|jaw|back)|elephant on my chest)\b",
        "Chest pain or pressure, including pain spreading to the arm, jaw or back.",
    ),
    (
        "stroke",
        r"\b(face (is )?droop\w*|drooping face|slurr\w* speech|one side of my (face|body)|can'?t (move|feel) my (arm|leg|side)|sudden weakness)\b",
        "Possible stroke signs: facial droop, slurred speech, one-sided weakness.",
    ),
    (
        "breathing",
        r"\b(can'?t breathe|cannot breathe|struggling to breathe|gasping|can'?t finish a sentence|blue lips)\b",
        "Severe breathing difficulty.",
    ),
    (
        "bleeding",
        r"\b(coughing up blood|vomit\w* blood|blood in (my )?(stool|vomit|urine)|black tarry|bleeding (won'?t|will not) stop)\b",
        "Bleeding that needs urgent assessment.",
    ),
    (
        "neuro",
        r"\b(worst headache (of my life|ever)|thunderclap|sudden(ly)? (confus|blind)\w*|seizure|passed out|fainted)\b",
        "Sudden severe headache, collapse, seizure or new confusion.",
    ),
    (
        "abdominal",
        r"\b(rigid (abdomen|belly|stomach)|abdomen is hard|severe abdominal pain)\b",
        "Severe or rigid abdomen.",
    ),
    (
        "obstetric",
        r"\b(no fetal movement|baby (isn'?t|is not) moving|heavy bleeding (and|while) pregnan)\w*\b",
        "Pregnancy-related emergency signs.",
    ),
]

COMPILED = [(name, re.compile(pattern, re.I), reason) for name, pattern, reason in RED_FLAG_PATTERNS]

EMERGENCY_TEXT = (
    "Based on what you have described, this needs emergency care now. "
    "Call your local emergency number or go to the nearest emergency department. "
    "Do not drive yourself."
)


@dataclass
class RedFlagResult:
    triggered: bool
    categories: list[str]
    reasons: list[str]


def screen_text(text: str) -> RedFlagResult:
    categories: list[str] = []
    reasons: list[str] = []
    for name, pattern, reason in COMPILED:
        if pattern.search(text or ""):
            categories.append(name)
            reasons.append(reason)
    return RedFlagResult(triggered=bool(categories), categories=categories, reasons=reasons)
