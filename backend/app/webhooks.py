import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlmodel import Session, select

from .models import Webhook


def _build_payload(event: str, data: Any) -> dict:
    return {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


def _sign_payload(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def fire_webhooks(event: str, data: Any, session: Session) -> None:
    """Send webhooks for all active subscriptions matching the event. Fire-and-forget."""
    webhooks = session.exec(
        select(Webhook).where(Webhook.is_active == True)
    ).all()
    matching = [wh for wh in webhooks if event in (wh.events or [])]
    if not matching:
        return

    payload = _build_payload(event, data)
    body = json.dumps(payload, default=str).encode()

    with httpx.Client(timeout=5.0) as client:
        for wh in matching:
            headers = {"Content-Type": "application/json", "X-WorkSync-Event": event}
            if wh.secret:
                headers["X-WorkSync-Signature"] = _sign_payload(wh.secret, body)
            try:
                client.post(wh.url, content=body, headers=headers)
            except Exception:
                pass


def fire_webhooks_simple(event: str, data: Any) -> None:
    """Variant for background tasks that don't have a session (e.g. file upload)."""
    from .database import engine
    with Session(engine) as session:
        fire_webhooks(event, data, session)
