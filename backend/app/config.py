from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SPEAR_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Spear API"
    database_url: str = "postgresql://spear:spear@127.0.0.1:5432/spear"
    local_storage_path: str = "./data"

    llm_base_url: str = "http://127.0.0.1:8001/v1"
    llm_api_key: str = "null"
    llm_model: str = "gemma4-31b"

    gitlab_url: str = ""
    gitlab_token: Optional[str] = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

