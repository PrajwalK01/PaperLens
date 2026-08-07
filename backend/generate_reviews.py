"""
Standalone script to run PaperLens's review orchestrator over a set of papers
and save the raw outputs as training data for fine-tuning.

Place this file inside PaperLens/backend/ (same level as the "app" folder)
and run it from there:

    cd PaperLens/backend
    python generate_reviews.py

Make sure the AGENT_MODEL_* env vars are set to your Ollama model first,
and that `ollama serve` is running in another terminal.

Input:  papers_text.jsonl  (one line per paper: {"id": ..., "text": ...})
Output: training_data.jsonl (one line per paper: instruction/input/output
        triples for each of the 5 roles - primary A/B, critic A/B, synthesizer)
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agents.orchestrator import run_review  # noqa: E402
from app.utils import chunking  # noqa: E402

INPUT_FILE = "papers_text.jsonl"
OUTPUT_FILE = "training_data.jsonl"
PROGRESS_FILE = "generation_progress.txt"


def load_papers(path):
    papers = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                papers.append(json.loads(line))
    return papers


def load_done_ids(path):
    if not os.path.exists(path):
        return set()
    with open(path, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def mark_done(path, paper_id):
    with open(path, "a", encoding="utf-8") as f:
        f.write(paper_id + "\n")


def dummy_db_callback(**kwargs):
    # We don't need DB persistence here - just let the orchestrator run.
    pass


def main():
    papers = load_papers(INPUT_FILE)
    done_ids = load_done_ids(PROGRESS_FILE)
    print(f"Loaded {len(papers)} papers. Already done: {len(done_ids)}")

    out_f = open(OUTPUT_FILE, "a", encoding="utf-8")

    for i, paper in enumerate(papers):
        paper_id = paper["id"]
        if paper_id in done_ids:
            continue

        text = paper["text"]
        title = text.split("\n")[0][:200] if text else paper_id

        print(f"[{i+1}/{len(papers)}] Reviewing: {paper_id} - {title[:60]}")

        try:
            chunking.index_paper(paper_id, text)
        except Exception as e:
            print(f"  WARNING: indexing failed for {paper_id}, will fall back to plain-text mode: {e}")

        try:
            final_state = run_review(
                job_id=f"job_{paper_id}",
                paper_id=paper_id,
                paper_title=title,
                authors="Unknown",
                paper_full_text=text,
                research_field="General",
                model_config={},  # uses env-var defaults (your Ollama model)
                db_callback=dummy_db_callback,
            )

            # Save one training example per role that succeeded
            role_outputs = {
                "group_a_primary": final_state.get("group_a_primary"),
                "group_a_critic": final_state.get("group_a_critic"),
                "group_b_primary": final_state.get("group_b_primary"),
                "group_b_critic": final_state.get("group_b_critic"),
                "final_review": final_state.get("final_review"),
            }

            record = {
                "paper_id": paper_id,
                "paper_text": text,
                "outputs": role_outputs,
                "errors": final_state.get("errors", []),
            }
            out_f.write(json.dumps(record) + "\n")
            out_f.flush()

            mark_done(PROGRESS_FILE, paper_id)

        except Exception as e:
            print(f"  FAILED: {paper_id} - {e}")
            time.sleep(2)
            continue

    out_f.close()
    print(f"\nDone. Training data saved to '{OUTPUT_FILE}'")


if __name__ == "__main__":
    main()