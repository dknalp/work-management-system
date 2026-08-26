"""Analytics router — aggregated statistics derived from Firestore task documents.

All aggregation is done in-application (no SQL grouping).  This is acceptable
because the query pattern is already identical to the SQLModel version —
full-collection scans with in-memory counting.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from firebase_admin import firestore

from ..deps import require_permission
from ..firebase import get_db
from ..models import User
from ..schemas import AnalyticsDailyPoint, AnalyticsStats

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/stats", response_model=AnalyticsStats)
def get_stats(
    current_user: User = Depends(require_permission("analytics:view")),
    db: firestore.Client = Depends(get_db),
):
    """Return aggregate task counts and completion rate."""
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


@router.get("/daily", response_model=List[AnalyticsDailyPoint])
def get_daily(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(require_permission("analytics:view")),
    db: firestore.Client = Depends(get_db),
):
    """Return per-day created and completed task counts for the last N days."""
    tasks = [doc.to_dict() or {} for doc in db.collection("tasks").stream()]
    today = datetime.now(timezone.utc).date()

    result = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")

        created = sum(1 for t in tasks if t.get("created_at") == day_str)

        # completed_at may be a Firestore Timestamp or a datetime object
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

        result.append(AnalyticsDailyPoint(date=day_str, created=created, completed=completed))

    return result