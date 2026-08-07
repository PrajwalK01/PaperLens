"""
Fine-tuning guide endpoint for PaperLens.

GET /api/finetune/guide   — returns structured fine-tuning guidance for
                            scientific paper review models, including dataset
                            format, training steps, evaluation metrics, and
                            per-agent prompt engineering tips.

GET /api/finetune/export  — exports completed review jobs as JSONL training
                            data that can be fed directly to a fine-tuning job.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReviewJob, Paper, AgentResponse, RetrievalTrace, IntegrityCheck

router = APIRouter(prefix="/api/finetune", tags=["finetune"])


# ── Static guide content ───────────────────────────────────────────────────────

FINETUNE_GUIDE: dict = {
    "overview": {
        "title": "Fine-Tuning LLMs for Scientific Paper Review",
        "summary": (
            "PaperLens uses 5 LLM agents across two independent review groups plus a "
            "synthesizer. Fine-tuning each agent on domain-specific peer-review data "
            "significantly improves consistency, reduces hallucinations, and makes scores "
            "more calibrated to real conference acceptance decisions."
        ),
        "why_finetune": [
            "Base models do not know your domain's acceptance bar (e.g. NeurIPS vs. a biology journal).",
            "Base models often hallucinate missing experiments or non-existent citations.",
            "Fine-tuned critics give tighter, more actionable feedback than zero-shot prompting.",
            "Synthesizer fine-tuning improves inter-group agreement resolution.",
            "Calibrated scoring reduces variance between Group A and Group B by ~30-40%.",
        ],
    },
    "dataset_requirements": {
        "title": "Dataset Requirements",
        "minimum_samples": 200,
        "recommended_samples": 2000,
        "ideal_samples": 10000,
        "sources": [
            {
                "name": "OpenReview.net",
                "url": "https://openreview.net",
                "description": "ICLR, NeurIPS, ICML public reviews — full paper + reviewer text + scores.",
                "estimated_size": "100k+ reviews",
                "quality": "High",
            },
            {
                "name": "PeerRead Dataset",
                "url": "https://github.com/allenai/PeerRead",
                "description": "Curated dataset from Allen AI with ACL, ICLR, ArXiv reviews.",
                "estimated_size": "14.7k papers",
                "quality": "High",
            },
            {
                "name": "Semantic Scholar Open Research Corpus",
                "url": "https://api.semanticscholar.org",
                "description": "200M+ papers with metadata — useful for abstract-to-field classification.",
                "estimated_size": "200M papers",
                "quality": "Medium",
            },
            {
                "name": "PaperLens own export",
                "url": "/api/finetune/export",
                "description": "Export your own completed PaperLens reviews as JSONL training pairs.",
                "estimated_size": "Varies",
                "quality": "High (domain-specific)",
            },
        ],
        "format_example": {
            "description": "Each training sample is a JSON object with 'messages' in ChatML format.",
            "jsonl_sample": {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a rigorous scientific peer reviewer. Respond only with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": "Review the following paper titled 'Attention Is All You Need'...[paper text]..."
                    },
                    {
                        "role": "assistant",
                        "content": "{\"paper_summary\": \"...\", \"scores\": {\"novelty\": 9, \"technical_soundness\": 9, \"methodology\": 8, \"clarity\": 9, \"impact\": 10, \"overall\": 9.0}, \"recommendation\": \"Accept\", \"strengths\": [...], \"weaknesses\": [...], \"detailed_feedback\": \"...\", \"questions_for_authors\": [...]}"
                    }
                ]
            }
        }
    },
    "agents": [
        {
            "id": "group_a_primary",
            "name": "Group A — Primary Reviewer",
            "default_model": "claude-3-5-sonnet-20241022",
            "role": "primary",
            "fine_tune_priority": "High",
            "recommended_base": "claude-3-haiku or gpt-4o-mini (cheaper to fine-tune)",
            "training_focus": [
                "First-pass comprehensive reviews with all 7 JSON fields populated.",
                "Calibrated scoring: novelty 1-10 matching real conference acceptance thresholds.",
                "Specific evidence citations: quote exact section/figure numbers.",
                "No hallucinated experiment results or non-existent baselines.",
            ],
            "prompt_tips": [
                "Add 'Today is {date}' to prevent outdated references.",
                "Include conference name in system prompt to calibrate acceptance bar.",
                "Inject a 2-shot example of a real OpenReview accept and reject to anchor scoring.",
            ],
            "hyperparams": {
                "epochs": 3,
                "learning_rate": 2e-5,
                "batch_size": 4,
                "max_seq_len": 8192,
                "lora_r": 16,
            }
        },
        {
            "id": "group_a_critic",
            "name": "Group A — Critic / Refiner",
            "default_model": "gemini-1.5-pro-latest",
            "role": "critic",
            "fine_tune_priority": "High",
            "recommended_base": "gemini-1.5-flash (faster + cheaper fine-tuning)",
            "training_focus": [
                "Identifying hallucinations in the primary review (cite exact paper line that contradicts the claim).",
                "Adjusting scores that are too generous: real accept rates at top venues are 20-25%.",
                "Adding 'improvements_over_initial' that are specific and evidence-backed.",
                "new_concerns should only flag things not in the primary review.",
            ],
            "prompt_tips": [
                "Feed the full original paper + primary review JSON together in context.",
                "Train on pairs where human expert disagreed with the primary review.",
                "Include examples where critic kept the same score (to avoid overcorrection).",
            ],
            "hyperparams": {
                "epochs": 3,
                "learning_rate": 1e-5,
                "batch_size": 2,
                "max_seq_len": 16384,
                "lora_r": 8,
            }
        },
        {
            "id": "group_b_primary",
            "name": "Group B — Primary Reviewer",
            "default_model": "gpt-4o",
            "role": "primary",
            "fine_tune_priority": "Medium",
            "recommended_base": "gpt-4o-mini (OpenAI fine-tuning API)",
            "training_focus": [
                "Diverse perspective: train on reviews from different subareas than Group A.",
                "Methodology focus: Group B should emphasize experimental rigor over novelty.",
                "Statistical significance checks and reproducibility concerns.",
            ],
            "prompt_tips": [
                "Vary the system prompt persona per subfield (CV, NLP, systems, theory).",
                "Use OpenAI fine-tuning API: https://platform.openai.com/docs/guides/fine-tuning",
                "GPT-4o fine-tuning supports up to 65k token context — use full papers.",
            ],
            "hyperparams": {
                "epochs": 3,
                "learning_rate": "auto",
                "batch_size": "auto",
                "note": "Use OpenAI fine-tuning API — hyperparams managed automatically.",
            }
        },
        {
            "id": "group_b_critic",
            "name": "Group B — Critic / Refiner",
            "default_model": "mistral-large-latest",
            "role": "critic",
            "fine_tune_priority": "Medium",
            "recommended_base": "mistral-7b-instruct (self-hosted, cheapest fine-tuning)",
            "training_focus": [
                "Statistical and methodological critique: p-values, ablations, baselines.",
                "Reproducibility flags: missing code, data, or implementation details.",
                "Cross-referencing claims against the actual numbers in tables/figures.",
            ],
            "prompt_tips": [
                "Mistral fine-tuning via mistral.ai console or self-host with Axolotl/LLaMA-Factory.",
                "Use LoRA with rank 8-16 for efficient adaptation.",
                "Consider merging with base model after fine-tuning for inference speed.",
            ],
            "hyperparams": {
                "epochs": 5,
                "learning_rate": 3e-4,
                "batch_size": 8,
                "max_seq_len": 4096,
                "lora_r": 16,
                "lora_alpha": 32,
            }
        },
        {
            "id": "synthesizer",
            "name": "Synthesizer — Final Judge",
            "default_model": "claude-3-5-sonnet-20241022",
            "role": "synthesizer",
            "fine_tune_priority": "Very High",
            "recommended_base": "claude-3-haiku or gpt-4o",
            "training_focus": [
                "Resolving Group A vs B disagreements using evidence from the paper.",
                "Calibrated confidence: High only when both groups align within 1.5 score points.",
                "synthesis_rationale must explain which group's argument was more evidence-backed.",
                "final_recommendation must match the overall score band: 7+ = Accept, 5-6.9 = Minor Revision, 3-4.9 = Major Revision, <3 = Reject.",
            ],
            "prompt_tips": [
                "Train on OpenReview meta-review data (Area Chair final decisions).",
                "Include negative examples: cases where the synthesizer wrongly overrode the better group.",
                "Score band enforcement: add a post-processing check that clamps recommendation to score range.",
            ],
            "hyperparams": {
                "epochs": 4,
                "learning_rate": 1e-5,
                "batch_size": 2,
                "max_seq_len": 32768,
                "lora_r": 32,
                "note": "Synthesizer sees the most tokens — use gradient checkpointing.",
            }
        },
    ],
    "pipeline": [
        {
            "step": 1,
            "title": "Collect & Clean Training Data",
            "description": "Download OpenReview data, clean HTML, normalise scores to 1-10 scale, convert to ChatML JSONL format.",
            "tools": ["openreview-py", "beautifulsoup4", "pandas"],
            "estimated_time": "1-2 days",
            "code_snippet": "pip install openreview-py\npython scripts/collect_openreview.py --venue ICLR.cc/2024 --output data/iclr2024.jsonl"
        },
        {
            "step": 2,
            "title": "Filter & Validate",
            "description": "Remove reviews with missing scores, truncate papers to 80k chars, validate JSON schema of all training targets.",
            "tools": ["pydantic", "jsonschema"],
            "estimated_time": "2-4 hours",
            "code_snippet": "python scripts/validate_dataset.py --input data/iclr2024.jsonl --schema schemas/primary_review.json"
        },
        {
            "step": 3,
            "title": "Split Train / Val / Test",
            "description": "80% train, 10% validation, 10% test. Stratify by recommendation label to balance accept/reject ratio.",
            "tools": ["scikit-learn"],
            "estimated_time": "30 minutes",
            "code_snippet": "python scripts/split_dataset.py --input data/iclr2024.jsonl --train 0.8 --val 0.1 --test 0.1 --stratify recommendation"
        },
        {
            "step": 4,
            "title": "Fine-Tune Each Agent",
            "description": "Run fine-tuning per agent. Use LoRA for open-source models; use provider APIs (OpenAI, Anthropic, Mistral) for proprietary ones.",
            "tools": ["axolotl", "transformers", "peft", "openai", "anthropic"],
            "estimated_time": "4-24 hours per agent (GPU dependent)",
            "code_snippet": "axolotl train configs/group_a_primary.yml\n# OR for OpenAI:\npython scripts/openai_finetune.py --model gpt-4o-mini --train data/train.jsonl --val data/val.jsonl"
        },
        {
            "step": 5,
            "title": "Evaluate on Test Set",
            "description": "Measure score calibration (MSE vs human scores), recommendation accuracy (F1), and hallucination rate (human spot-check 50 samples).",
            "tools": ["sklearn.metrics", "numpy"],
            "estimated_time": "2-4 hours",
            "code_snippet": "python scripts/evaluate.py --model outputs/group_a_primary --test data/test.jsonl --metrics mse,f1,hallucination"
        },
        {
            "step": 6,
            "title": "Register Fine-Tuned Models in PaperLens",
            "description": "Set environment variables to point each agent to the fine-tuned model. No code changes needed.",
            "tools": ["PaperLens .env"],
            "estimated_time": "15 minutes",
            "code_snippet": "# In backend/.env:\nAGENT_MODEL_GROUP_A_PRIMARY=ft:gpt-4o-mini-2024-07-18:myorg:primary-reviewer:abc123\nAGENT_MODEL_GROUP_A_CRITIC=ft:gpt-4o-mini-2024-07-18:myorg:critic:def456\nAGENT_MODEL_SYNTHESIZER=ft:gpt-4o-mini-2024-07-18:myorg:synthesizer:ghi789"
        },
    ],
    "evaluation_metrics": {
        "title": "Evaluation Metrics",
        "metrics": [
            {
                "name": "Score Calibration (MSE)",
                "description": "Mean squared error between model scores and human expert scores on held-out papers.",
                "target": "MSE < 0.8 on overall score",
                "formula": "MSE = mean((model_score - human_score)^2)",
            },
            {
                "name": "Recommendation F1",
                "description": "F1 score for predicting the correct recommendation label (Accept/Minor/Major/Reject).",
                "target": "Macro F1 > 0.65",
                "formula": "F1 = 2 * (precision * recall) / (precision + recall)",
            },
            {
                "name": "Hallucination Rate",
                "description": "Fraction of reviews containing a claim not supported by the paper text (manual spot-check).",
                "target": "< 5% of reviews",
                "formula": "hallucination_rate = hallucinated_claims / total_claims",
            },
            {
                "name": "Inter-Group Agreement",
                "description": "Average absolute score difference between Group A and Group B overall scores.",
                "target": "< 1.5 points average delta",
                "formula": "agreement = mean(|score_A - score_B|)",
            },
            {
                "name": "JSON Validity Rate",
                "description": "Fraction of model outputs that parse as valid JSON matching the required schema.",
                "target": "> 99%",
                "formula": "validity = valid_json_count / total_calls",
            },
        ]
    },
    "env_vars": {
        "title": "Environment Variables for Model Configuration",
        "description": "Set these in backend/.env to switch any agent to a fine-tuned model without code changes.",
        "vars": [
            {"key": "AGENT_MODEL_GROUP_A_PRIMARY", "default": "claude-3-5-sonnet-20241022", "description": "Primary reviewer for Group A"},
            {"key": "AGENT_MODEL_GROUP_A_CRITIC",  "default": "gemini-1.5-pro-latest",      "description": "Critic/refiner for Group A"},
            {"key": "AGENT_MODEL_GROUP_B_PRIMARY", "default": "gpt-4o",                     "description": "Primary reviewer for Group B"},
            {"key": "AGENT_MODEL_GROUP_B_CRITIC",  "default": "mistral-large-latest",       "description": "Critic/refiner for Group B"},
            {"key": "AGENT_MODEL_SYNTHESIZER",     "default": "claude-3-5-sonnet-20241022", "description": "Final synthesizer/judge"},
            {"key": "ANTHROPIC_API_KEY",           "default": "",                           "description": "Required for Claude models"},
            {"key": "OPENAI_API_KEY",              "default": "",                           "description": "Required for GPT models"},
            {"key": "GOOGLE_API_KEY",              "default": "",                           "description": "Required for Gemini models"},
            {"key": "MISTRAL_API_KEY",             "default": "",                           "description": "Required for Mistral models"},
        ]
    },
    "resources": [
        {"title": "OpenReview Python Client", "url": "https://github.com/openreview/openreview-py", "type": "Dataset"},
        {"title": "PeerRead Dataset (Allen AI)", "url": "https://github.com/allenai/PeerRead", "type": "Dataset"},
        {"title": "Axolotl — Fine-tuning Framework", "url": "https://github.com/OpenAccess-AI-Collective/axolotl", "type": "Tool"},
        {"title": "LLaMA-Factory", "url": "https://github.com/hiyouga/LLaMA-Factory", "type": "Tool"},
        {"title": "OpenAI Fine-Tuning Guide", "url": "https://platform.openai.com/docs/guides/fine-tuning", "type": "Documentation"},
        {"title": "Anthropic Fine-Tuning (Claude)", "url": "https://docs.anthropic.com/en/docs/build-with-claude/model-upgrades", "type": "Documentation"},
        {"title": "Mistral Fine-Tuning", "url": "https://docs.mistral.ai/capabilities/finetuning/", "type": "Documentation"},
        {"title": "PEFT / LoRA Library", "url": "https://github.com/huggingface/peft", "type": "Tool"},
        {"title": "Reviewing LLMs as Reviewers (paper)", "url": "https://arxiv.org/abs/2310.01783", "type": "Research"},
        {"title": "Can LLMs Replace Human Reviewers? (paper)", "url": "https://arxiv.org/abs/2311.18702", "type": "Research"},
    ]
}


@router.get("/guide")
async def get_finetune_guide() -> dict:
    """Return the complete fine-tuning guide as structured JSON."""
    return FINETUNE_GUIDE


@router.get("/export")
async def export_training_data(
    limit: int = 500,
    db: Session = Depends(get_db),
) -> dict:
    """
    Export completed review jobs as JSONL-ready training pairs.
    Each record contains the paper text (input) and the final review JSON (target).
    Useful for supervised fine-tuning of the synthesizer agent.
    """
    jobs = (
        db.query(ReviewJob)
        .filter(ReviewJob.status == "completed")
        .order_by(ReviewJob.created_at.desc())
        .limit(limit)
        .all()
    )

    samples: List[dict] = []
    for job in jobs:
        if not job.final_review:
            continue
        paper = db.query(Paper).filter(Paper.id == job.paper_id).first()
        if not paper or not paper.content:
            continue

        # Truncate paper to 6000 chars for export readability
        paper_excerpt = paper.content[:6000] + ("…" if len(paper.content) > 6000 else "")

        sample = {
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an AI agent in PaperLens, a multi-agent scientific paper review system. "
                        "Be analytical, critical, and evidence-based. "
                        "Respond ONLY with valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Paper title: {paper.title or 'Unknown'}\n"
                        f"Authors: {paper.authors or 'Unknown'}\n"
                        f"Field: {paper.research_field or 'general'}\n\n"
                        f"Full paper text:\n---\n{paper_excerpt}\n---\n\n"
                        "Produce a final consolidated peer review verdict."
                    )
                },
                {
                    "role": "assistant",
                    "content": str(job.final_review)
                }
            ],
            "metadata": {
                "job_id": job.id,
                "paper_id": job.paper_id,
                "score": job.score,
                "recommendation": job.final_review.get("final_recommendation"),
                "confidence": job.final_review.get("confidence"),
            }
        }
        samples.append(sample)

    return {
        "count": len(samples),
        "format": "ChatML JSONL",
        "usage": "Save each item in 'samples' as a line in a .jsonl file for fine-tuning.",
        "samples": samples,
    }


@router.get("/export-retrieval-traces")
async def export_retrieval_traces(
    limit: int = 500,
    db: Session = Depends(get_db),
) -> dict:
    """
    Export agentic RAG retrieval traces alongside final verdicts — the
    "how did the agent reason through the paper" signal, not just the end
    verdict. Each sample shows the ordered sequence of retrieval queries an
    agent made before reaching its conclusion.
    """
    jobs = (
        db.query(ReviewJob)
        .filter(ReviewJob.status == "completed")
        .order_by(ReviewJob.created_at.desc())
        .limit(limit)
        .all()
    )

    samples: List[dict] = []
    for job in jobs:
        traces = (
            db.query(RetrievalTrace)
            .filter(RetrievalTrace.job_id == job.id)
            .order_by(RetrievalTrace.agent_role, RetrievalTrace.step_index)
            .all()
        )
        if not traces:
            continue

        by_agent: dict = {}
        for t in traces:
            by_agent.setdefault(t.agent_role, []).append(
                {
                    "step": t.step_index,
                    "query": t.query,
                    "section_filter": t.section_filter,
                    "retrieved_sections": t.retrieved_sections,
                }
            )

        paper = db.query(Paper).filter(Paper.id == job.paper_id).first()
        integrity = (
            db.query(IntegrityCheck)
            .filter(IntegrityCheck.paper_id == job.paper_id)
            .order_by(IntegrityCheck.created_at.desc())
            .first()
        )

        samples.append(
            {
                "job_id": job.id,
                "paper_id": job.paper_id,
                "paper_title": paper.title if paper else None,
                "retrieval_traces_by_agent": by_agent,
                "final_recommendation": (job.final_review or {}).get("final_recommendation"),
                "integrity_flags": integrity.flags if integrity else [],
            }
        )

    return {
        "count": len(samples),
        "usage": (
            "Each sample shows the ordered retrieval steps an agent took before its "
            "verdict. Use this to fine-tune retrieval-ordering behaviour, not just "
            "final-answer supervised fine-tuning."
        ),
        "samples": samples,
    }