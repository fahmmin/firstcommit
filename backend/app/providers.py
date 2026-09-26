"""B2 — one seam for every model call: chat agents, embeddings, text, vision.

Before this, Bedrock was hard-wired in four places (make_model, Titan embeddings,
document auto-tag, invoice vision). Now:

    MODEL_PROVIDER = bedrock | anthropic | openai | ollama | litellm | mock
    EMBED_PROVIDER = titan | openai | ollama | none

Defaults keep today's behaviour exactly: USE_AWS=1 → bedrock + titan,
USE_AWS=0 → mock + none (keyword-only retrieval).

- Chat agents use Strands' own provider classes. Their SDKs are optional
  (requirements-providers.txt — kept out of the Lambda zip); a missing SDK or
  API key raises ProviderUnavailable with the exact fix, never an ImportError
  at import time.
- One-shot calls (embed / complete_text / complete_vision) use plain REST via
  httpx (already a dependency), so they work without any optional SDK.
- Every embedding is tagged with the model that made it (embed_model_id), so
  retrieval never compares vectors from two different models (a silent
  cosine=0 before — see retrieval.py).

Model ids: Bedrock keeps ORCHESTRATOR_MODEL / WORKER_MODEL / EMBED_MODEL. Other
providers read <PROVIDER>_ORCHESTRATOR_MODEL / <PROVIDER>_WORKER_MODEL /
<PROVIDER>_EMBED_MODEL, with sensible defaults below.
"""
from __future__ import annotations

import base64
import json
import os

CHAT_PROVIDERS = ("bedrock", "anthropic", "openai", "ollama", "litellm", "mock")
EMBED_PROVIDERS = ("titan", "openai", "ollama", "none")

_DEFAULT_MODELS = {
    "anthropic": {"orchestrator": "claude-sonnet-5", "worker": "claude-haiku-4-5-20251001"},
    "openai": {"orchestrator": "gpt-4.1", "worker": "gpt-4.1-mini"},
    "ollama": {"orchestrator": "llama3.1", "worker": "llama3.1"},
    "litellm": {"orchestrator": "anthropic/claude-sonnet-5", "worker": "anthropic/claude-haiku-4-5-20251001"},
}
_DEFAULT_EMBED = {"titan": "amazon.titan-embed-text-v2:0", "openai": "text-embedding-3-small",
                  "ollama": "nomic-embed-text"}
_KEYS = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY"}


class ProviderUnavailable(RuntimeError):
    """A configured provider can't run — the message says how to fix it."""


def _aws_on() -> bool:
    return os.getenv("USE_AWS", "0") == "1"


def chat_provider() -> str:
    p = (os.getenv("MODEL_PROVIDER") or "").strip().lower()
    if p:
        if p not in CHAT_PROVIDERS:
            raise ProviderUnavailable(f"MODEL_PROVIDER={p} — choose one of {', '.join(CHAT_PROVIDERS)}")
        return p
    if _aws_on():
        from .models import _aws_creds_available
        return "bedrock" if _aws_creds_available() else "mock"
    return "mock"


def embed_provider() -> str:
    p = (os.getenv("EMBED_PROVIDER") or "").strip().lower()
    if p:
        if p not in EMBED_PROVIDERS:
            raise ProviderUnavailable(f"EMBED_PROVIDER={p} — choose one of {', '.join(EMBED_PROVIDERS)}")
        return p
    return "titan" if _aws_on() else "none"


def _tier(role: str) -> str:
    return "orchestrator" if role in ("orchestrator", "factory") else "worker"


def model_id(role: str = "worker", provider: str | None = None) -> str:
    p = provider or chat_provider()
    t = _tier(role)
    if p == "bedrock":
        return os.getenv("ORCHESTRATOR_MODEL" if t == "orchestrator" else "WORKER_MODEL",
                         "apac.amazon.nova-lite-v1:0")
    if p == "mock":
        return "mock"
    return os.getenv(f"{p.upper()}_{t.upper()}_MODEL", _DEFAULT_MODELS[p][t])


