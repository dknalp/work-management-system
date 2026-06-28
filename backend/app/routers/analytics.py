from datetime import datetime
from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from ..database import get_session
from ..models import Task
from ..schemas import AnalyticsStats

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/stats", response_model=AnalyticsStats)
def get_stats(session: Session = Depends(get_session)):
    tasks = session.exec(select(Task)).all()

    today = datetime.utcnow().strftime("%Y-%m-%d")
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