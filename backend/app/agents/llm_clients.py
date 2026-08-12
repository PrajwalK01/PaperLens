"""
LLM client factory.

Supports: Anthropic Claude, OpenAI GPT-4o, Google Gemini, Mistral.
Model assigned to each agent role is read from environment variables;
callers may also pass an explicit model string to override.

Environment variables:
  AGENT_MODEL_GROUP_A_PRIMARY    default: claude-3-5-sonnet-20241022
  AGENT_MODEL_GROUP_A_CRITIC     default: gemini-2.5-flash
  AGENT_MODEL_GROUP_B_PRIMARY    default: gpt-4o
  AGENT_MODEL_GROUP_B_CRITIC     default: mistral-large-latest
  AGENT_MODEL_SYNTHESIZER        default: claude-3-5-sonnet-20241022

  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  GOOGLE_API_KEY
  MISTRAL_API_KEY
"""

from __future__ import annotations

import os
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Default model names ────────────────────────────────────────────────────────
DEFAULTS = {
    "group_a_primary": os.getenv("AGENT_MODEL_GROUP_A_PRIMARY", "claude-3-5-sonnet-20241022"),
    "group_a_critic":  os.getenv("AGENT_MODEL_GROUP_A_CRITIC",  "gemini-2.5-flash"),
    "group_b_primary": os.getenv("AGENT_MODEL_GROUP_B_PRIMARY", "gpt-4o"),
    "group_b_critic":  os.getenv("AGENT_MODEL_GROUP_B_CRITIC",  "mistral-large-latest"),
    "synthesizer":     os.getenv("AGENT_MODEL_SYNTHESIZER",     "claude-3-5-sonnet-20241022"),
}


# ── Fallback chain for free-tier resilience ────────────────────────────────────
# If a role's assigned provider fails (rate limit, outage, deleted free model),
# get_model_for_role_with_fallback() tries the next provider in this order
# instead of failing the whole node. Only used when explicitly called — normal
# get_model_for_role() behavior (used by run_review) is unchanged so existing
# code isn't affected.
FALLBACK_CHAIN = [
    os.getenv("FALLBACK_MODEL_1", "gemini-2.5-flash"),   # Google AI Studio free tier
    os.getenv("FALLBACK_MODEL_2", "llama-3.3-70b-versatile"),  # Groq free tier (if wired)
    os.getenv("FALLBACK_MODEL_3", "ollama:llama3.1"),    # local, always available if Ollama is running
]


def _provider_from_model(model: str) -> str:
    """Infer provider from model name string."""
    model_lower = model.lower()
    if model_lower.startswith("nvidia:"):
        return "nvidia"
    if "claude" in model_lower:
        return "anthropic"
    if "gpt" in model_lower or "o1" in model_lower or "o3" in model_lower:
        return "openai"
    if "gemini" in model_lower:
        return "google"
    if "mistral" in model_lower or "mixtral" in model_lower:
        return "mistral"
    if "llama-3.3-70b-versatile" in model_lower or "llama-3.1-8b-instant" in model_lower or model_lower.startswith("groq:"):
        return "groq"
    if "ollama:" in model_lower or "llama3" in model_lower or "qwen" in model_lower:
        return "ollama"
    if "grok" in model_lower:
        return "xai"
    if "glm" in model_lower:
        return "zai"
    if "freellm:" in model_lower:
        return "freellm"
    raise ValueError(f"Cannot infer provider from model name: {model!r}")


