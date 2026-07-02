import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import CalendarEvent, User
from ..schemas import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate

router = APIRouter(prefix="/calendar-events", tags=["calendar"])


@router.get("", response_model=List[CalendarEventResponse])
def list_events(
    date: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(CalendarEvent).where(CalendarEvent.owner_id == current_user.id)
    if date:
        query = query.where(CalendarEvent.date == date)
    events = session.exec(query.order_by(CalendarEvent.date.asc())).all()
    return events


@router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    body: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    event = CalendarEvent(
        id=body.id or f"evt-{uuid.uuid4().hex[:8]}",
        title=body.title,
        date=body.date,
        time=body.time,
        priority=body.priority,
        remind=body.remind,
        assignee_names=body.assignee_names or [],
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.put("/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: str,
    body: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    event = session.get(CalendarEvent, event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(event, key, value)
    event.updated_at = datetime.now(timezone.utc)

    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    event = session.get(CalendarEvent, event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    session.delete(event)
    session.commit()
