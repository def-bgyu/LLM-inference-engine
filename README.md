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
- **Auto-generated API docs** — FastAPI's built-in `/docs` interface for testing endpoints
- **Configurable settings** — batch size, wait time, max tokens, all tunable via `.env`

---

## Architecture

```
Client
  │
  ▼
FastAPI Gateway  (/generate, /health)
  │
  ├──▶ Cache check (Redis + sentence-transformers)
  │         └── Cache hit → return in <50ms
  │
  ▼
Async Queue (asyncio.Queue)
  │
  ▼
Dynamic Batcher
  │   waits 50ms OR until 8 requests collected
  ▼
Model Worker (GPT-2 via HuggingFace)
  │   single forward pass for entire batch
  ▼
Response Router → resolves each user's future
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI + uvicorn |
| Queue | Python asyncio.Queue |
| Batching | Custom dynamic batcher |
| Model | GPT-2 via HuggingFace Transformers |
| Cache | Redis + sentence-transformers |
| Embeddings | all-MiniLM-L6-v2 |
| Load Testing | k6 |
| Containerization | Docker |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Docker (for Redis)

### 1. Clone the repository

```bash
git clone https://github.com/def-bgyu/LLM-inference-engine.git
cd LLM-inference-engine
```

### 2. Create and activate virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start Redis

```bash
docker run -d -p 6379:6379 --name llm-inference-redis redis
```

### 5. Start the server

```bash
uvicorn app.main:app --reload
```

### 6. Test it

Open `http://127.0.0.1:8000/docs` and send a prompt:

```json
{
  "prompt": "What is machine learning"
}
```

---

## Project Structure

```
llm-inference-engine/
├── app/
│   ├── main.py                  # FastAPI entrypoint, lifespan startup
│   ├── api/
│   │   └── routes.py            # /generate and /health endpoints
│   ├── core/
│   │   └── config.py            # Configurable settings via .env
│   ├── models/
│   │   └── schemas.py           # Request/response Pydantic schemas
│   └── services/
│       ├── model_service.py     # GPT-2 loading, single + batch inference
│       ├── queue_service.py     # Async queue + dynamic batcher + worker
│       └── cache_service.py     # Redis semantic cache
├── requirements.txt
└── .env
```

---

## Configuration

```env
MODEL_NAME=gpt2
MAX_BATCH_SIZE=8
BATCH_WAIT_MS=50
MAX_NEW_TOKENS=100
```

---

## Benchmarks

*GPU benchmarks coming in Week 7 via Google Colab T4.*

| Metric | No batching | With batching |
|---|---|---|
| Model runs for 5 requests | 5 | 1 |
| Cache hit latency | — | <50ms |
| Cache miss latency (CPU) | ~8000ms | ~8000ms |
| Cache miss latency (GPU) | TBD | TBD |

---

## Roadmap

- [x] FastAPI server + GPT-2 inference
- [x] Async request queue
- [x] Dynamic batcher
- [x] Redis semantic cache
- [ ] Metrics collection + /metrics endpoint
- [ ] k6 load testing + benchmarks
- [ ] React observability dashboard
- [ ] Docker + Kubernetes deployment
- [ ] GPU benchmarks on Google Colab

---

## License

MIT License.
