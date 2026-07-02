import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc

from ..database import get_session
from ..deps import get_current_user, require_permission
from ..models import ActivityLog, User
from ..schemas import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=List[ActivityResponse])
def list_activity(
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    entries = session.exec(
        select(ActivityLog)
        .order_by(desc(ActivityLog.timestamp))
        .offset(offset)
        .limit(limit)
    ).all()
    return entries


@router.post("", response_model=ActivityResponse, status_code=201)
def create_activity(
    body: ActivityCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    entry = ActivityLog(
        id=body.id or str(uuid.uuid4()),
        type=body.type,
        task_id=body.task_id,
        task_title=body.task_title,
        detail=body.detail,
        timestamp=datetime.now(timezone.utc).isoformat(),
        user_id=str(current_user.id),
        user_name=current_user.name,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("", status_code=204)
def clear_activity(
    current_user: User = Depends(require_permission("admin:view")),
    session: Session = Depends(get_session),
):
    entries = session.exec(select(ActivityLog)).all()
    for e in entries:
        session.delete(e)
    session.commit()