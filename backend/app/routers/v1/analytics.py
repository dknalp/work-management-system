from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import Task
from ...schemas import AnalyticsDailyPoint, AnalyticsStats

router = APIRouter(prefix="/analytics", tags=["v1-analytics"])


@router.get("/summary", response_model=AnalyticsStats)
def get_summary(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = len(tasks)
    todo = sum(1 for t in tasks if t.status == "todo")
    in_progress = sum(1 for t in tasks if t.status == "in-progress")
    done = sum(1 for t in tasks if t.status == "done")
    overdue = sum(1 for t in tasks if t.due_date and t.due_date < today and t.status != "done")
    completion_rate = round((done / total * 100), 1) if total > 0 else 0.0
    return AnalyticsStats(
        total=total, todo=todo, in_progress=in_progress,
        done=done, overdue=overdue, completion_rate=completion_rate,
    )


@router.get("/tasks-by-status")
def tasks_by_status(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()
    counts: dict[str, int] = {}
    for t in tasks:
        counts[t.status] = counts.get(t.status, 0) + 1
    return counts


@router.get("/tasks-by-priority")
def tasks_by_priority(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()
    counts: dict[str, int] = {}
    for t in tasks:
        counts[t.priority] = counts.get(t.priority, 0) + 1
    return counts


@router.get("/daily", response_model=List[AnalyticsDailyPoint])
def daily_stats(
    days: int = Query(default=7, ge=1, le=90),
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task)).all()
    today = datetime.now(timezone.utc)
    points = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        created = sum(1 for t in tasks if t.created_at == day_str)
        completed = sum(
            1 for t in tasks
            if t.completed_at and t.completed_at.strftime("%Y-%m-%d") == day_str
        )
        points.append(AnalyticsDailyPoint(date=day_str, created=created, completed=completed))
    return points
