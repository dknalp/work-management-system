"""v1 Activity router — public versioned API for the activity feed.

Accepts both user and bot actors.  The ``user_id``/``user_name`` fields are
always derived from the authenticated actor, never from the request body.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ...deps import Actor, get_current_actor
from ...firebase import get_db
from ...models import BotAccount, User
from ...schemas import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["v1-activity"])


def _doc_to_response(doc_id: str, data: dict) -> ActivityResponse:
    """Convert a Firestore activity_logs document dict to an ``ActivityResponse``."""
    return ActivityResponse(
        id=doc_id,
        type=data.get("type", ""),
        task_id=data.get("task_id", ""),
        task_title=data.get("task_title", ""),
        detail=data.get("detail"),
        timestamp=data.get("timestamp", ""),
        user_id=data.get("user_id"),
        user_name=data.get("user_name"),
    )


@router.get("", response_model=List[ActivityResponse])
def list_activity(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Return activity log entries, most recent first, with limit/offset pagination."""
    docs = (
        db.collection("activity_logs")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .offset(offset)
        .limit(limit)
        .stream()
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    body: ActivityCreate,
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Append a new activity entry.

    The actor identity (user or bot) is always resolved from the token —
    client-provided ``user_id`` and ``user_name`` fields are ignored.
    """
    if isinstance(actor, BotAccount):
        actor_id = str(actor.id)
        actor_name = f"bot:{actor.name}"
    else:
        actor_id = str(actor.id)
        actor_name = actor.name

    entry_id = body.id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    entry_data = {
        "id": entry_id,
        "type": body.type,
        "task_id": body.task_id,
        "task_title": body.task_title,
        "detail": body.detail,
        "timestamp": now,
        "user_id": actor_id,
        "user_name": actor_name,
    }
    db.collection("activity_logs").document(entry_id).set(entry_data)
    return _doc_to_response(entry_id, entry_data)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_activity(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
):
    """Clear all activity log entries.  Requires an admin user."""
    if not (isinstance(actor, User) and (actor.is_admin or actor.role == "admin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only.")

    # Batch-delete in pages of 500 (Firestore batch write limit)
    PAGE = 500
    while True:
        docs = list(db.collection("activity_logs").limit(PAGE).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()