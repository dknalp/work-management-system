"""Pydantic request/response schemas for the work-management-system API.

These schemas are the contract between the HTTP layer and the application logic.
They are separate from the data models in ``models.py``, which represent
Firestore documents.  Schemas handle input validation and shape API responses.

Note: User IDs are plain strings (Firebase Auth UIDs), not UUIDs.
"""

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, EmailStr, Field, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Request body for ``POST /auth/register``."""

    email: EmailStr
    name: str
    # max_length=128 prevents memory abuse from extremely long password strings
    password: str = Field(..., max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class ForgotPasswordRequest(BaseModel):
    """Request body for ``POST /auth/forgot-password``."""
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    """Request body for ``PATCH /auth/change-password``."""
    # max_length=128 prevents memory abuse from extremely long password strings
    new_password: str = Field(..., max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── User ──────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Serialized user returned by API endpoints."""

    id: str
    """Firebase Auth UID."""
    email: str
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_admin: bool
    role: str = "member"
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """Request body for ``PATCH /users/me``."""

    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v else v


class PermissionsResponse(BaseModel):
    permissions: List[str]


class RolePermissionsMap(BaseModel):
    role: str
    permissions: List[str]


class RoleCreate(BaseModel):
    """Request body for creating a custom role."""
    name: str
    copy_from: Optional[str] = None


class RoleResponse(BaseModel):
    name: str
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Bots / API keys ───────────────────────────────────────────────────────────

class BotCreate(BaseModel):
    """Request body for ``POST /bots``."""
    name: str = Field(..., max_length=256)
    description: Optional[str] = Field(None, max_length=10_000)


class BotResponse(BaseModel):
    """Serialized bot account returned by API endpoints.

    ``full_key`` is populated only on creation and is never stored or returned
    again after that first response.
    """
    id: str
    name: str
    description: Optional[str] = None
    key_prefix: str
    is_active: bool
    owner_id: str
    created_at: datetime
    last_used_at: Optional[datetime] = None
    full_key: Optional[str] = None
    """Present only on first creation — store it safely, it is never shown again."""

    model_config = {"from_attributes": True}


# ── Tasks ─────────────────────────────────────────────────────────────────────

TaskStatus = Literal["todo", "in-progress", "done"]
TaskPriority = Literal["low", "medium", "high"]


# ── Task sub-document schemas ──────────────────────────────────────────────────

class SubTaskCreate(BaseModel):
    """Request body for adding a sub-task to a task."""
    title: str = Field(..., max_length=512)


class SubTaskUpdate(BaseModel):
    """Request body for updating a sub-task."""
    title: Optional[str] = Field(None, max_length=512)
    completed: Optional[bool] = None


class SubTaskResponse(BaseModel):
    """Serialized sub-task returned by the API."""
    id: str
    title: str
    completed: bool

    model_config = {"from_attributes": True}


class ReplyCreate(BaseModel):
    """Request body for adding a reply to a comment."""
    body: str = Field(..., max_length=10_000)


class ReplyResponse(BaseModel):
    """Serialized comment reply returned by the API."""
    id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    body: str
    created_at: str

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    """Request body for adding a comment to a task."""
    body: str = Field(..., max_length=10_000)


class CommentResponse(BaseModel):
    """Serialized comment returned by the API, including its replies."""
    id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    body: str
    created_at: str
    replies: List["ReplyResponse"] = []

    model_config = {"from_attributes": True}


