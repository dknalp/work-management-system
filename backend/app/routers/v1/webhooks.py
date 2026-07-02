import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import BotAccount, Webhook
from ...schemas import WebhookCreate, WebhookResponse

router = APIRouter(prefix="/webhooks", tags=["v1-webhooks"])


def _require_bot(actor: Actor) -> BotAccount:
    if not isinstance(actor, BotAccount):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhooks can only be managed by bot accounts",
        )
    return actor


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
def create_webhook(
    body: WebhookCreate,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    bot = _require_bot(actor)
    wh = Webhook(
        bot_id=bot.id,
        url=body.url,
        events=body.events,
        secret=body.secret,
    )
    session.add(wh)
    session.commit()
    session.refresh(wh)
    return wh


@router.get("", response_model=List[WebhookResponse])
def list_webhooks(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    bot = _require_bot(actor)
    webhooks = session.exec(
        select(Webhook).where(Webhook.bot_id == bot.id).order_by(Webhook.created_at)
    ).all()
    return webhooks


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: str,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    bot = _require_bot(actor)
    try:
        wid = uuid.UUID(webhook_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook ID")
    wh = session.get(Webhook, wid)
    if not wh or wh.bot_id != bot.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    session.delete(wh)
    session.commit()
