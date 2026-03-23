import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import GenerateRequest, GenerateResponse
from app.services.queue_service import queue_service
from app.core.config import settings
from app.services.metrics_service import metrics_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "model_name": settings.model_name,
        "queue_size": queue_service.queue.qsize(),
    }

@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    try:
        result = await queue_service.enqueue(
            prompt=request.prompt,
            max_new_tokens=request.max_new_tokens,
        )
        return GenerateResponse(**result)
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def metrics():
    return metrics_service.get_summary()

@router.get("/recent-requests")
async def recent_requests():
    return metrics_service.get_recent_requests()

@router.post("/clear-cache")
async def clear_cache():
    from app.services.cache_service import cache_service
    cache_service.redis.flushall()
    return {"status": "cache cleared"}