def embed_model_id(provider: str | None = None) -> str | None:
    p = provider or embed_provider()
    if p == "none":
        return None
    if p == "titan":
        return os.getenv("EMBED_MODEL", _DEFAULT_EMBED["titan"])
    return os.getenv(f"{p.upper()}_EMBED_MODEL", _DEFAULT_EMBED[p])


def _key(p: str) -> str:
    k = os.getenv(_KEYS[p], "")
    if not k:
        raise ProviderUnavailable(f"MODEL_PROVIDER={p} needs {_KEYS[p]} in the environment")
    return k


def _need_sdk(p: str, exc: Exception):
    raise ProviderUnavailable(
        f"MODEL_PROVIDER={p} needs its SDK — pip install -r requirements-providers.txt ({exc})") from exc


def _ollama_host() -> str:
    return os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")


# ---------------- chat agents (Strands providers) ----------------

def make_chat_model(role: str = "worker", rules=None, fallback: str | None = None):
    p = chat_provider()
    mid = model_id(role, p)
    if p == "mock":
        from .models import MockModel
        return MockModel(rules or [], fallback=fallback)
    if p == "bedrock":
        from strands.models import BedrockModel
        return BedrockModel(model_id=mid, temperature=0)
    if p == "anthropic":
        try:
            from strands.models.anthropic import AnthropicModel
        except ImportError as e:
            _need_sdk(p, e)
        return AnthropicModel(client_args={"api_key": _key(p)}, model_id=mid,
                              max_tokens=int(os.getenv("MAX_TOKENS", "2048")), params={"temperature": 0})
    if p == "openai":
        try:
            from strands.models.openai import OpenAIModel
        except ImportError as e:
            _need_sdk(p, e)
        return OpenAIModel(client_args={"api_key": _key(p)}, model_id=mid, params={"temperature": 0})
    if p == "ollama":
        try:
            from strands.models.ollama import OllamaModel
        except ImportError as e:
            _need_sdk(p, e)
        return OllamaModel(host=_ollama_host(), model_id=mid, temperature=0)
    if p == "litellm":
        try:
            from strands.models.litellm import LiteLLMModel
        except ImportError as e:
            _need_sdk(p, e)
        return LiteLLMModel(model_id=mid, params={"temperature": 0})
    raise ProviderUnavailable(f"unknown provider {p}")


# ---------------- REST helpers (no SDK needed) ----------------

def _post(url: str, payload: dict, headers: dict | None = None, timeout: float = 60) -> dict:
    import httpx
    r = httpx.post(url, json=payload, headers=headers or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _bedrock():
    import boto3
    session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                            region_name=os.getenv("AWS_REGION", "us-east-1"))
    return session.client("bedrock-runtime")


# ---------------- embeddings ----------------

def embed(texts: list[str]) -> tuple[list[list[float]] | None, str | None]:
    """→ (vectors, model_id). (None, None) when embeddings are off or fail —
    callers fall back to keyword retrieval, never to a fake vector."""
    p = embed_provider()
    mid = embed_model_id(p)
    texts = [t[:8000] for t in texts if t]
    if p == "none" or not texts:
        return None, None
    try:
        if p == "titan":
            c = _bedrock()
            vecs = [json.loads(c.invoke_model(modelId=mid, body=json.dumps({"inputText": t}))["body"].read())["embedding"]
                    for t in texts]
        elif p == "openai":
            data = _post("https://api.openai.com/v1/embeddings", {"model": mid, "input": texts},
                         {"Authorization": f"Bearer {_key('openai')}"})
            vecs = [d["embedding"] for d in sorted(data["data"], key=lambda d: d["index"])]
        elif p == "ollama":
            vecs = _post(f"{_ollama_host()}/api/embed", {"model": mid, "input": texts})["embeddings"]
        else:
            return None, None
        return vecs, mid
    except Exception as e:
        print(f"[providers] {p} embed failed ({type(e).__name__}): {e}")
        return None, None


