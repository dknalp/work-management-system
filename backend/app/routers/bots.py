import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user, is_admin
from ..models import BotAccount, User
from ..schemas import BotCreate, BotCreateResponse, BotResponse, BotUpdate
from ..security import generate_api_key

router = APIRouter(prefix="/admin/bots", tags=["admin-bots"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.post("", response_model=BotCreateResponse, status_code=status.HTTP_201_CREATED)
def create_bot(
    body: BotCreate,
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    full_key, key_prefix, key_hash = generate_api_key()
    bot = BotAccount(
        name=body.name,
        description=body.description,
        key_prefix=key_prefix,
        key_hash=key_hash,
        owner_id=admin.id,
    )
    session.add(bot)
    session.commit()
    session.refresh(bot)
    return BotCreateResponse(
        **bot.model_dump(),
        api_key=full_key,
    )


@router.get("", response_model=list[BotResponse])
def list_bots(
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    bots = session.exec(select(BotAccount).order_by(BotAccount.created_at.desc())).all()
    return bots


@router.get("/{bot_id}", response_model=BotResponse)
def get_bot(
    bot_id: str,
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    try:
        bid = uuid.UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bot ID")
    bot = session.get(BotAccount, bid)
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")
    return bot


@router.patch("/{bot_id}", response_model=BotResponse)
def update_bot(
    bot_id: str,
    body: BotUpdate,
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    try:
        bid = uuid.UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bot ID")
    bot = session.get(BotAccount, bid)
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(bot, key, value)
    session.add(bot)
    session.commit()
    session.refresh(bot)
    return bot


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bot(
    bot_id: str,
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    try:
        bid = uuid.UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bot ID")
    bot = session.get(BotAccount, bid)
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")
    session.delete(bot)
    session.commit()


@router.post("/{bot_id}/regenerate-key", response_model=BotCreateResponse)
def regenerate_key(
    bot_id: str,
    admin: User = Depends(_require_admin),
    session: Session = Depends(get_session),
):
    try:
        bid = uuid.UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bot ID")
    bot = session.get(BotAccount, bid)
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    full_key, key_prefix, key_hash = generate_api_key()
    bot.key_prefix = key_prefix
    bot.key_hash = key_hash
    bot.last_used_at = None
    session.add(bot)
    session.commit()
    session.refresh(bot)
    return BotCreateResponse(**bot.model_dump(), api_key=full_key)