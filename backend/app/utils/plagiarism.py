"""
Plagiarism / similarity + AI-generated-text detection for PaperLens.

Two independent checks, combined into one integrity report consumed by
the Synthesizer node:

1. SIMILARITY CHECK — embedding cosine-similarity between this paper's
   chunks and chunks of every other paper already indexed in Chroma
   (utils/chunking.py). This flags overlap with anything else PaperLens
   has ever ingested. It is NOT a full internet plagiarism scan — there is
   no bundled corpus of all published research. If you get access to an
   external plagiarism API (Turnitin, Copyleaks, iThenticate, etc.), wire
   its result into `external_similarity_score` below.

2. AI-GENERATED-TEXT CHECK — a lightweight heuristic scorer (burstiness /
   sentence-length variance / repetition — cheap, no model download)
   PLUS an LLM-as-judge pass for a second opinion. Neither is a
   state-of-the-art detector (nothing open-source reliably is, as of
   this writing) — treat this as a supporting signal, not a verdict.

Nothing here requires paid APIs beyond the LLM you're already using for
review agents.
"""

from __future__ import annotations

import logging
import re
import statistics
from typing import Any, Dict, List, Optional, TypedDict

from app.utils import chunking

logger = logging.getLogger(__name__)

SIMILARITY_FLAG_THRESHOLD = 0.85   # cosine similarity above this = flagged overlap
AI_TEXT_HEURISTIC_FLAG_THRESHOLD = 0.7  # 0-1 heuristic score above this = suspicious


class SimilarityMatch(TypedDict):
    matched_paper_id: str
    matched_chunk_preview: str
    this_chunk_preview: str
    similarity: float


class IntegrityReport(TypedDict):
    similarity_matches: List[SimilarityMatch]
    max_similarity: float
    ai_text_heuristic_score: float
    ai_text_llm_judgment: Optional[Dict[str, Any]]
    flags: List[str]


# ── 1. Cross-paper similarity check ─────────────────────────────────────────

