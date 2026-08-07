# What was added (Agentic RAG + Integrity + CNN)

This is layered on top of the existing PaperLens backend without changing its
public API shape. New/changed files:

## 1. Chunking + vector store (foundation)
- `backend/app/utils/chunking.py` — section-aware chunking, Chroma vector
  store, per-paper collections, retrieval. Local embeddings
  (sentence-transformers `all-MiniLM-L6-v2`) — no API key needed.
- `backend/app/utils/pdf_parser.py` — added `extract_images()` to pull
  embedded figures via PyMuPDF (feeds the CNN pipeline).

## 2 & 3. Agentic RAG — all 4 reviewer nodes
- `backend/app/agents/tools.py` — `retrieve_paper_section` tool +
  `run_agentic_reviewer()`, a reason→retrieve→reason loop (max 6 steps)
  bound to any LangChain chat model via `bind_tools`.
- `backend/app/agents/prompts.py` — added `AGENTIC_PRIMARY_REVIEWER_PROMPT`
  and `AGENTIC_CRITIC_REVIEWER_PROMPT` (no full-text dump — the agent
  retrieves what it needs). Also added `{integrity_report}` to the
  Synthesizer prompt.
- `backend/app/agents/orchestrator.py` — rewritten with a node factory so
  all 4 nodes (A/B primary, A/B critic) run agentically. Same graph shape
  as before (2 groups of 2, feeding a Synthesizer).
  - `AGENTIC_RAG_ENABLED=true|false` (env var, default true) — falls back
    to the original full-text-in-prompt behavior if a paper somehow isn't
    indexed, or for A/B comparison.
  - `INDEPENDENT_AGENTS_MODE=true|false` (env var, default false) — set
    `true` to make critics NOT see their primary's output (fully
    independent 4-agent review, matching the "4 AIs with no visibility
    into each other" framing). Default keeps critic-refines-primary.

## 4. Plagiarism / AI-text detection
- `backend/app/utils/plagiarism.py`
  - `check_similarity()` — compares this paper's chunks against every
    other paper already indexed in Chroma (cross-submission overlap, NOT
    an internet-wide plagiarism scan — there's no bundled corpus of all
    published research; wire in Turnitin/Copyleaks/iThenticate here if
    you get API access).
  - `heuristic_ai_text_score()` — cheap, dependency-free statistical
    signal (sentence-length burstiness, repetition rate).
  - `llm_judge_ai_text()` — second opinion via LLM-as-judge.
  - `run_integrity_checks()` — combines both into one report, feeds the
    Synthesizer prompt as `{integrity_report}`.

## 5. CNN figure analysis
- `backend/app/utils/cnn_figures.py` — ResNet18 backbone (ImageNet
  pretrained, frozen) + a small trainable classification head.
  - **Classification head is UNTRAINED out of the box.** Nobody can hand
    you a trained academic-figure classifier without a labeled dataset.
    `train_classifier_head(labeled_data_dir=...)` at the bottom of the
    file is the fine-tuning entry point — point it at a folder of
    labeled images (`chart_or_plot/`, `diagram/`, `photo_or_micrograph/`,
    `screenshot/`, `table_image/`) and it trains in a few minutes on CPU.
  - **Duplicate-figure detection works correctly with zero training** —
    it's pure perceptual-hash similarity, not classification. This is the
    most immediately useful part of this module.

## 6. Training signal collection
- `backend/app/models.py` — added `RetrievalTrace` (what each agent
  looked up, in what order) and `IntegrityCheck` (plagiarism/AI-text/
  figure results) tables.
- `backend/app/routers/review.py` — runs integrity checks before the
  pipeline, persists retrieval traces after.
- `backend/app/routers/finetune.py` — added
  `GET /api/finetune/export-retrieval-traces`, exporting the ordered
  retrieval trajectory per agent per job alongside the final verdict —
  this is the "how a human reviewer actually navigates a paper" signal
  Lavanya wants to train toward, not just end verdicts.

## New dependencies (already added to `backend/requirements.txt`)
```
chromadb==0.5.5
sentence-transformers==3.0.1
langchain-text-splitters==0.2.2
torch==2.3.1
torchvision==0.18.1
Pillow==10.4.0
```

## To run it
Same as before (`SETUP.md` / `QUICKSTART.md`) — `pip install -r
requirements.txt` (first run will download the sentence-transformers model
and ResNet18 weights, needs internet once), then `uvicorn app.main:app
--reload`. No new environment variables are required; `AGENTIC_RAG_ENABLED`
and `INDEPENDENT_AGENTS_MODE` are optional overrides.

## Honest gaps / what's next
- Similarity check uses token-overlap as a stand-in for true cosine
  distance (documented in `plagiarism.py` — swap in
  `collection.query(..., include=["distances"])` for the real thing).
- CNN classification needs your labeled data to be accurate — duplicate
  detection needs nothing and works today.
- AI-text detection is a supporting signal, not a certainty — no
  open-source detector is reliable enough to be a sole verdict source.
- `python-multipart`/deps aside, torch/torchvision are ~1GB combined —
  fine for a laptop, worth knowing before `pip install` on a slow
  connection.
