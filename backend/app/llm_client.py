import time
from functools import lru_cache
from typing import Dict, List, Optional

import httpx
from openai import APIConnectionError, APITimeoutError, BadRequestError, OpenAI, RateLimitError

from .runtime_settings import get_runtime_settings


TRANSIENT_ERRORS = (RateLimitError, APIConnectionError, APITimeoutError)
LOCAL_SERVER_KEY = "null"


@lru_cache(maxsize=8)
def get_openai_client(api_key: str, base_url: Optional[str]) -> OpenAI:
    return OpenAI(api_key=api_key or LOCAL_SERVER_KEY, base_url=base_url or None)


def _merge_system_into_user(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    system = [item["content"] for item in messages if item["role"] == "system"]
    rest = [item for item in messages if item["role"] != "system"]
    if not system or not rest:
        return rest or messages
    merged = dict(rest[0])
    merged["content"] = "\n\n".join(system + [merged["content"]])
    return [merged] + rest[1:]


def _create_with_retry(client: OpenAI, model: str, messages: List[Dict[str, str]], max_tokens: Optional[int]):
    last_error = None
    for attempt in range(2):
        try:
            kwargs = {"model": model, "messages": messages, "temperature": 0}
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            return client.chat.completions.create(**kwargs)
        except TRANSIENT_ERRORS as error:
            last_error = error
            if attempt == 0:
                time.sleep(0.3)
    raise last_error


def chat_completion(messages: List[Dict[str, str]]) -> str:
    runtime = get_runtime_settings()
    if not runtime.openai_api_key and not runtime.llm_base_url:
        raise RuntimeError("No API key or compatible LLM base URL configured")
    client = get_openai_client(runtime.openai_api_key, runtime.llm_base_url)
    max_tokens = 1200 if runtime.llm_diet_mode else None
    last_error = None
    for candidate in (messages, _merge_system_into_user(messages)):
        try:
            response = _create_with_retry(client, runtime.llm_model, candidate, max_tokens)
            content = response.choices[0].message.content
            if not content:
                raise RuntimeError("LLM returned an empty reply")
            return content
        except BadRequestError as error:
            last_error = error
    raise RuntimeError("LLM request failed: %s" % last_error)


def _model_ids(payload) -> List[str]:
    items = payload
    if isinstance(payload, dict):
        items = payload.get("data") if payload.get("data") is not None else payload.get("models")
    if not isinstance(items, list):
        return []
    identifiers = set()
    for item in items:
        if isinstance(item, str):
            identifiers.add(item)
        elif isinstance(item, dict):
            value = item.get("id") or item.get("name") or item.get("model")
            if value:
                identifiers.add(str(value))
    return sorted(identifiers)


def list_models(base_url_override: Optional[str] = None, api_key_override: Optional[str] = None) -> List[str]:
    runtime = get_runtime_settings()
    base_url = base_url_override or runtime.llm_base_url
    api_key = api_key_override or runtime.openai_api_key
    if not api_key and not base_url:
        raise RuntimeError("No API key or compatible LLM base URL configured")
    response = httpx.get(
        (base_url or "https://api.openai.com/v1").rstrip("/") + "/models",
        headers={"Authorization": "Bearer " + (api_key or LOCAL_SERVER_KEY)},
        timeout=30,
    )
    response.raise_for_status()
    return _model_ids(response.json())
