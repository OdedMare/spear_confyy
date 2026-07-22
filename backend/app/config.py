from functools import lru_cache
from typing import Optional

from pydantic import Field
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

    llm_model: str = "gemma4:31b-cloud"
    llm_diet_mode: bool = True
    llm_base_url: Optional[str] = "http://localhost:11434/v1"
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")

    gitlab_url: Optional[str] = None
    gitlab_token: str = ""
    gitlab_verify_tls: bool = True
    gitlab_max_files: int = 2000
    gitlab_max_file_bytes: int = 524288
    runtime_settings_file: str = "runtime-settings.json"

    team_username: str = "spear1"
    team_password: str = "spear1"
    team_display_name: str = "Spear Admin"
    team_role: str = "admin"
    session_secret: str = "change-this-in-production"
    session_seconds: int = 43200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
