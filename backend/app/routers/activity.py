"""Activity log router — creates and retrieves the activity feed.

Activity entries are append-only; the only destructive operation is the
admin-only ``DELETE /activity`` which clears the entire log.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ..deps import get_current_user, require_permission
from ..firebase import get_db
from ..models import User
from ..schemas import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["activity"])


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
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Append a new activity entry.

    The ``user_id`` and ``user_name`` are always taken from the authenticated
    actor, ignoring any values in the request body.
    """
    entry_id = body.id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    entry_data = {
        "id": entry_id,
        "type": body.type,
        "task_id": body.task_id,
        "task_title": body.task_title,
        "detail": body.detail,
        "timestamp": now,
        "user_id": current_user.id,
        "user_name": current_user.name,
    }
    db.collection("activity_logs").document(entry_id).set(entry_data)
    return _doc_to_response(entry_id, entry_data)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_activity(
    current_user: User = Depends(require_permission("admin:view")),
    db: firestore.Client = Depends(get_db),
):
    """Clear all activity log entries.  Requires admin-level permission."""
    # Firestore does not support truncating a collection in one call —
    # batch-delete in pages of 500 (Firestore batch write limit).
    PAGE = 500
    while True:
        docs = list(db.collection("activity_logs").limit(PAGE).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()