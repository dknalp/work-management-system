import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user, require_permission, _get_role_permissions, is_admin
from ..models import Task, User
from ..schemas import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_permission("tasks:view")),
    session: Session = Depends(get_session),
):
    tasks = session.exec(
        select(Task).order_by(Task.updated_at.desc()).offset(offset).limit(limit)
    ).all()
    return tasks


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    current_user: User = Depends(require_permission("tasks:create")),
    session: Session = Depends(get_session),
):
    if body.assignees and not is_admin(current_user):
        perms = _get_role_permissions(current_user.role, session)
        if "tasks:assign" not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Görev atama yetkiniz yok")

    task = Task(
        id=body.id or f"TASK-{uuid.uuid4().hex[:8].upper()}",
        title=body.title,
        status=body.status,
        priority=body.priority,
        assignees=body.assignees,
        due_date=body.due_date,
        tags=body.tags or [],
        description=body.description,
        created_at=body.created_at or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not is_admin(current_user):
        perms = _get_role_permissions(current_user.role, session)
        can_edit_any = "tasks:edit_any" in perms
        can_edit_own = "tasks:edit_own" in perms and current_user.name in (task.assignees or [])
        if not (can_edit_any or can_edit_own):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok")

    data = body.model_dump(exclude_unset=True)

    if "assignees" in data and not is_admin(current_user):
        perms = _get_role_permissions(current_user.role, session)
        if "tasks:assign" not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Görev atama yetkiniz yok")

    new_status = data.get("status")
    if new_status == "done" and task.status != "done":
        task.completed_at = datetime.now(timezone.utc)
    elif new_status is not None and new_status != "done" and task.status == "done":
        task.completed_at = None

    for key, value in data.items():
        setattr(task, key, value)
    task.updated_at = datetime.now(timezone.utc)

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not is_admin(current_user):
        perms = _get_role_permissions(current_user.role, session)
        can_delete_any = "tasks:delete_any" in perms
        can_delete_own = "tasks:delete_own" in perms and current_user.name in (task.assignees or [])
        if not (can_delete_any or can_delete_own):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok")

    session.delete(task)
    session.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasks_bulk(
    ids: List[str],
    current_user: User = Depends(require_permission("tasks:delete_any")),
    session: Session = Depends(get_session),
):
    tasks = session.exec(select(Task).where(Task.id.in_(ids))).all()
    for task in tasks:
        session.delete(task)
    session.commit()