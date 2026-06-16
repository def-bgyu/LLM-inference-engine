from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_name: str = "distilgpt2"
    max_batch_size: int = 8
    batch_wait_ms: int = 50
    max_new_tokens: int = 50

settings = Settings()