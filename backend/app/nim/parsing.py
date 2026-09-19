"""Helpers for turning model text into structured data."""

from __future__ import annotations

import json


def parse_json(text: str, fallback: dict | None = None) -> dict:
    """Models fence JSON no matter how firmly you ask."""
    if not text:
        return fallback or {}
    cleaned = text.replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        return fallback or {}
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return fallback or {}
