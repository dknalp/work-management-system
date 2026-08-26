"""
Versioned task API for the frontend client.

Owns all task CRUD plus nested comment and sub-task mutations.
All data is persisted to the Firestore ``tasks`` collection; there is no
localStorage fallback anywhere in this layer.

Canonical task document schema (Firestore):
  id              string   — UUID, document ID
  title           string
  description     string?
  status          "todo" | "in-progress" | "done"
  priority        "low" | "medium" | "high"
  assignees       string[]  — display names or UIDs
  due_date        string?   — "YYYY-MM-DD"
  tags            string[]
  created_at      string    — ISO datetime
  completed_at    string?   — ISO datetime, set when status → "done"
  updated_at      string    — ISO datetime, updated on every write
  project_id      string?
  sub_tasks       SubTask[] — embedded array
  comments        Comment[] — embedded array (each Comment embeds Reply[])
"""

from datetime import datetime, timezone
from typing import Any
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from ...deps import Actor, get_current_actor
from ...firebase import get_db
from ...schemas import (
    CommentCreate,
    CommentResponse,
    ReplyCreate,
    ReplyResponse,
    SubTaskCreate,
    SubTaskResponse,
    SubTaskUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["v1-tasks"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _normalize_task(doc_id: str, data: dict) -> dict:
    """Normalise a raw Firestore task document into the canonical shape.

    Handles legacy documents that stored a single ``assignee`` scalar instead
    of the current ``assignees`` list.
    """
    if "assignees" not in data and "assignee" in data:
        raw = data.pop("assignee")
        data["assignees"] = [raw] if raw else []

    data.setdefault("assignees", [])
    data.setdefault("tags", [])
    data.setdefault("sub_tasks", [])
    data.setdefault("comments", [])
    data.setdefault("id", doc_id)
    return data


def _get_task_or_404(db: Any, task_id: str) -> dict:
    """Fetch a Firestore task document or raise 404."""
    doc = db.collection("tasks").document(task_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _normalize_task(doc.id, doc.to_dict())


# ── Task CRUD ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TaskResponse])
def list_tasks(
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Return all tasks visible to the authenticated actor.

    Currently returns every task in the collection; scope filtering (by project,
    by assignee) can be added here without breaking clients.
    """
    docs = db.collection("tasks").stream()
    tasks = []
    for doc in docs:
        raw = doc.to_dict()
        tasks.append(TaskResponse(**_normalize_task(doc.id, raw)))
    return tasks


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Create a new task and persist it to Firestore.

    The task ID is always generated server-side so clients cannot inject
    arbitrary IDs.
    """
    task_id = str(uuid.uuid4())
    now = _now_iso()
    doc: dict[str, Any] = {
        "id": task_id,
        "title": body.title,
        "description": body.description,
        "status": body.status,
        "priority": body.priority,
        "assignees": body.assignees,
        "due_date": body.due_date,
        "tags": body.tags or [],
        "created_at": body.created_at or now,
        "completed_at": None,
        "updated_at": now,
        "project_id": body.project_id,
        "sub_tasks": [],
        "comments": [],
    }
    db.collection("tasks").document(task_id).set(doc)
    return TaskResponse(**doc)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Return a single task by ID."""
    data = _get_task_or_404(db, task_id)
    return TaskResponse(**data)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    body: TaskUpdate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Partially update a task.

    Only fields present in the request body are updated.  ``completed_at`` is
    set automatically when ``status`` transitions to ``'done'`` and the caller
    did not supply it explicitly.
    """
    data = _get_task_or_404(db, task_id)
    updates: dict[str, Any] = {}

    for field in ("title", "description", "status", "priority", "assignees",
                  "due_date", "tags", "project_id"):
        value = getattr(body, field)
        if value is not None:
            updates[field] = value

    # Auto-stamp completed_at when transitioning to done.
    if body.completed_at is not None:
        updates["completed_at"] = body.completed_at
    elif body.status == "done" and not data.get("completed_at"):
        updates["completed_at"] = _now_iso()
    elif body.status in ("todo", "in-progress"):
        # Clear completed_at if the task is moved back out of done.
        updates["completed_at"] = None

    updates["updated_at"] = _now_iso()

    db.collection("tasks").document(task_id).update(updates)
    data.update(updates)
    return TaskResponse(**data)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Permanently delete a task."""
    _get_task_or_404(db, task_id)
    db.collection("tasks").document(task_id).delete()


# ── Sub-tasks ──────────────────────────────────────────────────────────────────

@router.post("/{task_id}/subtasks", response_model=SubTaskResponse, status_code=status.HTTP_201_CREATED)
def add_subtask(
    task_id: str,
    body: SubTaskCreate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Append a new sub-task to an existing task."""
    data = _get_task_or_404(db, task_id)
    subtask = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "completed": False,
    }
    sub_tasks = data.get("sub_tasks", [])
    sub_tasks.append(subtask)
    now = _now_iso()
    db.collection("tasks").document(task_id).update({
        "sub_tasks": sub_tasks,
        "updated_at": now,
    })
    return SubTaskResponse(**subtask)


@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubTaskResponse)
def update_subtask(
    task_id: str,
    subtask_id: str,
    body: SubTaskUpdate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Update a single sub-task's title or completion state."""
    data = _get_task_or_404(db, task_id)
    sub_tasks: list[dict] = data.get("sub_tasks", [])

    target = next((s for s in sub_tasks if s["id"] == subtask_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-task not found")

    if body.title is not None:
        target["title"] = body.title
    if body.completed is not None:
        target["completed"] = body.completed

    now = _now_iso()
    db.collection("tasks").document(task_id).update({
        "sub_tasks": sub_tasks,
        "updated_at": now,
    })
    return SubTaskResponse(**target)


@router.delete("/{task_id}/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(
    task_id: str,
    subtask_id: str,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Remove a sub-task from a task."""
    data = _get_task_or_404(db, task_id)
    sub_tasks = [s for s in data.get("sub_tasks", []) if s["id"] != subtask_id]
    db.collection("tasks").document(task_id).update({
        "sub_tasks": sub_tasks,
        "updated_at": _now_iso(),
    })


# ── Comments ───────────────────────────────────────────────────────────────────

@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
    task_id: str,
    body: CommentCreate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Add a comment to a task.

    The author identity is taken from the authenticated actor so it cannot be
    spoofed by the client.
    """
    from ...models import User, BotAccount

    data = _get_task_or_404(db, task_id)
    comment: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "author_id": str(actor.id),
        "author_name": actor.name,
        "author_avatar": actor.avatar_url if isinstance(actor, User) else None,
        "body": body.body,
        "created_at": _now_iso(),
        "replies": [],
    }
    comments = data.get("comments", [])
    comments.append(comment)
    db.collection("tasks").document(task_id).update({
        "comments": comments,
        "updated_at": _now_iso(),
    })
    return CommentResponse(**comment)


@router.delete("/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    task_id: str,
    comment_id: str,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Delete a comment.

    Only the comment's author or an admin may delete it.
    """
    from ...models import User

    data = _get_task_or_404(db, task_id)
    comments: list[dict] = data.get("comments", [])

    target = next((c for c in comments if c["id"] == comment_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    is_admin = isinstance(actor, User) and (actor.is_admin or actor.role == "admin")
    if target["author_id"] != str(actor.id) and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the comment author")

    updated = [c for c in comments if c["id"] != comment_id]
    db.collection("tasks").document(task_id).update({
        "comments": updated,
        "updated_at": _now_iso(),
    })


# ── Comment replies ────────────────────────────────────────────────────────────

@router.post("/{task_id}/comments/{comment_id}/replies", response_model=ReplyResponse, status_code=status.HTTP_201_CREATED)
def add_reply(
    task_id: str,
    comment_id: str,
    body: ReplyCreate,
    actor: Actor = Depends(get_current_actor),
    db=Depends(get_db),
):
    """Append a reply to an existing comment."""
    from ...models import User

    data = _get_task_or_404(db, task_id)
    comments: list[dict] = data.get("comments", [])

    target = next((c for c in comments if c["id"] == comment_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    reply: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "author_id": str(actor.id),
        "author_name": actor.name,
        "author_avatar": actor.avatar_url if isinstance(actor, User) else None,
        "body": body.body,
        "created_at": _now_iso(),
    }
    target.setdefault("replies", []).append(reply)

    db.collection("tasks").document(task_id).update({
        "comments": comments,
        "updated_at": _now_iso(),
    })
    return ReplyResponse(**reply)