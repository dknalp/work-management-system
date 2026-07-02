import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, desc, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import ActivityLog, BotAccount, User
from ...schemas import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["v1-activity"])


@router.get("", response_model=List[ActivityResponse])
def list_activity(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    entries = session.exec(
        select(ActivityLog)
        .order_by(desc(ActivityLog.timestamp))
        .offset(offset)
        .limit(limit)
    ).all()
    return entries


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    body: ActivityCreate,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    if isinstance(actor, BotAccount):
        actor_id = str(actor.id)
        actor_name = f"bot:{actor.name}"
    else:
        actor_id = str(actor.id)
        actor_name = actor.name

    entry = ActivityLog(
        id=body.id or str(uuid.uuid4()),
        type=body.type,
        task_id=body.task_id,
        task_title=body.task_title,
        detail=body.detail,
        timestamp=datetime.now(timezone.utc).isoformat(),
        user_id=actor_id,
        user_name=actor_name,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_activity(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    if not (isinstance(actor, User) and (actor.is_admin or actor.role == "admin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    session.exec(select(ActivityLog)).all()
    for entry in session.exec(select(ActivityLog)).all():
        session.delete(entry)
    session.commit()
