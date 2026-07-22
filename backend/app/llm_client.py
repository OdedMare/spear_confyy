import time
from functools import lru_cache
from typing import Dict, List

from openai import APIConnectionError, APITimeoutError, InternalServerError, OpenAI, RateLimitError


TRANSIENT_ERRORS = (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)


@lru_cache(maxsize=8)
def get_openai_client(api_key: str, base_url: str) -> OpenAI:
    return OpenAI(
        api_key=api_key or "null",
        base_url=base_url or None,
        max_retries=0,
        timeout=18.0,
    )


def chat_completion(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
    base_url: str,
) -> str:
    client = get_openai_client(api_key, base_url)
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.25,
            )
            return response.choices[0].message.content or ""
        except TRANSIENT_ERRORS:
            if attempt == 1:
                raise
            time.sleep(0.35)
    return ""

