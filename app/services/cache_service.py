import os
import json
import logging
import numpy as np
import redis
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class CacheService:

    def __init__(self):
        self.redis = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"), port=6379, db=0)
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
        self.threshold = 0.92

    def _embed(self, text: str) -> np.ndarray:
        return self.encoder.encode(text, normalize_embeddings=True)

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))

    def get(self, prompt: str) -> dict | None:
        prompt_embedding = self._embed(prompt)
        keys = self.redis.keys("cache:*")
        for key in keys:
            cached = json.loads(self.redis.get(key))
            cached_embedding = np.array(cached["embedding"])
            similarity = self._cosine_similarity(prompt_embedding, cached_embedding)
            if similarity >= self.threshold:
                logger.info(f"Cache hit — similarity: {similarity:.3f}")
                return cached["result"]
        return None

    def set(self, prompt: str, result: dict):
        embedding = self._embed(prompt)
        value = json.dumps({
            "embedding": embedding.tolist(),
            "result": result
        })
        key = f"cache:{prompt[:50]}"
        self.redis.set(key, value, ex=3600)
        logger.info(f"Cached result for prompt: {prompt[:30]}...")

cache_service = CacheService()