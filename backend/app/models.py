"""
Pydantic models that mirror Firestore document schemas.

Each class maps one-to-one to a Firestore collection.  These models are used
for reading documents out of Firestore (via dict → model) and as the canonical
type definitions shared across routers.

Ownership rule: this module only defines data shapes.  Business logic,
validation rules, and Firestore query construction live in the routers.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Users ──────────────────────────────────────────────────────────────────────

class User(BaseModel):
    """An authenticated application user.  Document ID is the Firebase UID."""

    id: str
    """Firebase UID — also the Firestore document ID."""
    email: str
    name: str
    role: str = "member"
    """One of 'admin', 'manager', 'member'."""
    is_admin: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: Optional[str] = None
    """Hashed backend access token — never returned to clients."""
    refresh_token: Optional[str] = None
    """Hashed backend refresh token — never returned to clients."""

    model_config = {"from_attributes": True}


# ── Custom roles ───────────────────────────────────────────────────────────────

class CustomRole(BaseModel):
    """A user-defined role.  Document ID is the role name."""

    name: str
    """The role's unique identifier — used as the Firestore document ID."""
    display_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Role permissions ───────────────────────────────────────────────────────────

class RolePermission(BaseModel):
    """A single granted permission for a role.

    Document ID is ``{role}_{permission}`` for easy lookup.
    """

    role: str
    permission: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Task sub-documents ─────────────────────────────────────────────────────────

class SubTask(BaseModel):
    """A checklist item nested inside a Task."""

    id: str
    title: str
    completed: bool = False

    model_config = {"from_attributes": True}


class Reply(BaseModel):
    """A reply nested inside a Comment."""

    id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    body: str
    created_at: str
    """ISO datetime string."""

    model_config = {"from_attributes": True}


class Comment(BaseModel):
    """A comment thread entry nested inside a Task."""

    id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    body: str
    created_at: str
    """ISO datetime string."""
    replies: List[Reply] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ── Tasks ──────────────────────────────────────────────────────────────────────

class Task(BaseModel):
    """A work task. Document ID is a UUID string.

    assignees is the canonical plural field.  The legacy ``assignee`` scalar
    field (singular) is intentionally absent — any existing Firestore documents
    that still carry ``assignee`` must be read via the router's dict normalizer.
    """

    id: str
    title: str
    description: Optional[str] = None
    status: str = "todo"
    """One of 'todo', 'in-progress', 'done'."""
    priority: str = "medium"
    """One of 'low', 'medium', 'high'."""
    assignees: List[str] = Field(default_factory=list)
    """List of Firebase UIDs or display names assigned to this task."""
    due_date: Optional[str] = None
    """ISO date string 'YYYY-MM-DD'."""
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None
    """ISO date string or datetime string — used in analytics daily breakdown."""
    completed_at: Optional[str] = None
    """ISO datetime string — set when status transitions to 'done'."""
    updated_at: Optional[str] = None
    """ISO datetime string — updated on every mutation."""
    project_id: Optional[str] = None
    """ID of the parent Project, if any."""
    sub_tasks: List[SubTask] = Field(default_factory=list)
    """Checklist items.  Stored as an embedded array in the Task document."""
    comments: List[Comment] = Field(default_factory=list)
    """Comment thread.  Stored as an embedded array in the Task document."""

    model_config = {"from_attributes": True}


# ── Activity log ───────────────────────────────────────────────────────────────

class ActivityLog(BaseModel):
    """A single activity event. Document ID is a UUID string."""

    id: str
    type: str
    task_id: Optional[str] = None
    task_title: Optional[str] = None
    detail: Optional[str] = None
    timestamp: str
    """ISO datetime string — used for ordering."""
    user_id: str
    user_name: str

    model_config = {"from_attributes": True}


# ── Team members ───────────────────────────────────────────────────────────────

class TeamMember(BaseModel):
    """A team member record (not the same as a User). Document ID is a string."""

    id: str
    name: str
    email: str
    role: str
    status: str = "active"
    avatar: Optional[str] = None
    phone: Optional[str] = None
    joined_at: Optional[str] = None
    """ISO date string 'YYYY-MM-DD'."""
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Bot accounts ───────────────────────────────────────────────────────────────

class BotAccount(BaseModel):
    """A programmatic API actor. Document ID is a UUID string."""

    id: str
    name: str
    description: Optional[str] = None
    key_prefix: str
    """First 16 characters of the full API key — safe to expose."""
    key_hash: str
    """SHA-256 hash of the full API key — used for constant-time verification."""
    is_active: bool = True
    owner_id: str
    """Firebase UID of the user who created this bot."""
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Webhooks ───────────────────────────────────────────────────────────────────

class Webhook(BaseModel):
    """A webhook subscription owned by a bot. Document ID is a UUID string."""

    id: str
    bot_id: str
    url: str
    events: List[str] = Field(default_factory=list)
    secret: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat messages ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A chat message in a room. Document ID is a UUID string."""

    id: str
    room_id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Projects ───────────────────────────────────────────────────────────────────

class Project(BaseModel):
    """A user project. Document ID is the project's string ID."""

    id: str
    name: str
    slug: str
    color: str = "#6366f1"
    emoji: str = "📁"
    is_pinned: bool = False
    is_expanded: bool = True
    owner_id: str
    """Firebase UID of the owning user."""
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Pipelines ──────────────────────────────────────────────────────────────────

class Pipeline(BaseModel):
    """A pipeline within a project. Document ID is a UUID string."""

    id: str
    project_id: str
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Kanban boards ──────────────────────────────────────────────────────────────

class KanbanColumn(BaseModel):
    """A column in a kanban board."""

    id: str
    title: str

    model_config = {"from_attributes": True}


class KanbanBoard(BaseModel):
    """Persisted kanban board state for a pipeline.

    Document ID is the pipeline_id.  The tasks dict maps column_id → list of
    Task IDs (strings pointing to tasks/{id} documents in Firestore).
    """

    pipeline_id: str
    columns: List[KanbanColumn] = Field(default_factory=list)
    task_order: dict = Field(default_factory=dict)
    """Maps column_id → ordered list of task IDs."""
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}