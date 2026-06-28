import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON, PrimaryKeyConstraint


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
    role: str = Field(default="member", max_length=20)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"
    __table_args__ = (PrimaryKeyConstraint("role", "permission"),)

    role: str = Field(max_length=20)
    permission: str = Field(max_length=100)


class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "password_reset_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    token: str = Field(index=True, max_length=64)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(primary_key=True, max_length=50)
    title: str = Field(max_length=500)
    status: str = Field(default="todo", max_length=50)
    priority: str = Field(default="medium", max_length=50)
    assignee: str = Field(default="", max_length=200)
    due_date: Optional[str] = Field(default=None, max_length=20)
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    description: Optional[str] = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"))
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
    created_at: datetime = Field(default_factory=datetime.utcnow)