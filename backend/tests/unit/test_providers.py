"""B2 — provider seam: dispatch, clear failures, REST shapes, embedding safety, pricing.

No real keys needed: SDK classes are faked via sys.modules and the REST layer
(providers._post) is monkeypatched, so request shapes are asserted exactly.
"""
import sys
import types

import pytest

from app import deps, providers, tracing
from app.tools import retrieval


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for k in ("MODEL_PROVIDER", "EMBED_PROVIDER", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
              "ANTHROPIC_WORKER_MODEL", "OPENAI_EMBED_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("USE_AWS", "0")


def _fake_sdk(monkeypatch, modname, clsname):
    seen = {}

    class Fake:
        def __init__(self, *a, **kw):
            seen.update(kw, args=a)
    mod = types.ModuleType(modname)
    setattr(mod, clsname, Fake)
    monkeypatch.setitem(sys.modules, modname, mod)
    return seen


def test_defaults_preserve_todays_behaviour():
    assert providers.chat_provider() == "mock" and providers.embed_provider() == "none"
    from app.models import MockModel, make_model
    assert isinstance(make_model([], role="worker"), MockModel)


def test_invalid_provider_is_a_clear_error(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "skynet")
    with pytest.raises(providers.ProviderUnavailable, match="choose one of"):
        providers.chat_provider()


def test_anthropic_dispatch_with_key(monkeypatch):
    seen = _fake_sdk(monkeypatch, "strands.models.anthropic", "AnthropicModel")
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    providers.make_chat_model(role="orchestrator")
    assert seen["client_args"] == {"api_key": "sk-test"}
    assert seen["model_id"] == "claude-sonnet-5" and seen["max_tokens"] > 0
    monkeypatch.setenv("ANTHROPIC_WORKER_MODEL", "claude-custom")
    providers.make_chat_model(role="worker")
    assert seen["model_id"] == "claude-custom"


def test_missing_key_or_sdk_says_how_to_fix(monkeypatch):
    _fake_sdk(monkeypatch, "strands.models.openai", "OpenAIModel")
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    with pytest.raises(providers.ProviderUnavailable, match="OPENAI_API_KEY"):
        providers.make_chat_model()
    monkeypatch.setitem(sys.modules, "strands.models.ollama", None)   # SDK "not installed"
    monkeypatch.setenv("MODEL_PROVIDER", "ollama")
    with pytest.raises(providers.ProviderUnavailable, match="requirements-providers.txt"):
        providers.make_chat_model()


def test_openai_embeddings_rest_shape(monkeypatch):
    monkeypatch.setenv("EMBED_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-o")
    calls = []

    def fake_post(url, payload, headers=None, timeout=60):
        calls.append((url, payload, headers))
        return {"data": [{"index": 1, "embedding": [0, 1]}, {"index": 0, "embedding": [1, 0]}]}
    monkeypatch.setattr(providers, "_post", fake_post)
    vecs, mid = providers.embed(["a", "b"])
    assert mid == "text-embedding-3-small" and vecs == [[1, 0], [0, 1]]   # re-ordered by index
    url, payload, headers = calls[0]
    assert url.endswith("/v1/embeddings") and payload["input"] == ["a", "b"]
    assert headers["Authorization"] == "Bearer sk-o"


def test_embed_failure_returns_none_not_fake_vectors(monkeypatch):
    monkeypatch.setenv("EMBED_PROVIDER", "ollama")
    monkeypatch.setattr(providers, "_post", lambda *a, **k: (_ for _ in ()).throw(OSError("down")))
    assert providers.embed(["x"]) == (None, None)


def test_complete_text_and_vision_rest_shapes(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-a")
    sent = {}

    def fake_post(url, payload, headers=None, timeout=60):
        sent.update(url=url, payload=payload, headers=headers)
        return {"content": [{"type": "text", "text": '{"tags":["tax"]}'}]}
    monkeypatch.setattr(providers, "_post", fake_post)
    assert providers.complete_text("classify") == '{"tags":["tax"]}'
    assert sent["headers"]["anthropic-version"] and sent["payload"]["messages"][0]["content"] == "classify"
    providers.complete_vision(b"\x89PNG....", "png", "extract")
    img = sent["payload"]["messages"][0]["content"][0]
    assert img["type"] == "image" and img["source"]["media_type"] == "image/png"


def test_auto_tag_uses_provider_and_falls_back(monkeypatch):
    from app.tools import documents
    monkeypatch.setattr(providers, "complete_text", lambda p, role="worker": '{"tags":["legal"],"summary":"A lease"}')
    assert documents._auto_tag("rent agreement", "lease.pdf") == (["legal"], "A lease")
    monkeypatch.setattr(providers, "complete_text", lambda p, role="worker": None)
    tags, _ = documents._auto_tag("GST return filing", "gstr.pdf")
    assert "tax" in tags                                              # heuristic fallback


def test_mixed_embedding_models_are_never_compared(monkeypatch, tenant):
    # a doc embedded by an OLD model (3 dims) + current provider makes 4-dim vectors
    deps.store.put_document(tenant, {"id": "doc-old", "filename": "rates.txt", "tags": [],
                                     "summary": "", "embed_model": "old-model",
                                     "chunks": [{"i": 0, "text": "steel rod rates", "embedding": [1, 0, 0],
                                                 "embed_model": "old-model"}]})
    monkeypatch.setenv("EMBED_PROVIDER", "ollama")
    monkeypatch.setattr(providers, "_post", lambda url, payload, headers=None, timeout=60:
                        {"embeddings": [[0.5, 0.5, 0.5, 0.5] for _ in payload["input"]]})
    hits = retrieval.search_documents(tenant, "steel rod")
    old = next(h for h in hits if h["doc_id"] == "doc-old")
    assert old["vec"] == 0.0 and old["kw"] > 0                         # keyword only, no bogus cosine
    assert retrieval.retrieval_mode(tenant) == "keyword"
    res = retrieval.reembed_documents(tenant)
    assert res["model"] == "nomic-embed-text" and res["reembedded"] >= 1
    assert deps.store.get_document(tenant, "doc-old")["embed_model"] == "nomic-embed-text"
    assert retrieval.retrieval_mode(tenant) == "hybrid"


def test_legacy_untagged_vectors_count_as_titan():
    ch = {"embedding": [1.0] * 4}
    assert retrieval._compatible({}, ch, retrieval.LEGACY_EMBED_MODEL, [1.0] * 4)
    assert not retrieval._compatible({}, ch, "text-embedding-3-small", [1.0] * 4)


@pytest.mark.parametrize("model,key", [
    ("apac.amazon.nova-pro-v1:0", "nova-pro"), ("apac.amazon.nova-lite-v1:0", "nova-lite"),
    ("claude-haiku-4-5-20251001", "claude-haiku"), ("gpt-4.1-mini", "gpt-4.1-mini"),
    ("gpt-4.1", "gpt-4.1"), ("llama3.1", "llama"),
])
def test_pricing_longest_match(model, key):
    assert tracing.price_for(model) == tracing._PRICING[key]


def test_unknown_model_is_unpriced_not_mispriced():
    assert tracing.price_for("mystery-model") is None
    assert tracing._cost(1000, 1000, "mystery-model") == 0.0


def test_status_reports_real_config(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    st = providers.status()
    assert st["provider"] == "anthropic" and st["provider_error"] == "ANTHROPIC_API_KEY not set"
