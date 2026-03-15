import time
import logging
from dataclasses import dataclass, field
from typing import List

logger = logging.getLogger(__name__)

@dataclass
class MetricsService:
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    total_latency_ms: float = 0.0
    latency_history: List[float] = field(default_factory=list)
    batch_sizes: List[int] = field(default_factory=list)
    start_time: float = field(default_factory=time.time)

    def record_request(self, latency_ms: float, cached: bool, batch_size: int = 1):
        self.total_requests += 1
        self.total_latency_ms += latency_ms
        self.latency_history.append(latency_ms)
        if cached:
            self.cache_hits += 1
        else:
            self.cache_misses += 1
            self.batch_sizes.append(batch_size)

    def get_summary(self) -> dict:
        if not self.latency_history:
            return {"message": "No requests yet"}

        sorted_latencies = sorted(self.latency_history)
        p95_index = int(len(sorted_latencies) * 0.95)
        p95_latency = sorted_latencies[p95_index]
        avg_latency = self.total_latency_ms / self.total_requests
        cache_hit_rate = (self.cache_hits / self.total_requests) * 100
        avg_batch_size = sum(self.batch_sizes) / len(self.batch_sizes) if self.batch_sizes else 0
        uptime_seconds = round(time.time() - self.start_time)

        return {
            "total_requests": self.total_requests,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "cache_hit_rate_pct": round(cache_hit_rate, 2),
            "avg_latency_ms": round(avg_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "avg_batch_size": round(avg_batch_size, 2),
            "uptime_seconds": uptime_seconds,
        }

metrics_service = MetricsService()