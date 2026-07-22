import base64
import binascii
import hashlib
import hmac
import time
from typing import Dict

from fastapi import HTTPException, Request

from .config import get_settings


def create_session(username: str, role: str) -> str:
    expires = str(int(time.time()) + get_settings().session_seconds)
    payload = "%s:%s:%s" % (username, role, expires)
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return base64.urlsafe_b64encode((payload + ":" + signature).encode("utf-8")).decode("ascii")


def read_session(token: str) -> Dict[str, str]:
    try:
        decoded = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        username, role, expires, signature = decoded.rsplit(":", 3)
        expires_at = int(expires)
    except (binascii.Error, ValueError, UnicodeError):
        raise HTTPException(status_code=401, detail="נדרשת התחברות מחדש")
    payload = "%s:%s:%s" % (username, role, expires)
    expected = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected) or expires_at < int(time.time()):
        raise HTTPException(status_code=401, detail="פג תוקף ההתחברות")
    return {"username": username, "role": role}


def require_team(request: Request) -> Dict[str, str]:
    token = request.cookies.get("spear_session", "")
    if not token:
        raise HTTPException(status_code=401, detail="נדרשת התחברות לצוות")
    return read_session(token)
