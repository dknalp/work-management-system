"""Bots router — admin management of programmatic API actors (bot accounts).

Bot accounts authenticate with ``wms_live_*`` API keys instead of Firebase ID
tokens.  Admins create, list, update, and delete bots.  The full API key is
returned only on creation or regeneration — it is never stored or returned again.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import BotAccount, User
from ..schemas import BotCreate, BotResponse
from ..security import generate_api_key

router = APIRouter(prefix="/admin/bots", tags=["admin-bots"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that enforces admin-only access."""
    if not current_user.is_admin and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


def _doc_to_bot(doc_id: str, data: dict) -> BotAccount:
    """Convert a Firestore document dict to a ``BotAccount`` model."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return BotAccount(
        id=doc_id,
        name=data.get("name", ""),
        description=data.get("description"),
        key_prefix=data.get("key_prefix", ""),
        key_hash=data.get("key_hash", ""),
        is_active=data.get("is_active", True),
        owner_id=data.get("owner_id", ""),
        created_at=created_at,
        last_used_at=data.get("last_used_at"),
    )


@router.post("", response_model=BotResponse, status_code=status.HTTP_201_CREATED)
def create_bot(
    body: BotCreate,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Create a new bot account.

    Returns the full API key in ``full_key`` — this is the only time it is
    shown.  The caller must store it securely.
    """
    full_key, key_prefix, key_hash = generate_api_key()
    bot_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = {
        "name": body.name,
        "description": body.description,
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "is_active": True,
        "owner_id": admin.id,
        "created_at": now,
        "last_used_at": None,
    }
    db.collection("bot_accounts").document(bot_id).set(doc)

    return BotResponse(
        id=bot_id,
        name=body.name,
        description=body.description,
        key_prefix=key_prefix,
        is_active=True,
        owner_id=admin.id,
        created_at=now,
        full_key=full_key,
    )


@router.get("", response_model=list[BotResponse])
def list_bots(
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Return all bot accounts, most recently created first."""
    docs = db.collection("bot_accounts").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    result = []
    for doc in docs:
        bot = _doc_to_bot(doc.id, doc.to_dict() or {})
        result.append(BotResponse(
            id=bot.id,
            name=bot.name,
            description=bot.description,
            key_prefix=bot.key_prefix,
            is_active=bot.is_active,
            owner_id=bot.owner_id,
            created_at=bot.created_at,
            last_used_at=bot.last_used_at,
        ))
    return result


@router.get("/{bot_id}", response_model=BotResponse)
def get_bot(
    bot_id: str,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Return a single bot account by ID."""
    doc = db.collection("bot_accounts").document(bot_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found.")
    bot = _doc_to_bot(doc.id, doc.to_dict() or {})
    return BotResponse(
        id=bot.id,
        name=bot.name,
        description=bot.description,
        key_prefix=bot.key_prefix,
        is_active=bot.is_active,
        owner_id=bot.owner_id,
        created_at=bot.created_at,
        last_used_at=bot.last_used_at,
    )


@router.patch("/{bot_id}", response_model=BotResponse)
def update_bot(
    bot_id: str,
    body: BotCreate,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Update a bot account's name and/or description."""
    doc_ref = db.collection("bot_accounts").document(bot_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found.")

    updates: dict = {}
    if body.name:
        updates["name"] = body.name
    if body.description is not None:
        updates["description"] = body.description

    if updates:
        doc_ref.update(updates)

    data = {**(doc.to_dict() or {}), **updates}
    bot = _doc_to_bot(bot_id, data)
    return BotResponse(
        id=bot.id,
        name=bot.name,
        description=bot.description,
        key_prefix=bot.key_prefix,
        is_active=bot.is_active,
        owner_id=bot.owner_id,
        created_at=bot.created_at,
        last_used_at=bot.last_used_at,
    )


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bot(
    bot_id: str,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Permanently delete a bot account and all its webhooks."""
    doc = db.collection("bot_accounts").document(bot_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found.")

    # Delete associated webhooks
    wh_docs = db.collection("webhooks").where("bot_id", "==", bot_id).stream()
    for wh_doc in wh_docs:
        wh_doc.reference.delete()

    db.collection("bot_accounts").document(bot_id).delete()


@router.post("/{bot_id}/regenerate-key", response_model=BotResponse)
def regenerate_key(
    bot_id: str,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Regenerate the API key for a bot account.

    Invalidates the old key immediately.  Returns the new full key in
    ``full_key`` — this is the only time it is shown.
    """
    doc_ref = db.collection("bot_accounts").document(bot_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found.")

    full_key, key_prefix, key_hash = generate_api_key()
    doc_ref.update({
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "last_used_at": None,
    })

    data = {**(doc.to_dict() or {}), "key_prefix": key_prefix, "key_hash": key_hash}
    bot = _doc_to_bot(bot_id, data)
    return BotResponse(
        id=bot.id,
        name=bot.name,
        description=bot.description,
        key_prefix=bot.key_prefix,
        is_active=bot.is_active,
        owner_id=bot.owner_id,
        created_at=bot.created_at,
        full_key=full_key,
    )