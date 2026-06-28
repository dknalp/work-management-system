import uuid
from datetime import datetime
from typing import Optional, List
from typing import List
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


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    id: Optional[str] = None
    title: str
    status: str = "todo"
    priority: str = "medium"
    assignee: str = ""
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    created_at: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    assignee: str
    due_date: Optional[str]
    tags: Optional[List[str]]
    description: Optional[str]
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


# ── Token responses ───────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"