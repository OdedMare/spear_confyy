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
    gitlab_max_files: int = 2000
    gitlab_max_file_bytes: int = 524288

    team_username: str = "team"
    team_password: str = "spear-local"
    team_display_name: str = "צוות Spear"
    team_role: str = "fde"
    session_secret: str = "change-this-in-production"
    session_seconds: int = 43200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
