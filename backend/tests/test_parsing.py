from app.nim.parsing import parse_json


def test_parse_json_handles_fences_and_garbage():
    assert parse_json('```json\n{"a": 1}\n```')["a"] == 1
    assert parse_json('here you go: {"b": 2} hope that helps')["b"] == 2
    assert parse_json("not json", {"fallback": True})["fallback"] is True
    assert parse_json("", {}) == {}
