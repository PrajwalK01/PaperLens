"""
Unit tests for app/utils/cost_tracker.py — pure cost math, no network needed.

Run: cd backend && pytest tests/test_cost_tracker.py -v
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.cost_tracker import estimate_cost, extract_usage_from_response, _char_count_to_tokens


class _FakeResponseWithUsageMetadata:
    def __init__(self, input_tokens, output_tokens, content=""):
        self.usage_metadata = {"input_tokens": input_tokens, "output_tokens": output_tokens}
        self.content = content
        self.response_metadata = {}


class _FakeResponseNoUsage:
    def __init__(self, content=""):
        self.usage_metadata = None
        self.response_metadata = {}
        self.content = content


def test_estimate_cost_zero_for_free_provider():
    assert estimate_cost("ollama", 10000, 5000) == 0.0


def test_estimate_cost_positive_for_paid_provider():
    cost = estimate_cost("claude", 1000, 1000)
    assert cost > 0


def test_estimate_cost_scales_with_tokens():
    small = estimate_cost("claude", 1000, 1000)
    large = estimate_cost("claude", 10000, 10000)
    assert large > small
    # Should scale roughly linearly (10x tokens ~= 10x cost)
    assert abs(large / small - 10) < 0.5


def test_estimate_cost_unknown_provider_defaults_to_zero():
    assert estimate_cost("some_provider_that_doesnt_exist", 1000, 1000) == 0.0


def test_extract_usage_uses_real_usage_metadata_when_available():
    response = _FakeResponseWithUsageMetadata(input_tokens=500, output_tokens=200)
    usage = extract_usage_from_response(response, "claude", fallback_char_count=9999)
    assert usage["input_tokens"] == 500
    assert usage["output_tokens"] == 200
    assert usage["tokens_are_estimated"] is False
    assert usage["estimated_cost_usd"] > 0


def test_extract_usage_falls_back_to_char_estimate_when_no_usage_reported():
    response = _FakeResponseNoUsage(content="a" * 400)  # 400 chars -> ~100 tokens
    usage = extract_usage_from_response(response, "ollama", fallback_char_count=800)
    assert usage["tokens_are_estimated"] is True
    assert usage["input_tokens"] == 200  # 800 chars / 4
    assert usage["output_tokens"] == 100  # 400 chars / 4
    assert usage["estimated_cost_usd"] == 0.0  # ollama is free regardless


def test_char_count_to_tokens_never_returns_zero():
    assert _char_count_to_tokens(0) == 1  # avoid div-by-zero downstream, minimum 1


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed, failed = 0, 0
    for t in tests:
        try:
            t()
            print(f"PASS: {t.__name__}")
            passed += 1
        except AssertionError:
            print(f"FAIL: {t.__name__}")
            traceback.print_exc()
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