def get_model_for_role(role: str, override: Optional[str] = None) -> Any:
    """
    Return a LangChain ChatModel instance for the given agent role.

    :param role: one of the keys in DEFAULTS
    :param override: explicit model string that overrides the env-var default
    """
    model_name = override or DEFAULTS.get(role)
    if not model_name:
        raise ValueError(f"Unknown agent role: {role!r}")

    provider = _provider_from_model(model_name)
    logger.info("Creating LLM client: role=%s  model=%s  provider=%s", role, model_name, provider)

    if provider == "nvidia":
        # NVIDIA NIM — OpenAI-compatible endpoint
        # Each model has its own API key stored separately
        actual_model = model_name.replace("nvidia:", "")
        # Pick the right key based on model
        if "ultra" in actual_model or "550b" in actual_model:
            api_key = os.environ.get("NVIDIA_API_KEY_ULTRA", "")
        elif "glm" in actual_model or "z-ai" in actual_model:
            api_key = os.environ.get("NVIDIA_API_KEY_REASON", "")
        else:
            api_key = os.environ.get("NVIDIA_API_KEY_FAST", "")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=actual_model,
            api_key=api_key,
            base_url="https://integrate.api.nvidia.com/v1",
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model_name,
            api_key=os.environ["ANTHROPIC_API_KEY"],
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name,
            api_key=os.environ["OPENAI_API_KEY"],
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=os.environ["GOOGLE_API_KEY"],
            max_output_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "mistral":
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(
            model=model_name,
            api_key=os.environ["MISTRAL_API_KEY"],
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "xai":
        # xAI Grok via OpenAI-compatible API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name,
            api_key=os.environ.get("XAI_API_KEY", ""),
            base_url="https://api.x.ai/v1",
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "zai":
        # Z.ai (ZhipuAI international) via OpenAI-compatible API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name,
            api_key=os.environ.get("ZAI_API_KEY", ""),
            base_url="https://api.z.ai/api/paas/v4",
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "groq":
        # Groq's free tier — OpenAI-compatible endpoint, fast, generous daily limit
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name.replace("groq:", ""),
            api_key=os.environ.get("GROQ_API_KEY", ""),
            base_url="https://api.groq.com/openai/v1",
            max_tokens=4096,
            timeout=120,
        ), model_name

    if provider == "ollama":
        return _SimpleOllamaClient(
            model=model_name.replace("ollama:", ""),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        ), model_name

    if provider == "freellm":
        # freellmapi (or any self-hosted OpenAI-compatible free-tier aggregator).
        # Set FREELLM_BASE_URL to wherever the proxy is running, e.g.
        # http://localhost:8000/v1 for a locally-run freellmapi instance.
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name.replace("freellm:", ""),
            api_key=os.environ.get("FREELLM_API_KEY", "not-needed"),
            base_url=os.getenv("FREELLM_BASE_URL", "http://localhost:8000/v1"),
            max_tokens=4096,
            timeout=120,
        ), model_name

    raise ValueError(f"Unsupported provider: {provider!r}")


class _SimpleOllamaResponse:
    """Mimics the .content attribute LangChain chat responses have."""
    def __init__(self, content: str):
        self.content = content


class _SimpleOllamaClient:
    """
    Minimal drop-in replacement for a LangChain ChatModel, backed directly by
    the `ollama` python package (no langchain-ollama / langchain-core bump
    required, so it won't conflict with the other providers' pinned versions).

    Only implements what orchestrator.py actually calls: .invoke(messages)
    where messages is a list of langchain_core SystemMessage/HumanMessage.
    """
    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url

    def invoke(self, messages) -> _SimpleOllamaResponse:
        import ollama

        client = ollama.Client(host=self.base_url)

        ollama_messages = []
        for m in messages:
            role = "system" if m.__class__.__name__ == "SystemMessage" else "user"
            ollama_messages.append({"role": role, "content": m.content})

        response = client.chat(model=self.model, messages=ollama_messages)
        return _SimpleOllamaResponse(response["message"]["content"])


# Public alias — orchestrator.py uses this to decide whether a role's model
# supports tool-calling (bind_tools) before attempting the agentic RAG loop.
provider_from_model = _provider_from_model


def get_model_for_role_with_fallback(role: str, override: Optional[str] = None) -> tuple:
    """
    Same as get_model_for_role(), but if the assigned/override model's client
    construction fails outright (e.g. missing key) it walks FALLBACK_CHAIN and
    returns the first one that constructs successfully. This does NOT catch
    failures during actual .invoke() calls (that's handled by the retry logic
    in orchestrator.py) — it only protects against a role being configured for
    a provider you don't actually have a working key for.
    """
    candidates = [override or DEFAULTS.get(role)] + FALLBACK_CHAIN
    last_exc: Optional[Exception] = None
    for candidate in candidates:
        if not candidate:
            continue
        try:
            llm, model_name = get_model_for_role(role, candidate)
            return llm, model_name
        except Exception as exc:
            last_exc = exc
            logger.warning("Model candidate %r failed to construct for role=%s: %s", candidate, role, exc)
            continue
    raise RuntimeError(f"No working model found for role={role} after trying {candidates}") from last_exc