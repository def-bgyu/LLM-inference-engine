import json
import numpy as np
import pytest
from unittest.mock import MagicMock, patch


FAKE_DIM = 384
FAKE_RESULT = {
    "request_id": "abc123",
    "prompt": "hello",
    "generated_text": "world",
    "latency_ms": 50.0,
    "cached": False,
    "input_tokens": 1,
    "output_tokens": 1,
    "tokens_per_second": 2.0,
}


def make_cache_service(redis_mock):
    """Construct a CacheService with a mocked Redis and encoder, skipping index creation."""
    with patch("app.services.cache_service.redis.Redis", return_value=redis_mock), \
         patch("app.services.cache_service.SentenceTransformer") as mock_st:

        mock_encoder = MagicMock()
        mock_encoder.encode.return_value = np.ones(FAKE_DIM, dtype=np.float32)
        mock_st.return_value = mock_encoder

        # Make ft().info() succeed so _ensure_index skips creation
        redis_mock.ft.return_value.info.return_value = {}

        from importlib import reload
        import app.services.cache_service as mod
        reload(mod)
        return mod.CacheService()


def _make_doc(similarity_distance: float) -> MagicMock:
    doc = MagicMock()
    doc.score = str(similarity_distance)
    doc.result = json.dumps(FAKE_RESULT)
    return doc


def test_cache_hit_above_threshold():
    redis_mock = MagicMock()
    svc = make_cache_service(redis_mock)

    # similarity = 1 - 0.05 = 0.95, above 0.92 threshold
    redis_mock.ft.return_value.search.return_value.docs = [_make_doc(0.05)]

    result = svc.get("hello world")
    assert result is not None
    assert result["generated_text"] == "world"


def test_cache_miss_below_threshold():
    redis_mock = MagicMock()
    svc = make_cache_service(redis_mock)

    # similarity = 1 - 0.15 = 0.85, below 0.92 threshold
    redis_mock.ft.return_value.search.return_value.docs = [_make_doc(0.15)]

    result = svc.get("something completely different")
    assert result is None


def test_cache_miss_no_results():
    redis_mock = MagicMock()
    svc = make_cache_service(redis_mock)

    redis_mock.ft.return_value.search.return_value.docs = []

    result = svc.get("anything")
    assert result is None


def test_cache_set_stores_hash():
    redis_mock = MagicMock()
    svc = make_cache_service(redis_mock)

    svc.set("my prompt", FAKE_RESULT)

    redis_mock.hset.assert_called_once()
    call_kwargs = redis_mock.hset.call_args.kwargs["mapping"]
    assert "embedding" in call_kwargs
    assert "result" in call_kwargs
    stored = json.loads(call_kwargs["result"])
    assert stored["generated_text"] == "world"
