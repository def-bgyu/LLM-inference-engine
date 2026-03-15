import asyncio
import logging
from app.services.model_service import model_service
from app.core.config import settings

logger = logging.getLogger(__name__)

class QueueService:

    def __init__(self):
        self.queue = asyncio.Queue()
        self.is_running = False
    
    async def enqueue(self, prompt: str, max_new_tokens: int = None) -> dict:
        from app.services.cache_service import cache_service
        cached_result = cache_service.get(prompt)
        if cached_result:
            import time
            start = time.perf_counter()
            logger.info("Returning cached result")
            cached_result["cached"] = True
            cached_result["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
            return cached_result
        
        future = asyncio.get_event_loop().create_future()
        await self.queue.put({
            "prompt": prompt,
            "max_new_tokens": max_new_tokens,
            "future": future
        })
        logger.info(f"Request queued — queue size: {self.queue.qsize()}")
        result = await future
        cache_service.set(prompt, result)
        return result

    async def collect_batch(self) -> list:
        batch = []
        try:
            first_item = await self.queue.get()
            batch.append(first_item)
        except asyncio.CancelledError:
            return batch
        while len(batch) < settings.max_batch_size:
            try:
                item = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=settings.batch_wait_ms / 1000
                )
                batch.append(item)
            except asyncio.TimeoutError:
                break
        return batch

    async def process_batch(self, batch: list):
        prompts = [item["prompt"] for item in batch]
        max_new_tokens = next(
            (item["max_new_tokens"] for item in batch if item["max_new_tokens"]),
            settings.max_new_tokens
        )
        logger.info(f"Processing batch of {len(batch)} requests")
        try:
            results = model_service.generate_batch(prompts, max_new_tokens)
            for item, result in zip(batch, results):
                item["future"].set_result(result)
        except Exception as e:
            logger.error(f"Batch processing error: {e}")
            for item in batch:
                item["future"].set_exception(e)

    async def worker(self):
        self.is_running = True
        logger.info("Worker started — waiting for requests")
        while True:
            batch = await self.collect_batch()
            if batch:
                await self.process_batch(batch)

queue_service = QueueService()