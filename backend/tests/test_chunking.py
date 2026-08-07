"""
Unit tests for app/utils/chunking.py — the section splitting and chunking
logic. These test PURE functions only (no Chroma, no embeddings, no network)
so they run fast and need nothing beyond langchain-text-splitters installed.

Run: cd backend && pytest tests/test_chunking.py -v
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.chunking import split_into_sections, chunk_paper, CHUNK_SIZE


SAMPLE_PAPER = """
Some Paper Title
Authors Here

Abstract
This paper studies an important problem in machine learning and proposes a novel method.

Introduction
Prior work has explored related directions but left an important gap that we address here.
This section discusses motivation and prior work at length to set up our contribution.

Methodology
We propose a new architecture consisting of three components: encoder, retriever, and decoder.
The encoder processes input text into a latent representation used by later stages.

Results
Our method outperforms baselines by 12% on the benchmark dataset across all metrics tested.

Limitations
Our approach has not been tested on non-English text and may not generalize to other domains.

References
[1] Someone et al. Some paper. 2020.
"""


def test_split_into_sections_detects_known_headers():
    sections = split_into_sections(SAMPLE_PAPER)
    section_names = [s[0] for s in sections]

    assert "abstract" in section_names
    assert "introduction" in section_names
    assert "methodology" in section_names
    assert "results" in section_names
    assert "limitations" in section_names
    assert "references" in section_names


def test_split_into_sections_preserves_content():
    sections = split_into_sections(SAMPLE_PAPER)
    section_map = dict(sections)
    assert "novel method" in section_map["abstract"]
    assert "12%" in section_map["results"]


def test_split_into_sections_falls_back_to_full_text_with_no_headers():
    plain_text = "Just some plain text with no section headers at all in it whatsoever."
    sections = split_into_sections(plain_text)
    assert len(sections) == 1
    assert sections[0][0] == "full_text"
    assert sections[0][1] == plain_text


def test_split_into_sections_captures_preamble():
    sections = split_into_sections(SAMPLE_PAPER)
    section_names = [s[0] for s in sections]
    # Title/authors before the first detected heading should be captured, not dropped
    assert "preamble" in section_names


def test_chunk_paper_produces_nonempty_chunks():
    chunks = chunk_paper(SAMPLE_PAPER, paper_id="test_paper_1")
    assert len(chunks) > 0
    for c in chunks:
        assert c["text"].strip() != ""
        assert c["id"].startswith("test_paper_1_chunk_")


def test_chunk_paper_respects_chunk_size_roughly():
    # No single chunk should wildly exceed CHUNK_SIZE (some overshoot is fine
    # due to separator boundaries, but not double the size)
    chunks = chunk_paper(SAMPLE_PAPER, paper_id="test_paper_2")
    for c in chunks:
        assert len(c["text"]) <= CHUNK_SIZE * 2


def test_chunk_paper_assigns_section_metadata():
    chunks = chunk_paper(SAMPLE_PAPER, paper_id="test_paper_3")
    sections_seen = {c["section"] for c in chunks}
    assert "abstract" in sections_seen
    assert "results" in sections_seen


def test_chunk_paper_ids_are_sequential_and_unique():
    chunks = chunk_paper(SAMPLE_PAPER, paper_id="test_paper_4")
    ids = [c["id"] for c in chunks]
    assert len(ids) == len(set(ids))  # all unique
    indices = [c["chunk_index"] for c in chunks]
    assert indices == sorted(indices)  # sequential, in order


def test_chunk_paper_handles_empty_text():
    chunks = chunk_paper("", paper_id="test_paper_empty")
    assert chunks == []


if __name__ == "__main__":
    # Allow running without pytest for a quick manual check
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
