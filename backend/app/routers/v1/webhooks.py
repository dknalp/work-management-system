"""v1 Webhooks router — webhook management for bot accounts.

Webhooks can only be managed by bot actors (``wms_live_*`` API keys).
Human users may not create or manage webhooks — they are a bot-automation
feature.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore

from ...deps import Actor, get_current_actor
from ...firebase import get_db
from ...models import BotAccount
from ...schemas import WebhookCreate, WebhookResponse

router = APIRouter(prefix="/webhooks", tags=["v1-webhooks"])


def _require_bot(actor: Actor) -> BotAccount:
    """Enforce that the actor is a bot account."""
    if not isinstance(actor, BotAccount):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhooks can only be managed by bot accounts.",
        )
    return actor


def _doc_to_response(doc_id: str, data: dict) -> WebhookResponse:
    """Convert a Firestore webhooks document dict to a ``WebhookResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return WebhookResponse(
        id=doc_id,
        bot_id=data.get("bot_id", ""),
        url=data.get("url", ""),
        events=data.get("events", []),
        secret=data.get("secret"),
        is_active=data.get("is_active", True),
        created_at=created_at,
    )


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
def create_webhook(
    body: WebhookCreate,
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Create a new webhook subscription for the calling bot account."""
    bot = _require_bot(actor)
    webhook_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    data = {
        "bot_id": bot.id,
        "url": body.url,
        "events": body.events,
        "secret": body.secret,
        "is_active": True,
        "created_at": now,
    }
    db.collection("webhooks").document(webhook_id).set(data)
    return _doc_to_response(webhook_id, data)


@router.get("", response_model=List[WebhookResponse])
def list_webhooks(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Return all webhooks registered by the calling bot account."""
    bot = _require_bot(actor)
    raw = list(
        db.collection("webhooks")
        .where("bot_id", "==", bot.id)
        .stream()
    )
    raw.sort(key=lambda d: (d.to_dict() or {}).get("created_at") or "")
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in raw]


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: str,
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Delete a webhook.  The calling bot must own the webhook."""
    bot = _require_bot(actor)
    doc = db.collection("webhooks").document(webhook_id).get()
    if not doc.exists or (doc.to_dict() or {}).get("bot_id") != bot.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found.")
    db.collection("webhooks").document(webhook_id).delete()