def check_similarity(paper_id: str, top_n_matches: int = 5) -> Dict[str, Any]:
    """
    Compare this paper's chunks against every other indexed paper's chunks
    using Chroma's real embedding cosine distance. Returns the strongest matches.
    """
    other_paper_ids = chunking.list_indexed_paper_ids(exclude=paper_id)
    if not other_paper_ids:
        return {"similarity_matches": [], "max_similarity": 0.0}

    this_chunks = chunking.get_all_chunk_texts(paper_id)
    if not this_chunks:
        return {"similarity_matches": [], "max_similarity": 0.0}

    matches: List[SimilarityMatch] = []
    # Query a handful of representative chunks (not all — keeps this cheap)
    sample_chunks = this_chunks[:: max(1, len(this_chunks) // 8)][:8]

    for chunk_text in sample_chunks:
        for other_id in other_paper_ids:
            results = chunking.retrieve_with_distances(paper_id=other_id, query_text=chunk_text[:500], k=1)
            if not results:
                continue
            matched_chunk, distance = results[0]
            # Chroma's default cosine distance is in [0, 2] (0 = identical).
            # Convert to a 0-1 similarity score: sim = 1 - distance/2.
            sim = max(0.0, 1.0 - (distance / 2.0))
            if sim >= SIMILARITY_FLAG_THRESHOLD:
                matches.append(
                    SimilarityMatch(
                        matched_paper_id=other_id,
                        matched_chunk_preview=matched_chunk["text"][:200],
                        this_chunk_preview=chunk_text[:200],
                        similarity=round(sim, 3),
                    )
                )

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    max_sim = matches[0]["similarity"] if matches else 0.0
    return {"similarity_matches": matches[:top_n_matches], "max_similarity": max_sim}


def _token_overlap_similarity(a: str, b: str) -> float:
    """Cheap Jaccard-style token overlap as a similarity stand-in (0-1)."""
    tokens_a = set(re.findall(r"\w+", a.lower()))
    tokens_b = set(re.findall(r"\w+", b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union else 0.0


# ── 2a. Heuristic AI-text scorer (no model download, runs anywhere) ────────

def heuristic_ai_text_score(text: str) -> float:
    """
    Returns a 0-1 score where higher = more likely AI-generated, based on
    cheap statistical signals known to correlate (weakly) with LLM output:
      - low sentence-length variance ("burstiness") — humans vary sentence
        length more than most LLMs at default settings
      - low repeated-phrase rate
      - low rate of contractions / informal markers
    This is a heuristic, not a classifier — use as one signal among several.
    """
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if len(sentences) < 5:
        return 0.0

    lengths = [len(s.split()) for s in sentences]
    mean_len = statistics.mean(lengths)
    stdev_len = statistics.stdev(lengths) if len(lengths) > 1 else 0.0
    burstiness = stdev_len / mean_len if mean_len else 0.0
    # Lower burstiness -> more uniform sentence lengths -> more "AI-like"
    burstiness_score = max(0.0, 1.0 - min(burstiness, 1.0))

    words = re.findall(r"\w+", text.lower())
    trigrams = [" ".join(words[i:i + 3]) for i in range(len(words) - 2)]
    repetition_rate = 1 - (len(set(trigrams)) / len(trigrams)) if trigrams else 0.0
    repetition_score = min(repetition_rate * 3, 1.0)  # scale up — repetition is rare in real text

    contractions = len(re.findall(r"\b\w+'(?:t|re|ve|ll|d|s)\b", text.lower()))
    informality_score = max(0.0, 1.0 - min(contractions / max(len(sentences), 1), 1.0))

    score = 0.5 * burstiness_score + 0.3 * repetition_score + 0.2 * informality_score
    return round(min(max(score, 0.0), 1.0), 3)


# ── 2b. LLM-as-judge AI-text detector ───────────────────────────────────────

AI_TEXT_JUDGE_PROMPT = """You are an expert at distinguishing human-written academic prose \
from LLM-generated text. Read the excerpt below and judge whether it reads as AI-generated.
Consider: generic hedging language, overly uniform structure, repetitive sentence openers, \
lack of specific/idiosyncratic detail, and overly "smooth" transitions as signs of AI \
generation. Note that well-edited human writing can also be smooth — weigh evidence \
carefully rather than defaulting to "AI-generated" for merely polished prose.

Excerpt:
---
{excerpt}
---

Respond with ONLY a JSON object, no markdown fences:
{{
  "likely_ai_generated": <true|false>,
  "confidence": "<High|Medium|Low>",
  "reasoning": "<1-2 sentence justification citing specific textual evidence>"
}}"""


def llm_judge_ai_text(excerpt: str, llm: Any) -> Dict[str, Any]:
    """Run an LLM-as-judge pass on a representative excerpt. `llm` is any bound LangChain chat model."""
    import json as _json
    from langchain_core.messages import HumanMessage

    try:
        response = llm.invoke([HumanMessage(content=AI_TEXT_JUDGE_PROMPT.format(excerpt=excerpt[:4000]))])
        raw = response.content
        cleaned = re.sub(r"```(?:json)?\s*", "", raw)
        cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        return _json.loads(match.group(0) if match else cleaned)
    except Exception as exc:
        logger.warning("LLM-as-judge AI-text check failed: %s", exc)
        return {"likely_ai_generated": None, "confidence": "Low", "reasoning": f"Judge call failed: {exc}"}


# ── Combined integrity report ───────────────────────────────────────────────

def run_integrity_checks(paper_id: str, paper_text: str, llm: Optional[Any] = None) -> IntegrityReport:
    """
    Run both checks and produce a combined report. Pass an already-constructed
    LangChain chat model as `llm` to enable the LLM-as-judge pass; if omitted,
    only the heuristic score is used.
    """
    similarity = check_similarity(paper_id)
    heuristic_score = heuristic_ai_text_score(paper_text)

    llm_judgment = None
    if llm is not None:
        # Judge a representative excerpt (middle of the paper, avoids boilerplate abstract/refs)
        excerpt = paper_text[len(paper_text) // 3 : len(paper_text) // 3 + 4000]
        llm_judgment = llm_judge_ai_text(excerpt, llm)

    flags: List[str] = []
    if similarity["max_similarity"] >= SIMILARITY_FLAG_THRESHOLD:
        flags.append(
            f"High text overlap ({similarity['max_similarity']:.0%}) with a previously "
            f"indexed paper — possible duplicate or plagiarism."
        )
    if heuristic_score >= AI_TEXT_HEURISTIC_FLAG_THRESHOLD:
        flags.append(f"Heuristic AI-text score is high ({heuristic_score}) — writing style resembles LLM output.")
    if llm_judgment and llm_judgment.get("likely_ai_generated") is True and llm_judgment.get("confidence") in ("High", "Medium"):
        flags.append(f"LLM-as-judge also flagged likely AI-generated text: {llm_judgment.get('reasoning')}")

    return IntegrityReport(
        similarity_matches=similarity["similarity_matches"],
        max_similarity=similarity["max_similarity"],
        ai_text_heuristic_score=heuristic_score,
        ai_text_llm_judgment=llm_judgment,
        flags=flags,
    )


def report_to_prompt_string(report: IntegrityReport) -> str:
    """Render the integrity report as a compact string for the Synthesizer prompt."""
    import json as _json
    return _json.dumps(report, indent=2)
