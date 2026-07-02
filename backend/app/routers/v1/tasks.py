import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import BotAccount, Task, User
from ...schemas import TaskCreate, TaskResponse, TaskUpdate
from ...webhooks import fire_webhooks

router = APIRouter(prefix="/tasks", tags=["v1-tasks"])


def _actor_name(actor: Actor) -> str:
    if isinstance(actor, BotAccount):
        return f"bot:{actor.name}"
    return actor.name


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    assignee: Optional[str] = Query(default=None),
    project_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    q = select(Task)
    if status_filter:
        q = q.where(Task.status == status_filter)
    if priority:
        q = q.where(Task.priority == priority)
    if assignee:
        q = q.where(Task.assignees.contains(assignee))
    if project_id:
        q = q.where(Task.project_id == project_id)
    tasks = session.exec(q.order_by(Task.updated_at.desc()).offset(offset).limit(limit)).all()
    return tasks


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    task = Task(
        id=body.id or f"TASK-{uuid.uuid4().hex[:8].upper()}",
        title=body.title,
        status=body.status,
        priority=body.priority,
        assignees=body.assignees,
        due_date=body.due_date,
        tags=body.tags or [],
        description=body.description,
        project_id=body.project_id,
        created_at=body.created_at or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    background_tasks.add_task(fire_webhooks, "task.created", task.model_dump(), session)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def replace_task(
    task_id: str,
    body: TaskCreate,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.title = body.title
    task.status = body.status
    task.priority = body.priority
    task.assignees = body.assignees
    task.due_date = body.due_date
    task.tags = body.tags or []
    task.description = body.description
    task.project_id = body.project_id
    task.updated_at = datetime.now(timezone.utc)

    if body.status == "done" and task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)
    elif body.status != "done":
        task.completed_at = None

    session.add(task)
    session.commit()
    session.refresh(task)
    background_tasks.add_task(fire_webhooks, "task.updated", task.model_dump(), session)
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    body: TaskUpdate,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    data = body.model_dump(exclude_unset=True)
    new_status = data.get("status")
    if new_status == "done" and task.status != "done":
        task.completed_at = datetime.now(timezone.utc)
    elif new_status is not None and new_status != "done":
        task.completed_at = None

    for key, value in data.items():
        setattr(task, key, value)
    task.updated_at = datetime.now(timezone.utc)

    session.add(task)
    session.commit()
    session.refresh(task)
    background_tasks.add_task(fire_webhooks, "task.updated", task.model_dump(), session)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    payload = task.model_dump()
    session.delete(task)
    session.commit()
    background_tasks.add_task(fire_webhooks, "task.deleted", payload, session)


class BulkDeleteBody(BaseModel):
    ids: List[str]


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_tasks(
    body: BulkDeleteBody,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    for task_id in body.ids:
        task = session.get(Task, task_id)
        if task:
            payload = task.model_dump()
            session.delete(task)
            background_tasks.add_task(fire_webhooks, "task.deleted", payload, session)
    session.commit()
