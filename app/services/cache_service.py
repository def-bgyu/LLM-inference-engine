import os
import json
import logging
import numpy as np
import redis
from redis.commands.search.field import VectorField, TextField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

VECTOR_DIM = 384
INDEX_NAME = "cache_idx"
DOC_PREFIX = "cache:"


class CacheService:

    def __init__(self):
        redis_url = os.getenv("REDIS_URL", None)
        if redis_url:
            self.redis = redis.Redis.from_url(redis_url)
        else:
            self.redis = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"), port=6379, db=0)
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
        self.threshold = 0.92
        self._ensure_index()

    def _ensure_index(self):
        try:
            self.redis.ft(INDEX_NAME).info()
            logger.info("Redis vector index already exists")
        except Exception:
            schema = (
                TextField("prompt"),
                VectorField(
                    "embedding",
                    "FLAT",
                    {
                        "TYPE": "FLOAT32",
                        "DIM": VECTOR_DIM,
                        "DISTANCE_METRIC": "COSINE",
                    },
                ),
            )
            self.redis.ft(INDEX_NAME).create_index(
                schema,
                definition=IndexDefinition(prefix=[DOC_PREFIX], index_type=IndexType.HASH),
            )
            logger.info("Created Redis vector index")

    def _embed(self, text: str) -> np.ndarray:
        return self.encoder.encode(text, normalize_embeddings=True).astype(np.float32)

    def get(self, prompt: str) -> dict | None:
        embedding = self._embed(prompt)
        query = (
            Query("*=>[KNN 1 @embedding $vec AS score]")
            .sort_by("score")
            .return_fields("score", "result")
            .dialect(2)
        )
        params = {"vec": embedding.tobytes()}
        try:
            results = self.redis.ft(INDEX_NAME).search(query, query_params=params)
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")
            return None

        if not results.docs:
            return None

        doc = results.docs[0]
        # COSINE distance metric returns distance (0=identical), convert to similarity
        similarity = 1.0 - float(doc.score)
        if similarity >= self.threshold:
            logger.info(f"Cache hit — similarity: {similarity:.3f}")
            return json.loads(doc.result)

        logger.info(f"Cache miss — best similarity: {similarity:.3f}")
        return None

    def set(self, prompt: str, result: dict):
        embedding = self._embed(prompt)
        key = f"{DOC_PREFIX}{prompt[:50]}"
        mapping = {
            "prompt": prompt[:200],
            "embedding": embedding.tobytes(),
            "result": json.dumps(result),
        }
        self.redis.hset(key, mapping=mapping)
        self.redis.expire(key, 3600)
        logger.info(f"Cached result for prompt: {prompt[:30]}...")

cache_service = CacheService()
