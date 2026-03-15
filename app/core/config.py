from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_name: str = "gpt2"
    max_batch_size: int = 8
    batch_wait_ms: int = 50
    max_new_tokens: int = 100

settings = Settings()