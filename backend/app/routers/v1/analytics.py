"""v1 Analytics router — public versioned API for task analytics.

Accepts both user and bot actors.  All aggregation is in-application.
Requires ``analytics:view`` RBAC permission on every endpoint.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from firebase_admin import firestore

from ...deps import Actor, get_current_actor, require_permission
from ...firebase import get_db
from ...schemas import AnalyticsDailyPoint, AnalyticsStats

router = APIRouter(prefix="/analytics", tags=["v1-analytics"])


@router.get("/summary", response_model=AnalyticsStats)
def get_summary(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("analytics:view")),
):
    """Return aggregate task statistics."""
    tasks = [doc.to_dict() or {} for doc in db.collection("tasks").stream()]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total = len(tasks)
    todo = sum(1 for t in tasks if t.get("status") == "todo")
    in_progress = sum(1 for t in tasks if t.get("status") == "in-progress")
    done = sum(1 for t in tasks if t.get("status") == "done")
    overdue = sum(
        1 for t in tasks
        if t.get("due_date") and t["due_date"] < today and t.get("status") != "done"
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


@router.get("/tasks-by-status")
def tasks_by_status(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("analytics:view")),
) -> dict:
    """Return a dict of status → count."""
    tasks = [doc.to_dict() or {} for doc in db.collection("tasks").stream()]
    counts: dict[str, int] = {}
    for t in tasks:
        s = t.get("status", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return counts


@router.get("/tasks-by-priority")
def tasks_by_priority(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("analytics:view")),
) -> dict:
    """Return a dict of priority → count."""
    tasks = [doc.to_dict() or {} for doc in db.collection("tasks").stream()]
    counts: dict[str, int] = {}
    for t in tasks:
        p = t.get("priority", "unknown")
        counts[p] = counts.get(p, 0) + 1
    return counts


@router.get("/daily", response_model=List[AnalyticsDailyPoint])
def daily_stats(
    days: int = Query(default=7, ge=1, le=90),
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("analytics:view")),
):
    """Return per-day created and completed task counts for the last N days."""
    tasks = [doc.to_dict() or {} for doc in db.collection("tasks").stream()]
    today = datetime.now(timezone.utc).date()
    points = []

    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")

        created = sum(1 for t in tasks if t.get("created_at") == day_str)

        completed = 0
        for t in tasks:
            raw = t.get("completed_at")
            if raw is None:
                continue
            if isinstance(raw, datetime):
                if raw.date() == day:
                    completed += 1
            elif hasattr(raw, "date"):
                # Firestore Timestamp from server
                if raw.date() == day:
                    completed += 1

        points.append(AnalyticsDailyPoint(date=day_str, created=created, completed=completed))

    return points