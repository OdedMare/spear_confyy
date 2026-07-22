import json
from dataclasses import asdict, dataclass, fields
from functools import lru_cache
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from .config import Settings, get_settings


@dataclass
class RuntimeSettings:
    llm_model: str
    llm_diet_mode: bool
    llm_base_url: Optional[str]
    openai_api_key: str
    database_url: str
    gitlab_url: Optional[str]
    gitlab_token: str
    gitlab_verify_tls: bool


def normalize_http_url(value: str, field: str, strip_suffixes=()) -> str:
    cleaned = value.strip().rstrip("/")
    suffix = next((item for item in strip_suffixes if cleaned.lower().endswith(item)), None)
    if suffix:
        cleaned = cleaned[:-len(suffix)]
    if not cleaned.lower().startswith(("http://", "https://")):
        raise ValueError("%s must start with http:// or https://" % field)
    return cleaned.rstrip("/")


def normalize_database_url(value: str) -> str:
    cleaned = value.strip()
    if cleaned.lower().startswith("jdbc:"):
        cleaned = cleaned[5:]
    if not cleaned.lower().startswith(("postgresql://", "postgres://")):
        raise ValueError("database_url must start with postgresql://")
    return cleaned


class RuntimeSettingsStore:
    """Same env-default + JSON runtime override pattern used by locatoAi."""

    _nullable = {"llm_base_url", "gitlab_url"}
    _secrets = {"openai_api_key", "gitlab_token"}

    def __init__(self, env: Settings):
        self._path = Path(env.runtime_settings_file)
        self._settings = RuntimeSettings(
            llm_model=env.llm_model,
            llm_diet_mode=env.llm_diet_mode,
            llm_base_url=env.llm_base_url,
            openai_api_key=env.openai_api_key,
            database_url=env.database_url,
            gitlab_url=env.gitlab_url,
            gitlab_token=env.gitlab_token,
            gitlab_verify_tls=env.gitlab_verify_tls,
        )
        if self._path.exists():
            try:
                saved = json.loads(self._path.read_text(encoding="utf-8"))
                self._apply(saved, strict=False)
            except (OSError, ValueError):
                pass

    def get(self) -> RuntimeSettings:
        return self._settings

    def update(self, patch: dict) -> RuntimeSettings:
        clean = dict(patch)
        for secret in self._secrets:
            if clean.get(secret) == "":
                clean.pop(secret)
        if "llm_model" in clean and not (clean.get("llm_model") or "").strip():
            clean.pop("llm_model")
        self._apply(clean, strict=True)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(asdict(self._settings), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._path.chmod(0o600)
        return self._settings

    def _apply(self, patch: dict, strict: bool) -> None:
        known = {item.name for item in fields(RuntimeSettings)}
        for key, value in patch.items():
            if key not in known:
                continue
            if key in self._nullable and (value is None or value == ""):
                setattr(self._settings, key, None)
                continue
            if value is None:
                continue
            try:
                if key == "llm_base_url":
                    value = normalize_http_url(value, key, ("/chat/completions", "/completions", "/models"))
                elif key == "gitlab_url":
                    value = normalize_http_url(value, key, ("/api/v4",))
                elif key == "database_url":
                    value = normalize_database_url(value)
            except ValueError:
                if strict:
                    raise
                continue
            setattr(self._settings, key, value)


def mask_key(value: str) -> Optional[str]:
    if not value:
        return None
    return "…%s" % value[-4:] if len(value) > 8 else "…"


def mask_database_url(value: str) -> str:
    parts = urlsplit(value)
    if not parts.password:
        return value
    user = parts.username or ""
    host = parts.hostname or ""
    port = ":%s" % parts.port if parts.port else ""
    return urlunsplit((parts.scheme, "%s:****@%s%s" % (user, host, port), parts.path, parts.query, parts.fragment))


@lru_cache(maxsize=1)
def get_runtime_store() -> RuntimeSettingsStore:
    return RuntimeSettingsStore(get_settings())


def get_runtime_settings() -> RuntimeSettings:
    return get_runtime_store().get()
