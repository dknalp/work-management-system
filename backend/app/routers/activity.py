import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc

from ..database import get_session
from ..models import ActivityLog
from ..schemas import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=List[ActivityResponse])
def list_activity(
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
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
def create_activity(body: ActivityCreate, session: Session = Depends(get_session)):
    entry = ActivityLog(
        id=body.id or str(uuid.uuid4()),
        type=body.type,
        task_id=body.task_id,
        task_title=body.task_title,
        detail=body.detail,
        timestamp=body.timestamp or datetime.utcnow().isoformat(),
        user_id=body.user_id,
        user_name=body.user_name,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("", status_code=204)
def clear_activity(session: Session = Depends(get_session)):
    entries = session.exec(select(ActivityLog)).all()
    for e in entries:
        session.delete(e)
    session.commit()