"""Tasks router — CRUD operations for work tasks.

RBAC is enforced for create, edit, and delete operations.  Admins bypass all
permission checks.  Non-admin edit/delete rights depend on whether the user is
assigned to the task and their role's granted permissions.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ..deps import _get_role_permissions, get_current_user, require_permission
from ..firebase import get_db
from ..models import User
from ..schemas import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _is_admin(user: User) -> bool:
    return user.is_admin or user.role == "admin"


def _doc_to_response(doc_id: str, data: dict) -> TaskResponse:
    """Convert a Firestore task document dict to a ``TaskResponse``.

    Handles the legacy ``assignee`` scalar field that predates the current
    ``assignees`` list — any document that still carries the old shape is
    normalised transparently.
    """
    # Normalise legacy scalar assignee → list.
    assignees = data.get("assignees")
    if assignees is None:
        legacy = data.get("assignee")
        assignees = [legacy] if legacy else []

    return TaskResponse(
        id=doc_id,
        title=data.get("title", ""),
        status=data.get("status", "todo"),
        priority=data.get("priority", "medium"),
        assignees=assignees,
        due_date=data.get("due_date"),
        tags=data.get("tags"),
        description=data.get("description"),
        completed_at=data.get("completed_at"),
        updated_at=data.get("updated_at"),
        project_id=data.get("project_id"),
        created_at=data.get("created_at", ""),
        sub_tasks=data.get("sub_tasks", []),
        comments=data.get("comments", []),
    )


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_permission("tasks:view")),
    db: firestore.Client = Depends(get_db),
):
    """Return tasks ordered by updated_at descending, with limit/offset pagination."""
    query = (
        db.collection("tasks")
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .offset(offset)
        .limit(limit)
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in query.stream()]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    current_user: User = Depends(require_permission("tasks:create")),
    db: firestore.Client = Depends(get_db),
):
    """Create a new task.

    Non-admin users need ``tasks:assign`` permission to set assignees.
    """
    if body.assignees and not _is_admin(current_user):
        perms = _get_role_permissions(current_user.role, db)
        if "tasks:assign" not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to assign tasks.",
            )

    # Always generate IDs server-side — never trust a client-supplied ID.
    task_id = f"TASK-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    task_data = {
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
    }
    db.collection("tasks").document(task_id).set(task_data)
    return _doc_to_response(task_id, task_data)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Update a task.

    Admins may edit any task.  Non-admins need ``tasks:edit_any`` or
    (``tasks:edit_own`` and be assigned to the task).
    """
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", task_id):
        raise HTTPException(status_code=422, detail="Invalid task ID format.")
    doc_ref = db.collection("tasks").document(task_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    data = doc.to_dict() or {}

    if not _is_admin(current_user):
        perms = _get_role_permissions(current_user.role, db)
        can_edit_any = "tasks:edit_any" in perms
        can_edit_own = "tasks:edit_own" in perms and str(current_user.id) in (data.get("assignees") or [])
        if not (can_edit_any or can_edit_own):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this task.",
            )

    updates = body.model_dump(exclude_unset=True)

    if "assignees" in updates and not _is_admin(current_user):
        perms = _get_role_permissions(current_user.role, db)
        if "tasks:assign" not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to reassign tasks.",
            )

    # Track completion timestamp
    new_status = updates.get("status")
    now = datetime.now(timezone.utc)
    if new_status == "done" and data.get("status") != "done":
        updates["completed_at"] = now
    elif new_status is not None and new_status != "done" and data.get("status") == "done":
        updates["completed_at"] = None

    updates["updated_at"] = now
    doc_ref.update(updates)

    merged = {**data, **updates}
    return _doc_to_response(task_id, merged)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Delete a single task.

    Admins may delete any task.  Non-admins need ``tasks:delete_any`` or
    (``tasks:delete_own`` and be assigned to the task).
    """
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", task_id):
        raise HTTPException(status_code=422, detail="Invalid task ID format.")
    doc_ref = db.collection("tasks").document(task_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    data = doc.to_dict() or {}

    if not _is_admin(current_user):
        perms = _get_role_permissions(current_user.role, db)
        can_delete_any = "tasks:delete_any" in perms
        can_delete_own = "tasks:delete_own" in perms and str(current_user.id) in (data.get("assignees") or [])
        if not (can_delete_any or can_delete_own):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this task.",
            )

    doc_ref.delete()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasks_bulk(
    ids: List[str],
    current_user: User = Depends(require_permission("tasks:delete_any")),
    db: firestore.Client = Depends(get_db),
):
    """Bulk delete tasks by IDs.  Requires ``tasks:delete_any`` permission."""
    batch = db.batch()
    for task_id in ids:
        batch.delete(db.collection("tasks").document(task_id))
    batch.commit()