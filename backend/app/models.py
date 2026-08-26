"""Data models for the work-management-system backend.

These are plain Pydantic ``BaseModel`` classes used for serializing and
deserializing Firestore documents.  There is no SQLAlchemy/SQLModel here —
Firestore is schemaless so no table definitions are needed.

Each class corresponds to a Firestore collection of the same (lowercase,
underscore-separated) name:
  User            → users/
  Task            → tasks/
  ActivityLog     → activity_logs/
  TeamMember      → team_members/
  BotAccount      → bot_accounts/
  Webhook         → webhooks/
  ChatMessage     → chat_messages/
  Project         → projects/
  Pipeline        → pipelines/
  KanbanBoard     → kanban_boards/
  CalendarEvent   → calendar_events/
  FileRecord      → file_records/
  FileAccessLog   → file_access_logs/
  FileShare       → file_shares/
  CustomRole      → custom_roles/
  RolePermission  → role_permissions/
"""

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ── Users ──────────────────────────────────────────────────────────────────────

class User(BaseModel):
    """Represents an authenticated user.  The document ID is the Firebase Auth UID."""

    id: str
    """Firebase Auth UID — serves as the document ID in Firestore."""
    name: str
    email: str
    role: str = "member"
    """One of 'admin', 'manager', 'member', or any custom role name."""
    is_admin: bool = False
    is_active: bool = True
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

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


# ── Tasks ──────────────────────────────────────────────────────────────────────

class Task(BaseModel):
    """A work task. Document ID is the task's string ID (e.g. 'TASK-001')."""

    id: str
    title: str
    description: Optional[str] = None
    status: str = "todo"
    """One of 'todo', 'in-progress', 'done'."""
    priority: str = "medium"
    """One of 'low', 'medium', 'high'."""
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    """ISO date string 'YYYY-MM-DD'."""
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None
    """ISO date string 'YYYY-MM-DD' — used in analytics daily breakdown."""
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    """A pipeline belonging to a project. Document ID is a string."""

    id: str
    project_id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Kanban boards ──────────────────────────────────────────────────────────────

class KanbanBoard(BaseModel):
    """Persisted kanban board state for a pipeline. Document ID is pipeline_id."""

    pipeline_id: str
    state: Optional[Any] = None
    """Arbitrary JSON state blob (columns, cards, order, etc.)."""
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Calendar events ────────────────────────────────────────────────────────────

class CalendarEvent(BaseModel):
    """A calendar event owned by a user. Document ID is a string."""

    id: str
    title: str
    date: str
    """ISO date string 'YYYY-MM-DD'."""
    time: Optional[str] = None
    priority: str = "medium"
    remind: bool = False
    assignee_names: List[str] = Field(default_factory=list)
    owner_id: str
    """Firebase UID of the owning user."""
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── File records ───────────────────────────────────────────────────────────────

class FileRecord(BaseModel):
    """Metadata for an uploaded file or folder. Document ID is a UUID string.

    The actual file bytes live in Cloudflare R2 (or local disk) under the
    ``r2_key``.  This record is the database representation only.
    """

    id: str
    """UUID string — used as the Firestore document ID."""
    owner_id: str
    """Firebase UID of the uploading user."""
    name: str
    path: str
    """Full virtual path (e.g. 'docs/reports/q1.pdf')."""
    parent_path: str
    """Parent directory path (e.g. 'docs/reports')."""
    type: str
    """'file' or 'folder'."""
    size: Optional[int] = None
    """File size in bytes — None for folders."""
    mime_type: Optional[str] = None
    r2_key: Optional[str] = None
    """Storage key in R2 (or local disk).  None for folders."""
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    is_starred: bool = False
    color: Optional[str] = None
    icon_emoji: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── File access logs ───────────────────────────────────────────────────────────

class FileAccessLog(BaseModel):
    """Records each time a file is accessed (download / preview). Document ID is UUID."""

    id: str
    file_id: str
    user_id: str
    action: str
    """'download' or 'preview'."""
    accessed_at: datetime

    model_config = {"from_attributes": True}


# ── File shares ────────────────────────────────────────────────────────────────

class FileShare(BaseModel):
    """A share record granting another user (or anyone with a link) access to a file."""

    id: str
    file_id: str
    owner_id: str
    shared_with_user_id: Optional[str] = None
    share_token: Optional[str] = None
    permission_level: str = "view"
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}