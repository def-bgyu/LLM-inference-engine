# LLM Inference Engine

A production-style LLM inference engine with dynamic request batching, async queue management, and Redis semantic caching — inspired by systems like vLLM and TensorRT-LLM.

---

## What it does

Users send prompts to a FastAPI server. Instead of processing requests one at a time, the system queues them, groups multiple prompts into batches, and runs a single model forward pass for the whole batch — maximizing GPU utilization. Repeated or semantically similar prompts are served instantly from a Redis cache, bypassing the model entirely.

---

## Features

- **Dynamic batching** — groups concurrent requests into batches (up to 8, within 50ms window) for a single model forward pass
- **Async request queue** — handles concurrent users without dropping requests; each request gets its own future for result routing
- **Semantic cache** — embeds prompts using `all-MiniLM-L6-v2` and retrieves cached results via cosine similarity (threshold: 0.80), returning responses in under 50ms
- **Real-time dashboard** — React UI showing live throughput, latency percentiles, cache hit rate, and batch size distribution
- **GPU support** — automatically detects and uses CUDA if available, falls back to CPU
- **One-command setup** — full stack (API + Redis) via `docker-compose up`

---

## Architecture

```
Client
  │
  ▼
FastAPI Gateway  (/generate, /health, /metrics)
  │
  ├──▶ Semantic Cache check (Redis + sentence-transformers)
  │         └── Cache hit → return in <50ms
  │
  ▼
Async Queue (asyncio.Queue)
  │
  ▼
Dynamic Batcher
  │   waits 50ms OR until 8 requests collected
  ▼
Model Worker (GPT-Neo / GPT-2 via HuggingFace)
  │   single forward pass for entire batch
  │   runs on GPU if available, CPU otherwise
  ▼
Response Router → resolves each user's future
  │
  ▼
Metrics Collector → feeds React dashboard
```

---

## Benchmarks

Load tested with k6 at 50 concurrent users across 3 scenarios:

| Scenario | Requests | p95 Latency | Cache Hit Rate | Error Rate |
|---|---|---|---|---|
| All cached | 940 | 385ms | 99% | 0% |
| Realistic mix (30% repeat) | 94 | 32s (CPU) | 51% | 0% |
| No cache | 92 | 39s (CPU) | ~0% | 0% |

**Key insight:** Semantic cache reduces p95 latency from 39s → 385ms — a 100x improvement for repeated prompts.

*GPU benchmarks with GPT-Neo 1.3B on A100 in progress.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI + uvicorn |
| Queue | Python asyncio.Queue |
| Batching | Custom dynamic batcher |
| Model | GPT-Neo 1.3B / GPT-2 via HuggingFace |
| Cache | Redis + sentence-transformers |
| Embeddings | all-MiniLM-L6-v2 |
| Dashboard | React + Recharts |
| Load Testing | k6 |
| Containerization | Docker + docker-compose |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Docker

### 1. Clone the repository

```bash
git clone https://github.com/def-bgyu/LLM-inference-engine.git
cd LLM-inference-engine
```

### 2. Start with Docker (recommended)

```bash
docker-compose up --build
```

This starts Redis + API together. First run takes 5-7 minutes to download the model.

### 3. Or run locally

```bash
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
docker run -d -p 6379:6379 redis
uvicorn app.main:app --reload
```

### 4. Start the dashboard

```bash
cd dashboard
npm install
npm run dev
```

---## Project Structure

```
llm-inference-engine/
├── app/
│   ├── main.py                  # FastAPI entrypoint, lifespan startup
│   ├── api/
│   │   └── routes.py            # /generate, /health, /metrics endpoints
│   ├── core/
│   │   └── config.py            # Configurable settings via .env
│   ├── models/
│   │   └── schemas.py           # Request/response Pydantic schemas
│   └── services/
│       ├── model_service.py     # Model loading, single + batch inference, GPU support
│       ├── queue_service.py     # Async queue + dynamic batcher + worker
│       ├── cache_service.py     # Redis semantic cache
│       └── metrics_service.py   # Request metrics + percentile tracking
├── dashboard/                   # React + Recharts observability UI
├── loadtest/
│   └── k6_script.js             # k6 load test — 50 concurrent users
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Configuration

```env
MODEL_NAME=EleutherAI/gpt-neo-1.3B
MAX_BATCH_SIZE=8
BATCH_WAIT_MS=50
MAX_NEW_TOKENS=100
REDIS_HOST=localhost
```

Tuning guide:
- `MAX_BATCH_SIZE` — increase for higher GPU utilization, decrease for lower latency
- `BATCH_WAIT_MS` — increase to fill larger batches, decrease for faster response time
- `MODEL_NAME` — swap to any HuggingFace causal LM

---
## License

MIT License.
