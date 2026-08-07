"""
Unit tests for app/utils/plagiarism.py — the heuristic AI-text scorer and
label/threshold logic. Does NOT test check_similarity() (needs a real
Chroma instance with indexed papers) — that's covered by an integration
test in test_integration.py instead.

Run: cd backend && pytest tests/test_plagiarism.py -v
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.plagiarism import (
    heuristic_ai_text_score,
    AI_TEXT_HEURISTIC_FLAG_THRESHOLD,
)

# Deliberately uniform, repetitive text — the kind of pattern the heuristic
# is designed to flag (low sentence-length variance, repeated phrasing)
UNIFORM_REPETITIVE_TEXT = " ".join([
    "This is a sentence of moderate length for testing purposes today.",
] * 20)

# Deliberately varied, human-like text — short bursts, long asides, contractions
VARIED_HUMAN_TEXT = """
I didn't expect this result at all. Honestly, we were stuck for weeks on the
baseline until Priya noticed a bug in how we'd normalized the inputs — turns out
that one line was silently zeroing out half our gradient signal, which, in
hindsight, explains a LOT of the weird plateau we kept seeing around epoch 12.
Fixed it. Reran. Numbers jumped 9 points overnight. We still don't fully know why
the effect is this large, and I'd love someone to poke holes in our explanation
before we lean on it too hard in the writeup.
"""

TOO_SHORT_TEXT = "Just two. Short sentences."


def test_heuristic_score_returns_value_in_valid_range():
    score = heuristic_ai_text_score(UNIFORM_REPETITIVE_TEXT)
    assert 0.0 <= score <= 1.0


def test_heuristic_score_flags_uniform_repetitive_text_higher_than_varied_text():
    uniform_score = heuristic_ai_text_score(UNIFORM_REPETITIVE_TEXT)
    varied_score = heuristic_ai_text_score(VARIED_HUMAN_TEXT)
    assert uniform_score > varied_score


def test_heuristic_score_handles_short_text_gracefully():
    # Fewer than 5 sentences — should return 0.0 (not enough signal), not crash
    score = heuristic_ai_text_score(TOO_SHORT_TEXT)
    assert score == 0.0


def test_heuristic_score_handles_empty_text():
    score = heuristic_ai_text_score("")
    assert score == 0.0


def test_flag_threshold_is_reasonable():
    # Sanity check the constant hasn't been accidentally set outside [0, 1]
    assert 0.0 < AI_TEXT_HEURISTIC_FLAG_THRESHOLD < 1.0


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
