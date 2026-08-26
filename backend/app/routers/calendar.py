"""Calendar events router — user-owned calendar event management.

Each event belongs to the creating user (owner_id = Firebase UID).  Users can
only read, update, or delete their own events.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate

router = APIRouter(tags=["calendar"])


def _doc_to_response(doc_id: str, data: dict) -> CalendarEventResponse:
    """Convert a Firestore calendar_events document dict to a ``CalendarEventResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return CalendarEventResponse(
        id=doc_id,
        title=data.get("title", ""),
        date=data.get("date", ""),
        time=data.get("time"),
        priority=data.get("priority", "medium"),
        remind=data.get("remind", False),
        assignee_names=data.get("assignee_names"),
        created_at=created_at,
    )


@router.get("", response_model=List[CalendarEventResponse])
def list_events(
    date: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Return calendar events for the current user, optionally filtered by date."""
    query = (
        db.collection("calendar_events")
        .where("owner_id", "==", current_user.id)
        .order_by("date")
        .limit(500)
    )
    if date:
        query = query.where("date", "==", date)

    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in query.stream()]


@router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    body: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Create a new calendar event for the current user."""
    # Always generate IDs server-side — never trust a client-supplied ID.
    event_id = f"evt-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    data = {
        "title": body.title,
        "date": body.date,
        "time": body.time,
        "priority": body.priority,
        "remind": body.remind,
        "assignee_names": body.assignee_names or [],
        "owner_id": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("calendar_events").document(event_id).set(data)
    return _doc_to_response(event_id, data)


@router.put("/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: str,
    body: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Update a calendar event.  Only the owning user may update."""
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", event_id):
        raise HTTPException(status_code=422, detail="Invalid event ID format.")
    doc_ref = db.collection("calendar_events").document(event_id)
    doc = doc_ref.get()
    if not doc.exists or (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc_ref.update(updates)

    merged = {**(doc.to_dict() or {}), **updates}
    return _doc_to_response(event_id, merged)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Delete a calendar event.  Only the owning user may delete."""
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", event_id):
        raise HTTPException(status_code=422, detail="Invalid event ID format.")
    doc = db.collection("calendar_events").document(event_id).get()
    if not doc.exists or (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    db.collection("calendar_events").document(event_id).delete()