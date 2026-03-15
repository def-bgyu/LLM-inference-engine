from pydantic import BaseModel, Field
from typing import Optional

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    max_new_tokens: Optional[int] = Field(None, ge=1, le=500)

class GenerateResponse(BaseModel):
    request_id: str
    prompt: str
    generated_text: str
    latency_ms: float
    cached: bool = False