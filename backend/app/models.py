import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON, PrimaryKeyConstraint, UniqueConstraint


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    name: str = Field(max_length=100)
    hashed_password: str
    bio: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    role: str = Field(default="member", max_length=50)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class CustomRole(SQLModel, table=True):
    __tablename__ = "custom_roles"

    name: str = Field(primary_key=True, max_length=50)
    is_system: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"
    __table_args__ = (PrimaryKeyConstraint("role", "permission"),)

    role: str = Field(max_length=50)
    permission: str = Field(max_length=100)


class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "password_reset_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    token: str = Field(index=True, max_length=64)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(primary_key=True, max_length=50)
    title: str = Field(max_length=500)
    status: str = Field(default="todo", max_length=50)
    priority: str = Field(default="medium", max_length=50)
    assignees: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    due_date: Optional[str] = Field(default=None, max_length=20)
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    description: Optional[str] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    project_id: Optional[str] = Field(default=None, max_length=100, index=True)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    updated_at: datetime = Field(default_factory=_now)


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_logs"

    id: str = Field(primary_key=True, max_length=100)
    type: str = Field(max_length=50)
    task_id: str = Field(max_length=50)
    task_title: str = Field(max_length=500)
    detail: Optional[str] = Field(default=None, max_length=500)
    timestamp: str = Field(max_length=50)
    user_id: Optional[str] = Field(default=None, max_length=100)
    user_name: Optional[str] = Field(default=None, max_length=200)


class TeamMember(SQLModel, table=True):
    __tablename__ = "team_members"

    id: str = Field(primary_key=True, max_length=50)
    name: str = Field(max_length=200)
    email: str = Field(unique=True, index=True, max_length=255)
    role: str = Field(max_length=200)
    status: str = Field(default="active", max_length=20)
    avatar: Optional[str] = Field(default=None, max_length=500)
    joined_at: str = Field(max_length=20)
    phone: Optional[str] = Field(default=None, max_length=50)
    created_at: datetime = Field(default_factory=_now)


class BotAccount(SQLModel, table=True):
    __tablename__ = "bot_accounts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=64)
    description: Optional[str] = Field(default=None, max_length=256)
    # First 12 chars of the full key — shown in UI for identification
    key_prefix: str = Field(max_length=20, index=True)
    # SHA-256 hash of the full key — used for auth lookup
    key_hash: str = Field(max_length=64, unique=True, index=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_now)
    last_used_at: Optional[datetime] = Field(default=None)


class Webhook(SQLModel, table=True):
    __tablename__ = "webhooks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    bot_id: uuid.UUID = Field(foreign_key="bot_accounts.id", index=True)
    url: str = Field(max_length=2048)
    events: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Optional HMAC secret for signing payloads
    secret: Optional[str] = Field(default=None, max_length=256)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_now)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # room_id = sorted([sender_uuid, recipient_uuid]).join("_")
    room_id: str = Field(max_length=200, index=True)
    sender_id: str = Field(max_length=100)
    sender_name: str = Field(max_length=100)
    sender_type: str = Field(max_length=10)  # "user" | "bot"
    text: str = Field(max_length=4000)
    created_at: datetime = Field(default_factory=_now)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(primary_key=True, max_length=100)
    name: str = Field(max_length=200)
    slug: str = Field(unique=True, index=True, max_length=200)
    color: str = Field(default="blue", max_length=50)
    emoji: str = Field(default="🚀", max_length=10)
    owner_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)
    is_pinned: bool = Field(default=False)
    is_expanded: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class Pipeline(SQLModel, table=True):
    __tablename__ = "pipelines"

    id: str = Field(primary_key=True, max_length=100)
    project_id: str = Field(max_length=100, index=True)
    name: str = Field(max_length=200)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class KanbanBoard(SQLModel, table=True):
    """Stores the full board state (columns + cards) for a pipeline as JSON."""
    __tablename__ = "kanban_boards"

    pipeline_id: str = Field(primary_key=True, max_length=100)
    state: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    updated_at: datetime = Field(default_factory=_now)


class CalendarEvent(SQLModel, table=True):
    __tablename__ = "calendar_events"

    id: str = Field(primary_key=True, max_length=100)
    title: str = Field(max_length=500)
    date: str = Field(max_length=20, index=True)  # yyyy-MM-dd
    time: Optional[str] = Field(default=None, max_length=10)
    priority: str = Field(default="medium", max_length=20)
    remind: bool = Field(default=False)
    assignee_names: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    owner_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class FileRecord(SQLModel, table=True):
    """Metadata for files and folders stored in Cloudflare R2.

    Actual bytes live in R2; this table provides fast listing, search,
    soft-delete (trash), and quota tracking without hitting the object store.
    """
    __tablename__ = "file_records"
    __table_args__ = (
        UniqueConstraint("owner_id", "path", name="uq_file_record_owner_path"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Human-readable display name, e.g. "report.pdf"
    name: str = Field(max_length=500)
    # Full virtual path, e.g. "projects/2026/report.pdf" (no leading slash)
    path: str = Field(index=True, max_length=2048)
    # Pre-computed parent so listing is a simple equality query, e.g. "projects/2026"
    # Root items have parent_path=""
    parent_path: str = Field(default="", index=True, max_length=2048)

    type: str = Field(default="file", max_length=10)  # "file" | "folder"
    size: Optional[int] = Field(default=None)          # bytes; None for folders
    mime_type: Optional[str] = Field(default=None, max_length=255)
    # R2 object key, e.g. "<owner_id>/<file_id>"; None for folders
    r2_key: Optional[str] = Field(default=None, max_length=1024)

    is_deleted: bool = Field(default=False, index=True)
    deleted_at: Optional[datetime] = Field(default=None)

    is_starred: bool = Field(default=False, index=True)
    color: Optional[str] = Field(default=None, max_length=32)
    icon_emoji: Optional[str] = Field(default=None, max_length=8)

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class FileAccessLog(SQLModel, table=True):
    """Records every view/download access to a FileRecord for the 'Recent' feature."""

    __tablename__ = "file_access_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_id: uuid.UUID = Field(foreign_key="file_records.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    action: str = Field(max_length=20)  # "view" | "download"
    accessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FileShare(SQLModel, table=True):
    """Tracks per-file sharing grants (user-to-user or public token links)."""

    __tablename__ = "file_shares"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_id: uuid.UUID = Field(foreign_key="file_records.id", index=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id")
    shared_with_user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    share_token: Optional[str] = Field(default=None, index=True, max_length=64)  # public link token
    permission_level: str = Field(default="view", max_length=10)  # "view" | "edit" | "owner"
    expires_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))