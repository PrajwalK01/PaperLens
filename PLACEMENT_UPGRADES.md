# Placement Upgrades — Phase 1 & 2

This session added an evaluation framework, observability/tracing, a real
test suite, and fixed the Ollama tool-calling bug found while reviewing
the GitHub repo. Phase 3 (deployment, cost dashboard, security hardening,
README/architecture diagram) is still to come.

## Bug fixes (found while reviewing the repo's Ollama addition)

- **`_SimpleOllamaClient` had no `bind_tools()`** — any Ollama-assigned
  role would crash the moment agentic RAG tried to bind the retrieval
  tool. Fixed via `orchestrator._resolve_path()`, which now routes each
  node to one of three paths based on provider:
  - `tool_loop` — real agentic RAG (Claude/GPT-4o/Gemini/Mistral/Groq)
  - `simple_rag` — retrieval done upfront, single call (Ollama)
  - `plain_text` — original full-text-in-prompt fallback
- **Missing `ollama` package** in `requirements.txt` — added.
- **`generate_reviews.py` never indexed papers** before reviewing them,
  so agentic RAG silently never activated for the training-data
  generation script. Fixed — now calls `chunking.index_paper()` first.
- **Groq added** as a free-tier provider (OpenAI-compatible endpoint,
  same pattern as the existing xAI/Z.ai integrations).
- **Multi-provider fallback chain** (`get_model_for_role_with_fallback`
  in `llm_clients.py`) — protects against a role being configured for a
  dead/rate-limited free key.
- **Real cosine similarity** — `chunking.retrieve_with_distances()` +
  updated `plagiarism.py` replace the earlier token-overlap
  approximation with actual Chroma distances.
- **`chunking.py` now lazily initializes its Chroma client/embedding
  function** instead of at import time — means importing the module (or
  anything that imports it) no longer requires chromadb/sentence-
  transformers to be installed, which also made real unit testing
  possible without the full dependency stack.

## Evaluation framework (`backend/evaluation/`)

- `run_eval.py` — runs the full review pipeline over a labeled paper set
  and reports exact agreement, adjacent agreement (within one category —
  a fairer metric since even human reviewers often disagree by one
  notch), a full confusion matrix, per-category precision/recall/F1, and
  latency stats. Outputs `eval_report.md` (ready to paste into your
  README/resume) and `eval_results.json` (raw per-paper data).
- `labeled_papers.example.jsonl` — shows the expected input format.
- **To use it:** build `evaluation/labeled_papers.jsonl` with 50-100
  papers that have known human outcomes (professor reviews, real venue
  decisions from OpenReview, or papers you and Lavanya review by hand
  specifically for this), then `python evaluation/run_eval.py`.

## Observability (`backend/app/utils/observability.py`)

- Every node now logs structured start/end/error events with timing and
  model info to a local JSONL trace file — no external service (LangSmith
  etc.) required.
- New endpoint: `GET /api/review/{job_id}/trace` — full event trace plus
  a per-agent summary (duration, status, model used, error if any).
- This is what makes "why did this agent flag this paper" answerable
  from a trace instead of re-running the review and guessing.

## Test suite (`backend/tests/`)

26 tests, all passing, genuinely run (not just written) in this session
via a lightweight stubbing approach so they don't require the full
torch/chromadb dependency stack to execute:

- `test_chunking.py` (9 tests) — section splitting, chunk boundaries,
  metadata assignment, edge cases (empty text, no headers found)
- `test_plagiarism.py` (5 tests) — heuristic AI-text scorer behavior and
  edge cases
- `test_cnn_figures.py` (6 tests) — duplicate-figure detection via
  perceptual hash / Hamming distance (doesn't need torch — this logic is
  pure hashing)
- `test_orchestrator_routing.py` (6 tests) — **the regression guard for
  the Ollama bug specifically.** Locks in that an Ollama-assigned role
  can never resolve to `tool_loop`, that Claude/Groq models do get the
  full agentic loop, and that an unindexed paper always falls back to
  plain-text mode regardless of provider. This is the single most
  valuable test file in the suite — it's what stops this exact bug class
  from silently coming back.

Run: `cd backend && pip install pytest && pytest tests/ -v`

Note: `test_chunking.py`, `test_plagiarism.py`, and
`test_orchestrator_routing.py` use `conftest.py`'s chromadb stub or
inline stubs to run without the full dependency stack — that's
intentional (fast, no GPU/network needed for CI), not a shortcut around
real coverage. Once you `pip install -r requirements.txt` for real, the
actual chromadb/torch code paths are what runs in production; these
tests validate the logic around them.

## Still to do (Phase 3)

- Deployment (Docker is already there — actually deploy to
  Render/Railway/Fly.io for a live demo link)
- Cost/latency dashboard surfacing which model handled what, at what cost
- Security hardening (rate limiting, input validation, a short threat-
  model section in the README)
- Architecture diagram + tightened README with the eval results front
  and center
