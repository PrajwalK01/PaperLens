"""
Approximate cost estimation for PaperLens LLM calls.

HONEST CAVEAT: prices below are approximate, manually maintained, and WILL
go stale — providers change pricing without notice. Treat dashboard cost
figures as directional ("Claude calls cost roughly 4x what Gemini Flash
calls do"), not as accounting-grade numbers. Update PRICING_PER_1K_TOKENS
when you notice it's drifted from reality.

Token counts themselves are best-effort: LangChain's newer chat models
expose `.usage_metadata` (input_tokens/output_tokens) on the AIMessage
response for most providers, but not all (notably: the local Ollama
client here doesn't report usage at all — its calls are logged with
estimated tokens via a cheap chars/4 heuristic instead, clearly flagged
as such in the output).
"""

from __future__ import annotations

from typing import Any, Dict, Optional, TypedDict

# USD per 1,000 tokens — (input_price, output_price). Approximate, as of
# this module's last update. Ollama/local models are $0 by definition.
PRICING_PER_1K_TOKENS: Dict[str, tuple] = {
    "claude": (0.003, 0.015),        # Claude Sonnet-class, approx
    "openai": (0.0025, 0.010),       # GPT-4o-class, approx
    "google": (0.000075, 0.0003),    # Gemini Flash free/low tier, approx
    "mistral": (0.002, 0.006),       # Mistral Large-class, approx
    "groq": (0.0, 0.0),              # free tier as of writing
    "xai": (0.002, 0.010),           # approx
    "zai": (0.001, 0.003),           # approx
    "ollama": (0.0, 0.0),            # local — genuinely free
}


class UsageEstimate(TypedDict):
    input_tokens: int
    output_tokens: int
    tokens_are_estimated: bool  # True if we fell back to the char-count heuristic
    estimated_cost_usd: float
    provider: str


def _char_count_to_tokens(char_count: int) -> int:
    """Cheap fallback when a provider doesn't report real token usage. ~4 chars/token for English."""
    return max(1, char_count // 4)


def extract_usage_from_response(response: Any, provider: str, fallback_char_count: int = 0) -> UsageEstimate:
    """
    Pull real token usage off a LangChain response object if available,
    otherwise fall back to a char-count estimate (flagged as such).
    """
    usage_meta = getattr(response, "usage_metadata", None)
    if usage_meta and isinstance(usage_meta, dict):
        input_tokens = usage_meta.get("input_tokens", 0)
        output_tokens = usage_meta.get("output_tokens", 0)
        estimated = False
    else:
        # response_metadata is the older/alternate location some providers use
        resp_meta = getattr(response, "response_metadata", {}) or {}
        token_usage = resp_meta.get("token_usage") or resp_meta.get("usage") or {}
        input_tokens = token_usage.get("prompt_tokens") or token_usage.get("input_tokens") or 0
        output_tokens = token_usage.get("completion_tokens") or token_usage.get("output_tokens") or 0
        estimated = not (input_tokens or output_tokens)
        if estimated:
            # nothing reported at all — fall back to char-count heuristic
            output_text = getattr(response, "content", "") or ""
            input_tokens = _char_count_to_tokens(fallback_char_count)
            output_tokens = _char_count_to_tokens(len(output_text))

    cost = estimate_cost(provider, input_tokens, output_tokens)
    return UsageEstimate(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        tokens_are_estimated=estimated,
        estimated_cost_usd=round(cost, 6),
        provider=provider,
    )


def estimate_cost(provider: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = PRICING_PER_1K_TOKENS.get(provider, (0.0, 0.0))
    return (input_tokens / 1000.0) * in_rate + (output_tokens / 1000.0) * out_rate
