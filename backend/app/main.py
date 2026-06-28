import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

load_dotenv()

from .database import create_db_and_tables, engine
from .models import Task, User
from .routers import auth, users, admin
from .routers import tasks, activity, team, analytics, permissions
from .routers.permissions import seed_default_permissions

SEED_TASKS = [
    {"id": "TASK-001", "title": "Redesign onboarding flow for new users", "status": "in-progress", "priority": "high", "assignee": "Alex Johnson", "due_date": "2026-07-10", "tags": ["design", "ux"], "created_at": "2026-04-20"},
    {"id": "TASK-002", "title": "Implement JWT refresh token mechanism", "status": "todo", "priority": "high", "assignee": "Sarah Chen", "due_date": "2026-07-15", "tags": ["backend", "security"], "created_at": "2026-04-21"},
    {"id": "TASK-003", "title": "Write unit tests for payment module", "status": "todo", "priority": "medium", "assignee": "Marcus Webb", "due_date": "2026-07-20", "tags": ["testing", "backend"], "created_at": "2026-04-22"},
    {"id": "TASK-004", "title": "Migrate database to PostgreSQL 16", "status": "in-progress", "priority": "high", "assignee": "Priya Nair", "due_date": "2026-07-12", "tags": ["database", "devops"], "created_at": "2026-04-18"},
    {"id": "TASK-005", "title": "Create reusable date-picker component", "status": "done", "priority": "medium", "assignee": "Alex Johnson", "due_date": "2026-04-30", "tags": ["ui", "frontend"], "created_at": "2026-04-15"},
    {"id": "TASK-006", "title": "Set up CI/CD pipeline with GitHub Actions", "status": "done", "priority": "high", "assignee": "Marcus Webb", "due_date": "2026-04-28", "tags": ["devops", "ci-cd"], "created_at": "2026-04-14"},
    {"id": "TASK-007", "title": "Add dark mode support to dashboard", "status": "todo", "priority": "low", "assignee": "Sarah Chen", "due_date": "2026-07-25", "tags": ["ui", "design"], "created_at": "2026-04-23"},
    {"id": "TASK-008", "title": "Optimize image loading with lazy load", "status": "todo", "priority": "medium", "assignee": "Priya Nair", "due_date": "2026-07-22", "tags": ["performance", "frontend"], "created_at": "2026-04-24"},
    {"id": "TASK-009", "title": "Integrate Stripe webhook handling", "status": "in-progress", "priority": "high", "assignee": "Alex Johnson", "due_date": "2026-07-08", "tags": ["backend", "payments"], "created_at": "2026-04-25"},
    {"id": "TASK-010", "title": "Audit and fix accessibility issues", "status": "todo", "priority": "medium", "assignee": "Marcus Webb", "due_date": "2026-07-30", "tags": ["a11y", "frontend"], "created_at": "2026-04-26"},
    {"id": "TASK-011", "title": "Document REST API endpoints with OpenAPI", "status": "done", "priority": "low", "assignee": "Sarah Chen", "due_date": "2026-04-29", "tags": ["documentation", "backend"], "created_at": "2026-04-16"},
    {"id": "TASK-012", "title": "Implement real-time notifications via WebSocket", "status": "todo", "priority": "high", "assignee": "Priya Nair", "due_date": "2026-08-01", "tags": ["backend", "realtime"], "created_at": "2026-04-27"},
]

def seed_data():
    with Session(engine) as session:
        if not session.exec(select(Task)).first():
            for t in SEED_TASKS:
                session.add(Task(
                    id=t["id"], title=t["title"], status=t["status"],
                    priority=t["priority"], assignee=t["assignee"],
                    due_date=t["due_date"], tags=t["tags"],
                    created_at=t["created_at"], updated_at=datetime.utcnow(),
                ))
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_data()
    with Session(engine) as session:
        seed_default_permissions(session)
    yield


app = FastAPI(title="WorkOS API", version="1.0.0", lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "")
    if origin == FRONTEND_URL:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(HTTPException)
async def cors_aware_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def cors_aware_server_error_handler(request: Request, exc: Exception) -> JSONResponse:
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers(request),
    )

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(tasks.router)
app.include_router(activity.router)
app.include_router(team.router)
app.include_router(analytics.router)
app.include_router(permissions.router)