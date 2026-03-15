import time
import uuid
import logging
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
from app.core.config import settings

logger = logging.getLogger(__name__)

class ModelService:

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.is_loaded = False

    def load(self):
        logger.info(f"Loading model: {settings.model_name}")
        self.tokenizer = AutoTokenizer.from_pretrained(settings.model_name)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = AutoModelForCausalLM.from_pretrained(settings.model_name)
        self.model = self.model.to(self.device)
        self.model.eval()
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = 'left'
        self.is_loaded = True
        logger.info("Model loaded successfully")

    def generate(self, prompt: str, max_new_tokens: int = None) -> dict:
        max_tokens = max_new_tokens or settings.max_new_tokens
        start = time.perf_counter()
        request_id = str(uuid.uuid4())[:8]
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=False,
                pad_token_id=self.tokenizer.pad_token_id,
            )
        new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
        generated_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            "request_id": request_id,
            "prompt": prompt,
            "generated_text": generated_text,
            "latency_ms": round(latency_ms, 2),
            "cached": False,
        }
    
    def generate_batch(self, prompts: list, max_new_tokens: int = None) -> list:
        max_tokens = max_new_tokens or settings.max_new_tokens
        import time, uuid
        inputs = self.tokenizer(
            prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        start = time.perf_counter()
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=False,
                pad_token_id=self.tokenizer.pad_token_id,
            )
        latency_ms = (time.perf_counter() - start) * 1000
        results = []
        for i, output in enumerate(outputs):
            new_tokens = output[inputs["input_ids"].shape[1]:]
            generated_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
            results.append({
                "request_id": str(uuid.uuid4())[:8],
                "prompt": prompts[i],
                "generated_text": generated_text,
                "latency_ms": round(latency_ms, 2),
                "cached": False,
            })
        return results

model_service = ModelService()