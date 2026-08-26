"""v1 Tasks router — public versioned API for task CRUD.

Accepts both Firebase ID tokens (user) and bot API keys (bot) for all
read operations.  Write operations require a user actor and RBAC checks.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ...deps import Actor, get_current_actor, get_current_user, require_permission, _get_role_permissions
from ...firebase import get_db
from ...models import BotAccount, User
from ...schemas import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["v1-tasks"])


def _doc_to_response(doc_id: str, data: dict) -> TaskResponse:
    """Convert a Firestore tasks document dict to a ``TaskResponse``."""
    return TaskResponse(
        id=doc_id,
        title=data.get("title", ""),
        status=data.get("status", "todo"),
        priority=data.get("priority", "medium"),
        assignees=data.get("assignees", []),
        due_date=data.get("due_date"),
        tags=data.get("tags"),
        description=data.get("description"),
        completed_at=data.get("completed_at"),
        project_id=data.get("project_id"),
        created_at=data.get("created_at", ""),
    )


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    status_filter: str = Query(default=None, alias="status"),
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("tasks:view")),
):
    """Return tasks with optional status filter, paginated."""
    query = db.collection("tasks")
    if status_filter:
        query = query.where("status", "==", status_filter)
    docs = query.offset(offset).limit(limit).stream()
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("tasks:view")),
):
    """Return a single task by ID."""
    doc = db.collection("tasks").document(task_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return _doc_to_response(doc.id, doc.to_dict() or {})


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
    _perm: None = Depends(require_permission("tasks:create")),
):
    """Create a new task."""
    task_id = body.id or f"TASK-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    data = {
        "id": task_id,
        "title": body.title,
        "status": body.status,
        "priority": body.priority,
        "assignees": body.assignees,
        "due_date": body.due_date,
        "tags": body.tags or [],
        "description": body.description,
        "project_id": body.project_id,
        "created_at": body.created_at or now.strftime("%Y-%m-%d"),
        "updated_at": now,
        "completed_at": None,
        # Record creator so ownership checks work on update/delete.
        "created_by": actor.id if isinstance(actor, User) else None,
    }
    db.collection("tasks").document(task_id).set(data)
    return _doc_to_response(task_id, data)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    body: TaskUpdate,
    actor: Actor = Depends(get_current_actor),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Update an existing task.

    Admins may edit any task.  Non-admins need ``tasks:edit_any`` or must
    own the task (``created_by`` matches their user ID).
    """
    doc_ref = db.collection("tasks").document(task_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    task_data = doc.to_dict() or {}

    # Ownership / permission check: allow edit if user owns the task or has edit_any.
    if not (current_user.is_admin or current_user.role == "admin"):
        role_perms = _get_role_permissions(current_user.role, db)
        has_edit_any = "tasks:edit_any" in role_perms
        is_owner = task_data.get("created_by") == str(current_user.id)
        if not has_edit_any and not is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    updates = body.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)

    # Track completion timestamp
    new_status = updates.get("status")
    if new_status == "done" and task_data.get("status") != "done":
        updates["completed_at"] = now
    elif new_status is not None and new_status != "done" and task_data.get("status") == "done":
        updates["completed_at"] = None

    updates["updated_at"] = now
    doc_ref.update(updates)
    return _doc_to_response(task_id, {**task_data, **updates})


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Delete a task.

    Admins may delete any task.  Non-admins need ``tasks:edit_any`` or must
    own the task (``created_by`` matches their user ID).
    """
    doc = db.collection("tasks").document(task_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    task_data = doc.to_dict() or {}

    # Ownership / permission check: allow delete if user owns the task or has edit_any.
    if not (current_user.is_admin or current_user.role == "admin"):
        role_perms = _get_role_permissions(current_user.role, db)
        has_edit_any = "tasks:edit_any" in role_perms
        is_owner = task_data.get("created_by") == str(current_user.id)
        if not has_edit_any and not is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    db.collection("tasks").document(task_id).delete()