def embed_one(text: str) -> list[float] | None:
    vecs, _ = embed([text])
    return vecs[0] if vecs else None


# ---------------- one-shot text / vision ----------------

def complete_text(prompt: str, role: str = "worker") -> str | None:
    """Single-turn completion (auto-tagging etc.). None offline/on failure."""
    p = chat_provider()
    if p == "mock":
        return None
    mid = model_id(role, p)
    try:
        if p == "bedrock":
            resp = _bedrock().converse(modelId=mid, messages=[{"role": "user", "content": [{"text": prompt}]}])
            return resp["output"]["message"]["content"][0]["text"]
        if p == "anthropic":
            d = _post("https://api.anthropic.com/v1/messages",
                      {"model": mid, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]},
                      {"x-api-key": _key(p), "anthropic-version": "2023-06-01"})
            return "".join(b.get("text", "") for b in d.get("content", []))
        if p == "openai":
            d = _post("https://api.openai.com/v1/chat/completions",
                      {"model": mid, "messages": [{"role": "user", "content": prompt}]},
                      {"Authorization": f"Bearer {_key(p)}"})
            return d["choices"][0]["message"]["content"]
        if p == "ollama":
            return _post(f"{_ollama_host()}/api/generate", {"model": mid, "prompt": prompt, "stream": False})["response"]
        # litellm: agents only (its REST surface depends on the proxy) → heuristic fallback
    except ProviderUnavailable:
        raise
    except Exception as e:
        print(f"[providers] {p} complete_text failed ({type(e).__name__}): {e}")
    return None


def vision_available() -> bool:
    return chat_provider() in ("bedrock", "anthropic", "openai", "ollama")


def complete_vision(image: bytes, fmt: str, prompt: str) -> str:
    """Image + prompt → text. Raises on failure (callers fall back)."""
    p = chat_provider()
    mid = model_id("worker", p)
    b64 = base64.b64encode(image).decode()
    if p == "bedrock":
        resp = _bedrock().converse(modelId=mid, messages=[{"role": "user", "content": [
            {"image": {"format": fmt, "source": {"bytes": image}}}, {"text": prompt}]}])
        return resp["output"]["message"]["content"][0]["text"]
    if p == "anthropic":
        d = _post("https://api.anthropic.com/v1/messages", {"model": mid, "max_tokens": 1024, "messages": [
            {"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": f"image/{fmt}", "data": b64}},
                {"type": "text", "text": prompt}]}]},
            {"x-api-key": _key(p), "anthropic-version": "2023-06-01"})
        return "".join(b.get("text", "") for b in d.get("content", []))
    if p == "openai":
        d = _post("https://api.openai.com/v1/chat/completions", {"model": mid, "messages": [
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/{fmt};base64,{b64}"}}]}]},
            {"Authorization": f"Bearer {_key(p)}"})
        return d["choices"][0]["message"]["content"]
    if p == "ollama":
        return _post(f"{_ollama_host()}/api/generate", {"model": os.getenv("OLLAMA_VISION_MODEL", "llava"),
                                                        "prompt": prompt, "images": [b64], "stream": False})["response"]
    raise ProviderUnavailable(f"{p} has no vision support here")


# ---------------- status (for /health) ----------------

def status() -> dict:
    """What's actually configured — /health reports this instead of a hardcoded label."""
    out = {}
    try:
        p = chat_provider()
        out.update(provider=p, orchestrator_model=model_id("orchestrator", p), worker_model=model_id("worker", p))
        if p in _KEYS and not os.getenv(_KEYS[p]):
            out["provider_error"] = f"{_KEYS[p]} not set"
    except ProviderUnavailable as e:
        out.update(provider="invalid", provider_error=str(e))
    try:
        ep = embed_provider()
        out.update(embed_provider=ep, embed_model=embed_model_id(ep))
    except ProviderUnavailable as e:
        out.update(embed_provider="invalid", embed_error=str(e))
    return out
