import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.routes import router
from app.services.model_service import model_service
from app.services.queue_service import queue_service
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — loading model...")
    model_service.load()
    logger.info("Starting background worker...")
    worker_task = asyncio.create_task(queue_service.worker())
    logger.info("Ready to serve requests")
    yield
    logger.info("Shutting down")
    worker_task.cancel()

app = FastAPI(
    title="Inferio",
    description="LLM Inference Engine with Dynamic Batching",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)