# ── Task CRUD schemas ─────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    """Request body for ``POST /api/v1/tasks``.

    Task IDs are always generated server-side; do not pass an ``id`` field.
    """
    title: str = Field(..., max_length=512)
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignees: List[str] = []
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = Field(None, max_length=10_000)
    created_at: Optional[str] = None
    project_id: Optional[str] = None


class TaskUpdate(BaseModel):
    """Request body for ``PATCH /api/v1/tasks/{task_id}``."""
    title: Optional[str] = Field(None, max_length=512)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignees: Optional[List[str]] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = Field(None, max_length=10_000)
    completed_at: Optional[str] = None
    """ISO datetime string — supply when status changes to 'done'."""
    project_id: Optional[str] = None


class TaskResponse(BaseModel):
    """Full task document returned by the API."""
    id: str
    title: str
    status: str
    priority: str
    assignees: List[str] = []
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    completed_at: Optional[str] = None
    updated_at: Optional[str] = None
    project_id: Optional[str] = None
    created_at: str
    sub_tasks: List[SubTaskResponse] = []
    comments: List[CommentResponse] = []

    model_config = {"from_attributes": True}


# ── Activity ──────────────────────────────────────────────────────────────────

class ActivityCreate(BaseModel):
    id: Optional[str] = None
    type: str
    task_id: str
    task_title: str
    detail: Optional[str] = None
    timestamp: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None


class ActivityResponse(BaseModel):
    id: str
    type: str
    task_id: str
    task_title: str
    detail: Optional[str] = None
    timestamp: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamMemberCreate(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    role: str
    status: str = "active"
    avatar: Optional[str] = None
    joined_at: Optional[str] = None
    phone: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    avatar: Optional[str] = None
    joined_at: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsStats(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    overdue: int
    completion_rate: float


class AnalyticsDailyPoint(BaseModel):
    date: str
    created: int
    completed: int


# ── Webhooks ──────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    """Schema for registering a new webhook.

    ``url`` is validated to be an absolute HTTP/HTTPS URL at the Pydantic layer.
    The dispatcher performs an additional runtime SSRF check (hostname resolution
    against blocked IP ranges) before each delivery.
    """

    url: AnyHttpUrl
    events: List[str]
    secret: Optional[str] = None


class WebhookResponse(BaseModel):
    id: str
    bot_id: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Files ──────────────────────────────────────────────────────────────────────

class FileRecordResponse(BaseModel):
    """Serialized file record returned by the file API."""

    id: str
    owner_id: str
    name: str
    path: str
    parent_path: str
    type: str
    size: Optional[int] = None
    mime_type: Optional[str] = None
    r2_key: Optional[str] = None
    is_deleted: bool
    deleted_at: Optional[datetime] = None
    is_starred: bool
    color: Optional[str] = None
    icon_emoji: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileRenameRequest(BaseModel):
    new_name: str


class FilePatchRequest(BaseModel):
    """Partial update for file metadata (star, color, icon)."""
    is_starred: Optional[bool] = None
    color: Optional[str] = None
    icon_emoji: Optional[str] = None


class BulkMoveRequest(BaseModel):
    paths: List[str]
    destination: str


class BulkCopyRequest(BaseModel):
    paths: List[str]
    destination: str


class BulkTrashRequest(BaseModel):
    paths: List[str]


class ShareCreateRequest(BaseModel):
    file_id: str
    shared_with_user_id: Optional[str] = None
    permission_level: str = "view"
    expires_at: Optional[datetime] = None


class ShareResponse(BaseModel):
    id: str
    file_id: str
    owner_id: str
    shared_with_user_id: Optional[str] = None
    share_token: Optional[str] = None
    permission_level: str
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUserUpdate(BaseModel):
    """Request body for admin user updates."""
    name: Optional[str] = None
    role: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    # id is intentionally omitted — project IDs are always generated server-side
    name: str = Field(..., max_length=256)
    slug: Optional[str] = None
    color: str = Field("#6366f1", max_length=20)
    emoji: str = Field("📁", max_length=10)
    is_pinned: bool = False
    is_expanded: bool = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=256)
    color: Optional[str] = Field(None, max_length=20)
    emoji: Optional[str] = Field(None, max_length=10)
    is_pinned: Optional[bool] = None
    is_expanded: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    color: str
    emoji: str
    is_pinned: bool
    is_expanded: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Pipelines ─────────────────────────────────────────────────────────────────

class PipelineCreate(BaseModel):
    id: Optional[str] = None
    project_id: str
    name: str


class PipelineUpdate(BaseModel):
    name: Optional[str] = None


class PipelineResponse(BaseModel):
    id: str
    project_id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Kanban ────────────────────────────────────────────────────────────────────

class KanbanBoardState(BaseModel):
    pipeline_id: str
    state: Optional[Any] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── User preferences ──────────────────────────────────────────────────────────

class UserPreferences(BaseModel):
    """Persisted per-user UI/notification preferences stored in Firestore.

    All fields are optional on input so that ``PATCH`` requests can update
    individual settings without resending the full object.  Defaults here
    represent the initial state returned when no preferences have been saved.
    """

    notifications_email: bool = True
    """Whether the user wants activity updates delivered by e-mail."""

    notifications_push: bool = True
    """Whether the user wants in-app push notifications."""

    theme: str = "system"
    """Active color theme.  One of: ``light``, ``dark``, ``system``,
    ``warm``, ``slate``, ``forest``, ``midnight``."""

    language: str = "en"
    """Preferred display language (IETF tag, e.g. ``en``, ``tr``)."""

    timezone: str = "UTC"
    """IANA timezone string, e.g. ``Europe/Istanbul``."""


class UserPreferencesPatch(BaseModel):
    """Request body for ``PATCH /users/me/preferences``.

    All fields are optional — only the provided fields are written to
    Firestore (merge=True), leaving the rest untouched.
    """

    notifications_email: Optional[bool] = None
    notifications_push: Optional[bool] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


# ── Calendar events ───────────────────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    # id is intentionally omitted — event IDs are always generated server-side
    title: str = Field(..., max_length=512)
    date: str
    time: Optional[str] = None
    priority: str = "medium"
    remind: bool = False
    assignee_names: Optional[List[str]] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=512)
    date: Optional[str] = None
    time: Optional[str] = None
    priority: Optional[str] = None
    remind: Optional[bool] = None
    assignee_names: Optional[List[str]] = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    date: str
    time: Optional[str] = None
    priority: str
    remind: bool
    assignee_names: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}