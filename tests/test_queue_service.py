import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def fresh_queue_service():
    """Return a QueueService with a fresh asyncio.Queue (avoids module-level singleton state)."""
    from app.services.queue_service import QueueService
    return QueueService()


@pytest.mark.asyncio
async def test_collect_batch_returns_first_item_on_timeout(fresh_queue_service):
    """Batcher returns a single-item batch when no second request arrives within the wait window."""
    qs = fresh_queue_service

    future = asyncio.get_event_loop().create_future()
    await qs.queue.put({"prompt": "hello", "max_new_tokens": None, "future": future})

    with patch("app.core.config.settings") as mock_settings:
        mock_settings.max_batch_size = 8
        mock_settings.batch_wait_ms = 10  # short wait so test is fast
        batch = await qs.collect_batch()

    assert len(batch) == 1
    assert batch[0]["prompt"] == "hello"


@pytest.mark.asyncio
async def test_collect_batch_groups_concurrent_requests(fresh_queue_service):
    """Batcher collects multiple queued requests into one batch."""
    qs = fresh_queue_service

    for i in range(3):
        future = asyncio.get_event_loop().create_future()
        await qs.queue.put({"prompt": f"prompt {i}", "max_new_tokens": None, "future": future})

    with patch("app.core.config.settings") as mock_settings:
        mock_settings.max_batch_size = 8
        mock_settings.batch_wait_ms = 10
        batch = await qs.collect_batch()

    assert len(batch) == 3


@pytest.mark.asyncio
async def test_process_batch_resolves_futures(fresh_queue_service):
    """process_batch sets results on each request's future."""
    qs = fresh_queue_service
    loop = asyncio.get_event_loop()

    futures = [loop.create_future() for _ in range(2)]
    batch = [
        {"prompt": "foo", "max_new_tokens": None, "future": futures[0]},
        {"prompt": "bar", "max_new_tokens": None, "future": futures[1]},
    ]

    fake_results = [
        {"request_id": "a", "prompt": "foo", "generated_text": "out1",
         "latency_ms": 10, "cached": False, "input_tokens": 1, "output_tokens": 1, "tokens_per_second": 1.0},
        {"request_id": "b", "prompt": "bar", "generated_text": "out2",
         "latency_ms": 10, "cached": False, "input_tokens": 1, "output_tokens": 1, "tokens_per_second": 1.0},
    ]

    with patch("app.services.queue_service.model_service") as mock_model:
        mock_model.generate_batch.return_value = fake_results
        await qs.process_batch(batch)

    assert futures[0].result()["generated_text"] == "out1"
    assert futures[1].result()["generated_text"] == "out2"


@pytest.mark.asyncio
async def test_process_batch_propagates_exception(fresh_queue_service):
    """process_batch sets the exception on all futures if the model call fails."""
    qs = fresh_queue_service
    loop = asyncio.get_event_loop()

    future = loop.create_future()
    batch = [{"prompt": "crash", "max_new_tokens": None, "future": future}]

    with patch("app.services.queue_service.model_service") as mock_model:
        mock_model.generate_batch.side_effect = RuntimeError("GPU OOM")
        await qs.process_batch(batch)

    with pytest.raises(RuntimeError, match="GPU OOM"):
        future.result()
