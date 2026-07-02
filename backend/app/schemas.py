import uuid
from datetime import datetime
from typing import Literal, Optional, List
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str

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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── User ──────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    bio: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    is_admin: bool
    role: str = "member"
    created_at: datetime

    model_config = {"from_attributes": True}


class PermissionsResponse(BaseModel):
    permissions: List[str]


class RolePermissionsMap(BaseModel):
    role: str
    permissions: List[str]


class RoleCreate(BaseModel):
    name: str
    copy_from: Optional[str] = None


class RoleResponse(BaseModel):
    name: str
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tasks ─────────────────────────────────────────────────────────────────────

TaskStatus = Literal["todo", "in-progress", "done"]
TaskPriority = Literal["low", "medium", "high"]


class TaskCreate(BaseModel):
    id: Optional[str] = None
    title: str
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignees: List[str] = []
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    created_at: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignees: Optional[List[str]] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    completed_at: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    assignees: List[str] = []
    due_date: Optional[str]
    tags: Optional[List[str]]
    description: Optional[str]
    completed_at: Optional[datetime]
    created_at: str

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
    detail: Optional[str]
    timestamp: str
    user_id: Optional[str]
    user_name: Optional[str]

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
    avatar: Optional[str]
    joined_at: str
    phone: Optional[str]

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


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v else v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── Admin ─────────────────────────────────────────────────────────────────────

class PatchUserRole(BaseModel):
    role: str


class AdminCreateUser(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "member"
    is_admin: bool = False

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


# ── Bots ──────────────────────────────────────────────────────────────────────

class BotCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Bot name cannot be empty")
        if len(v.strip()) > 64:
            raise ValueError("Bot name max 64 characters")
        return v.strip()


class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class BotResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    key_prefix: str
    owner_id: uuid.UUID
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]

    model_config = {"from_attributes": True}


class BotCreateResponse(BotResponse):
    """Returned only on creation — includes the full key (shown once)."""
    api_key: str


# ── Webhooks ──────────────────────────────────────────────────────────────────

VALID_WEBHOOK_EVENTS = {
    "task.created",
    "task.updated",
    "task.deleted",
    "file.uploaded",
    "message.received",
}


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessageCreate(BaseModel):
    text: str


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    room_id: str
    sender_id: str
    sender_name: str
    sender_type: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatLastMessage(BaseModel):
    text: str
    created_at: datetime


class ChatContact(BaseModel):
    id: str
    name: str
    type: str       # "user" | "bot"
    is_active: bool
    last_message: Optional[ChatLastMessage] = None


# ── Webhooks ──────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: List[str]) -> List[str]:
        for e in v:
            if e not in VALID_WEBHOOK_EVENTS:
                raise ValueError(f"Unknown event '{e}'. Valid: {sorted(VALID_WEBHOOK_EVENTS)}")
        return v


class WebhookResponse(BaseModel):
    id: uuid.UUID
    bot_id: uuid.UUID
    url: str
    events: List[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    id: Optional[str] = None
    name: str
    slug: Optional[str] = None
    color: str = "blue"
    emoji: str = "🚀"
    is_pinned: bool = False
    is_expanded: bool = False


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
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
    state: Optional[dict] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Calendar Events ───────────────────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    id: Optional[str] = None
    title: str
    date: str
    time: Optional[str] = None
    priority: str = "medium"
    remind: bool = False
    assignee_names: Optional[List[str]] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    priority: Optional[str] = None
    remind: Optional[bool] = None
    assignee_names: Optional[List[str]] = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    date: str
    time: Optional[str]
    priority: str
    remind: bool
    assignee_names: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Token responses ───────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"