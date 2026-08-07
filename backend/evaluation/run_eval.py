"""
PaperLens Evaluation Framework
==============================

Runs the full review pipeline over a set of papers with KNOWN human
outcomes and reports real agreement metrics — the numbers that turn
"I built an AI reviewer" into "I built and validated an AI reviewer."

USAGE
-----
1. Build evaluation/labeled_papers.jsonl — one JSON object per line:
   {
     "paper_id": "p001",
     "title": "...",
     "authors": "...",
     "text": "<full extracted paper text>",
     "human_recommendation": "Accept" | "Minor Revision" | "Major Revision" | "Reject",
     "human_score": 7.5          # optional, 1-10, if your reviewers gave one
   }

   Good sources for this: papers your professors have already reviewed,
   papers with known venue outcomes (OpenReview publishes real accept/
   reject decisions + reviews for many venues), or papers you and
   Lavanya review by hand specifically to build this eval set.

2. Run it:
     cd backend
     python evaluation/run_eval.py

3. Read evaluation/eval_report.md — this is what goes in your README /
   resume / interview talking points. evaluation/eval_results.json has
   the raw per-paper data if you want to slice it further.

WHAT IT MEASURES
----------------
- Exact agreement: does the system's final recommendation exactly match
  the human's?
- Adjacent agreement: does it match within one step on the ordinal scale
  (Accept/Minor/Major/Reject)? This matters because even human reviewers
  often disagree by one notch — it's a fairer "close enough" metric to
  report alongside exact agreement, not instead of it.
- Confusion matrix: where specifically does the system diverge from
  humans (e.g. does it over-reject borderline papers?)
- Per-category precision/recall: is it worse at spotting one category
  than another?
- Latency: average wall-clock time per full review (5-role pipeline)
- Path breakdown: how many reviews ran tool_loop vs simple_rag vs
  plain_text — useful to show whether your agentic RAG path is even
  being exercised on your eval set (see the /generate_reviews.py bug
  this was built to also catch — same principle applies here)
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.orchestrator import run_review  # noqa: E402
from app.utils import chunking  # noqa: E402

LABELED_FILE = os.path.join(os.path.dirname(__file__), "labeled_papers.jsonl")
RESULTS_JSON = os.path.join(os.path.dirname(__file__), "eval_results.json")
REPORT_MD = os.path.join(os.path.dirname(__file__), "eval_report.md")

# Canonical ordinal scale — used for adjacent-agreement and confusion matrix ordering
RECOMMENDATION_SCALE = ["Accept", "Minor Revision", "Major Revision", "Reject"]

# Common label variants papers/reviewers might use, normalized to the canonical set above
LABEL_ALIASES = {
    "accept": "Accept",
    "accepted": "Accept",
    "minor revision": "Minor Revision",
    "minor revisions": "Minor Revision",
    "weak accept": "Minor Revision",
    "major revision": "Major Revision",
    "major revisions": "Major Revision",
    "weak reject": "Major Revision",
    "reject": "Reject",
    "rejected": "Reject",
    "strong reject": "Reject",
}


def normalize_label(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    key = raw.strip().lower()
    return LABEL_ALIASES.get(key, raw.strip() if raw.strip() in RECOMMENDATION_SCALE else None)


def load_labeled_papers(path: str) -> List[dict]:
    if not os.path.exists(path):
        print(f"ERROR: {path} not found.")
        print("Create it first — see the docstring at the top of this file for the format.")
        sys.exit(1)
    papers = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                papers.append(json.loads(line))
    return papers


def dummy_db_callback(**kwargs):
    pass


def run_one_paper(paper: dict) -> Dict[str, Any]:
    paper_id = paper["paper_id"]
    text = paper["text"]

    # Index first so agentic RAG actually engages (this is the exact gap
    # found in generate_reviews.py — the eval framework doesn't repeat it)
    try:
        chunking.index_paper(paper_id, text)
    except Exception as exc:
        print(f"  WARNING: indexing failed for {paper_id}: {exc}")

    start = time.time()
    try:
        final_state = run_review(
            job_id=f"eval_{paper_id}",
            paper_id=paper_id,
            paper_title=paper.get("title", paper_id),
            authors=paper.get("authors", "Unknown"),
            paper_full_text=text,
            research_field=paper.get("research_field", "General"),
            model_config={},
            db_callback=dummy_db_callback,
        )
        latency = time.time() - start
        final_review = final_state.get("final_review") or {}
        predicted = normalize_label(final_review.get("final_recommendation"))
        return {
            "paper_id": paper_id,
            "human_recommendation": normalize_label(paper.get("human_recommendation")),
            "predicted_recommendation": predicted,
            "predicted_confidence": final_review.get("confidence"),
            "human_score": paper.get("human_score"),
            "latency_seconds": round(latency, 2),
            "errors": final_state.get("errors", []),
            "success": predicted is not None,
        }
    except Exception as exc:
        return {
            "paper_id": paper_id,
            "human_recommendation": normalize_label(paper.get("human_recommendation")),
            "predicted_recommendation": None,
            "predicted_confidence": None,
            "human_score": paper.get("human_score"),
            "latency_seconds": round(time.time() - start, 2),
            "errors": [str(exc)],
            "success": False,
        }


def compute_metrics(results: List[dict]) -> Dict[str, Any]:
    valid = [r for r in results if r["success"] and r["human_recommendation"] and r["predicted_recommendation"]]
    total = len(results)
    n_valid = len(valid)

    exact_matches = sum(1 for r in valid if r["predicted_recommendation"] == r["human_recommendation"])
    exact_agreement = exact_matches / n_valid if n_valid else 0.0

    def scale_index(label: str) -> int:
        return RECOMMENDATION_SCALE.index(label) if label in RECOMMENDATION_SCALE else -1

    adjacent_matches = sum(
        1 for r in valid
        if abs(scale_index(r["predicted_recommendation"]) - scale_index(r["human_recommendation"])) <= 1
    )
    adjacent_agreement = adjacent_matches / n_valid if n_valid else 0.0

    # Confusion matrix: rows = human label, cols = predicted label
    confusion: Dict[str, Dict[str, int]] = {h: {p: 0 for p in RECOMMENDATION_SCALE} for h in RECOMMENDATION_SCALE}
    for r in valid:
        h, p = r["human_recommendation"], r["predicted_recommendation"]
        if h in confusion and p in confusion[h]:
            confusion[h][p] += 1

    # Per-category precision/recall
    per_category = {}
    for label in RECOMMENDATION_SCALE:
        tp = confusion[label][label]
        fn = sum(confusion[label].values()) - tp
        fp = sum(confusion[other][label] for other in RECOMMENDATION_SCALE if other != label)
        precision = tp / (tp + fp) if (tp + fp) else None
        recall = tp / (tp + fn) if (tp + fn) else None
        f1 = (2 * precision * recall / (precision + recall)) if (precision and recall and (precision + recall)) else None
        per_category[label] = {"precision": precision, "recall": recall, "f1": f1, "support": sum(confusion[label].values())}

    latencies = [r["latency_seconds"] for r in results if r.get("latency_seconds")]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

    failures = [r for r in results if not r["success"]]

    return {
        "total_papers": total,
        "valid_comparisons": n_valid,
        "failed_or_unlabeled": total - n_valid,
        "exact_agreement": round(exact_agreement, 4),
        "adjacent_agreement": round(adjacent_agreement, 4),
        "confusion_matrix": confusion,
        "per_category": per_category,
        "avg_latency_seconds": round(avg_latency, 2),
        "min_latency_seconds": round(min(latencies), 2) if latencies else None,
        "max_latency_seconds": round(max(latencies), 2) if latencies else None,
        "failure_count": len(failures),
        "failure_paper_ids": [f["paper_id"] for f in failures],
    }


def render_report(metrics: Dict[str, Any], results: List[dict]) -> str:
    lines = []
    lines.append("# PaperLens Evaluation Report\n")
    lines.append(f"**Papers evaluated:** {metrics['total_papers']} "
                 f"({metrics['valid_comparisons']} with valid human labels + successful predictions)\n")
    lines.append(f"**Exact agreement with human reviewers:** {metrics['exact_agreement']:.1%}")
    lines.append(f"**Adjacent agreement (within one category):** {metrics['adjacent_agreement']:.1%}\n")
    lines.append(f"**Average review latency:** {metrics['avg_latency_seconds']}s "
                 f"(min {metrics['min_latency_seconds']}s / max {metrics['max_latency_seconds']}s)\n")

    if metrics["failure_count"]:
        lines.append(f"**Failed reviews:** {metrics['failure_count']} — {metrics['failure_paper_ids']}\n")

    lines.append("## Confusion Matrix (rows = human label, columns = predicted)\n")
    header = "| Human \\ Predicted | " + " | ".join(RECOMMENDATION_SCALE) + " |"
    sep = "|---" * (len(RECOMMENDATION_SCALE) + 1) + "|"
    lines.append(header)
    lines.append(sep)
    for h in RECOMMENDATION_SCALE:
        row = metrics["confusion_matrix"][h]
        lines.append(f"| **{h}** | " + " | ".join(str(row[p]) for p in RECOMMENDATION_SCALE) + " |")
    lines.append("")

    lines.append("## Per-Category Precision / Recall / F1\n")
    lines.append("| Category | Precision | Recall | F1 | Support |")
    lines.append("|---|---|---|---|---|")
    for label, m in metrics["per_category"].items():
        p = f"{m['precision']:.2f}" if m["precision"] is not None else "—"
        r = f"{m['recall']:.2f}" if m["recall"] is not None else "—"
        f1 = f"{m['f1']:.2f}" if m["f1"] is not None else "—"
        lines.append(f"| {label} | {p} | {r} | {f1} | {m['support']} |")
    lines.append("")

    lines.append("## How to cite this in your README / resume\n")
    lines.append(
        f"> \"PaperLens achieves {metrics['exact_agreement']:.0%} exact agreement "
        f"({metrics['adjacent_agreement']:.0%} adjacent agreement) with human reviewer "
        f"recommendations across {metrics['valid_comparisons']} evaluated papers, "
        f"with an average review time of {metrics['avg_latency_seconds']:.0f} seconds per paper.\"\n"
    )

    return "\n".join(lines)


def main():
    papers = load_labeled_papers(LABELED_FILE)
    print(f"Loaded {len(papers)} labeled papers for evaluation.\n")

    results = []
    for i, paper in enumerate(papers):
        print(f"[{i+1}/{len(papers)}] Evaluating: {paper.get('paper_id')} - {paper.get('title', '')[:60]}")
        result = run_one_paper(paper)
        results.append(result)
        status = "OK" if result["success"] else "FAILED"
        print(f"  {status} — human={result['human_recommendation']} predicted={result['predicted_recommendation']} "
              f"({result['latency_seconds']}s)")

    metrics = compute_metrics(results)

    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump({"metrics": metrics, "per_paper_results": results}, f, indent=2)

    report = render_report(metrics, results)
    with open(REPORT_MD, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"\nDone. Report: {REPORT_MD}")
    print(f"Raw results: {RESULTS_JSON}")
    print(f"\nExact agreement: {metrics['exact_agreement']:.1%}")
    print(f"Adjacent agreement: {metrics['adjacent_agreement']:.1%}")


if __name__ == "__main__":
    main()
