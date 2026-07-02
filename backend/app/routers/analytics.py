from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..database import get_session
from ..deps import require_permission
from ..models import Task, User
from ..schemas import AnalyticsDailyPoint, AnalyticsStats

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/stats", response_model=AnalyticsStats)
def get_stats(
    current_user: User = Depends(require_permission("analytics:view")),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = len(tasks)
    todo = sum(1 for t in tasks if t.status == "todo")
    in_progress = sum(1 for t in tasks if t.status == "in-progress")
    done = sum(1 for t in tasks if t.status == "done")
    overdue = sum(
        1 for t in tasks
        if t.due_date and t.due_date < today and t.status != "done"
    )
    completion_rate = round((done / total * 100), 1) if total > 0 else 0.0

    return AnalyticsStats(
        total=total,
        todo=todo,
        in_progress=in_progress,
        done=done,
        overdue=overdue,
        completion_rate=completion_rate,
    )


@router.get("/daily", response_model=List[AnalyticsDailyPoint])
def get_daily(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(require_permission("analytics:view")),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()
    today = datetime.now(timezone.utc).date()

    result = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        created = sum(1 for t in tasks if t.created_at == day_str)
        completed = sum(
            1 for t in tasks
            if t.completed_at and t.completed_at.date() == day
        )
        result.append(AnalyticsDailyPoint(date=day_str, created=created, completed=completed))

    return result