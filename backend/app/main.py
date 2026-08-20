import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

from pathlib import Path

# Load .env from the repo root first, then fall back to backend/.env
_repo_root = Path(__file__).resolve().parents[2]
load_dotenv(_repo_root / ".env")
load_dotenv(_repo_root / "backend" / ".env", override=False)

from sqlalchemy import text
from .database import create_db_and_tables, engine
from .models import CustomRole, PasswordResetToken, Task, User
from .routers import auth, users, admin, bots
from .routers import tasks, activity, team, analytics, permissions
from .routers import projects, pipelines, kanban, calendar
from .routers.permissions import seed_default_permissions
from .routers.v1 import tasks as v1_tasks, team as v1_team, activity as v1_activity
from .routers.v1 import analytics as v1_analytics, webhooks as v1_webhooks, me as v1_me
from .routers.v1 import chat as v1_chat
from .routers.v1 import presence as v1_presence
from .routers.v1 import files as v1_files

SEED_TASKS = [
    {"id": "TASK-001", "title": "Redesign onboarding flow for new users", "status": "in-progress", "priority": "high", "assignees": ["Alex Johnson"], "due_date": "2026-07-10", "tags": ["design", "ux"], "created_at": "2026-04-20"},
    {"id": "TASK-002", "title": "Implement JWT refresh token mechanism", "status": "todo", "priority": "high", "assignees": ["Sarah Chen"], "due_date": "2026-07-15", "tags": ["backend", "security"], "created_at": "2026-04-21"},
    {"id": "TASK-003", "title": "Write unit tests for payment module", "status": "todo", "priority": "medium", "assignees": ["Marcus Webb"], "due_date": "2026-07-20", "tags": ["testing", "backend"], "created_at": "2026-04-22"},
    {"id": "TASK-004", "title": "Migrate database to PostgreSQL 16", "status": "in-progress", "priority": "high", "assignees": ["Priya Nair", "Alex Johnson"], "due_date": "2026-07-12", "tags": ["database", "devops"], "created_at": "2026-04-18"},
    {"id": "TASK-005", "title": "Create reusable date-picker component", "status": "done", "priority": "medium", "assignees": ["Alex Johnson"], "due_date": "2026-04-30", "tags": ["ui", "frontend"], "created_at": "2026-04-15"},
    {"id": "TASK-006", "title": "Set up CI/CD pipeline with GitHub Actions", "status": "done", "priority": "high", "assignees": ["Marcus Webb"], "due_date": "2026-04-28", "tags": ["devops", "ci-cd"], "created_at": "2026-04-14"},
    {"id": "TASK-007", "title": "Add dark mode support to dashboard", "status": "todo", "priority": "low", "assignees": ["Sarah Chen"], "due_date": "2026-07-25", "tags": ["ui", "design"], "created_at": "2026-04-23"},
    {"id": "TASK-008", "title": "Optimize image loading with lazy load", "status": "todo", "priority": "medium", "assignees": ["Priya Nair"], "due_date": "2026-07-22", "tags": ["performance", "frontend"], "created_at": "2026-04-24"},
    {"id": "TASK-009", "title": "Integrate Stripe webhook handling", "status": "in-progress", "priority": "high", "assignees": ["Alex Johnson", "Sarah Chen"], "due_date": "2026-07-08", "tags": ["backend", "payments"], "created_at": "2026-04-25"},
    {"id": "TASK-010", "title": "Audit and fix accessibility issues", "status": "todo", "priority": "medium", "assignees": ["Marcus Webb"], "due_date": "2026-07-30", "tags": ["a11y", "frontend"], "created_at": "2026-04-26"},
    {"id": "TASK-011", "title": "Document REST API endpoints with OpenAPI", "status": "done", "priority": "low", "assignees": ["Sarah Chen"], "due_date": "2026-04-29", "tags": ["documentation", "backend"], "created_at": "2026-04-16"},
    {"id": "TASK-012", "title": "Implement real-time notifications via WebSocket", "status": "todo", "priority": "high", "assignees": ["Priya Nair"], "due_date": "2026-08-01", "tags": ["backend", "realtime"], "created_at": "2026-04-27"},
]

def seed_data():
    with Session(engine) as session:
        # Always upsert the admin user from env vars if both are provided.
        # This runs on every startup so the admin can be recovered even when
        # the DB already has other users (e.g. existing Docker volume).
        admin_email = os.getenv("ADMIN_EMAIL", "").strip()
        admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
        if admin_email and admin_password:
            from .security import hash_password
            existing = session.exec(
                select(User).where(User.email == admin_email)
            ).first()
            if existing:
                existing.hashed_password = hash_password(admin_password)
                existing.is_admin = True
                existing.role = "admin"
                existing.is_active = True
                session.add(existing)
                print(f"[seed] Admin user updated: {admin_email}", flush=True)
            else:
                session.add(User(
                    name="Admin",
                    email=admin_email,
                    hashed_password=hash_password(admin_password),
                    is_admin=True,
                    role="admin",
                    is_active=True,
                ))
                print(f"[seed] Admin user created: {admin_email}", flush=True)
        else:
            print(
                "[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user seed. "
                "Create an admin via POST /auth/register after startup.",
                flush=True,
            )

        # Seed sample tasks only on a truly fresh install (no tasks yet).
        # This prevents deleted tasks from coming back after every restart.
        if not session.exec(select(Task)).first():
            for t in SEED_TASKS:
                session.add(Task(
                    id=t["id"], title=t["title"], status=t["status"],
                    priority=t["priority"], assignees=t["assignees"],
                    due_date=t["due_date"], tags=t["tags"],
                    created_at=t["created_at"], updated_at=datetime.now(timezone.utc),
                ))

        session.commit()


def seed_roles():
    with Session(engine) as session:
        for role_name, is_sys in [("admin", True), ("manager", True), ("member", True)]:
            if not session.get(CustomRole, role_name):
                session.add(CustomRole(name=role_name, is_system=True))
        session.commit()


def migrate_db():
    """Idempotent column migrations for tables that already exist."""
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE"
        ))
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees JSON"
        ))
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id VARCHAR(100)"
        ))
        # Migrate existing single-assignee rows to the new JSON array column
        # Only run if the legacy assignee column still exists
        has_assignee_col = conn.execute(text("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name='tasks' AND column_name='assignee'
        """)).fetchone()
        if has_assignee_col:
            conn.execute(text("""
                UPDATE tasks
                SET assignees = to_json(ARRAY[assignee]::text[])
                WHERE assignees IS NULL AND assignee IS NOT NULL AND assignee != ''
            """))
        conn.execute(text("""
            UPDATE tasks SET assignees = '[]'::json WHERE assignees IS NULL
        """))
        conn.commit()


def cleanup_expired_tokens():
    with Session(engine) as session:
        expired = session.exec(
            select(PasswordResetToken).where(
                PasswordResetToken.expires_at < datetime.now(timezone.utc)
            )
        ).all()
        for token in expired:
            session.delete(token)
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_db()
    seed_data()
    seed_roles()
    with Session(engine) as session:
        seed_default_permissions(session)
    cleanup_expired_tokens()
    yield


app = FastAPI(title="WorkOS API", version="1.0.0", lifespan=lifespan)

_raw_origins = os.getenv("FRONTEND_URL", "http://localhost:3051")
ALLOWED_ORIGINS: list[str] = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]
# Back-compat: keep FRONTEND_URL pointing to the first entry
FRONTEND_URL = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "http://localhost:3051"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
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
app.include_router(bots.router)
app.include_router(tasks.router)
app.include_router(activity.router)
app.include_router(team.router)
app.include_router(analytics.router)
app.include_router(permissions.router)
app.include_router(projects.router)
app.include_router(pipelines.router)
app.include_router(kanban.router)
app.include_router(calendar.router)

# v1 public API — accepts both JWT and API key auth
_V1 = "/api/v1"
app.include_router(v1_me.router, prefix=_V1)
app.include_router(v1_tasks.router, prefix=_V1)
app.include_router(v1_team.router, prefix=_V1)
app.include_router(v1_activity.router, prefix=_V1)
app.include_router(v1_analytics.router, prefix=_V1)
app.include_router(v1_webhooks.router, prefix=_V1)
app.include_router(v1_chat.router, prefix=_V1)
app.include_router(v1_presence.router, prefix=_V1)
app.include_router(v1_files.router, prefix=_V1)


@app.get("/health", tags=["health"])
def health_check():
    """Public health endpoint — full diagnostics for deployment debugging."""
    import os
    from sqlalchemy import text as _text
    from app.database import engine
    from app.security import verify_password

    def _check_table(conn, name: str) -> bool:
        r = conn.execute(
            _text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:t)"),
            {"t": name},
        )
        return bool(r.scalar())

    def _check_column(conn, table: str, col: str) -> bool:
        r = conn.execute(
            _text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=:t AND column_name=:c)"),
            {"t": table, "c": col},
        )
        return bool(r.scalar())

    db_ok = False
    tables: dict = {}
    columns: dict = {}
    db_error: str = ""
    users_info: dict = {}
    login_test: dict = {}

    WATCHED_TABLES = [
        "users", "tasks", "file_records", "file_access_logs", "file_shares",
        "role_permissions", "projects", "pipelines", "kanban_tasks",
        "calendar_events", "bots", "team_members",
    ]
    WATCHED_COLUMNS = {
        "file_records": ["color", "icon_emoji", "is_starred"],
        "users": ["role", "is_admin"],
        "tasks": ["assignees", "completed_at"],
    }

    admin_email = os.getenv("ADMIN_EMAIL", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()

    try:
        with engine.connect() as conn:
            db_ok = True
            for t in WATCHED_TABLES:
                tables[t] = _check_table(conn, t)
            for table, cols in WATCHED_COLUMNS.items():
                if tables.get(table):
                    columns[table] = {c: _check_column(conn, table, c) for c in cols}
                else:
                    columns[table] = {c: None for c in cols}

            # User summary
            total_users = conn.execute(_text("SELECT COUNT(*) FROM users")).scalar()
            admin_users = conn.execute(_text("SELECT COUNT(*) FROM users WHERE is_admin=true OR role='admin'")).scalar()
            users_info = {
                "total": total_users,
                "admin_count": admin_users,
                "ADMIN_EMAIL_set": bool(admin_email),
                "ADMIN_EMAIL_value": admin_email or "(not set)",
                "ADMIN_PASSWORD_set": bool(admin_password),
            }

            # Check if ADMIN_EMAIL user exists and password is correct
            if admin_email:
                row = conn.execute(
                    _text("SELECT id, email, is_admin, role, is_active, hashed_password FROM users WHERE email=:e"),
                    {"e": admin_email},
                ).fetchone()
                if row is None:
                    login_test = {
                        "user_found": False,
                        "reason": "No user with ADMIN_EMAIL exists in DB — seed may not have run",
                    }
                else:
                    pwd_ok = verify_password(admin_password, row.hashed_password) if admin_password else False
                    login_test = {
                        "user_found": True,
                        "user_id": str(row.id),
                        "is_admin": row.is_admin,
                        "role": row.role,
                        "is_active": row.is_active,
                        "password_correct": pwd_ok,
                        "diagnosis": (
                            "OK — credentials match" if pwd_ok
                            else "WRONG PASSWORD — ADMIN_PASSWORD env var does not match stored hash"
                            if admin_password else "ADMIN_PASSWORD not set"
                        ),
                    }
            else:
                login_test = {"skipped": "ADMIN_EMAIL not set"}

    except Exception as e:
        db_error = str(e)

    env_info = {
        "FRONTEND_URL": os.getenv("FRONTEND_URL", "(not set)"),
        "FRONTEND_URL_stripped": os.getenv("FRONTEND_URL", "").strip().rstrip("/") or "(not set)",
        "ALLOWED_ORIGINS": ALLOWED_ORIGINS,
        "DATABASE_URL_set": bool(os.getenv("DATABASE_URL")),
        "SECRET_KEY_set": bool(os.getenv("SECRET_KEY")),
        "R2_configured": bool(os.getenv("CLOUDFLARE_ACCOUNT_ID") and os.getenv("R2_BUCKET_NAME")),
    }

    all_ok = db_ok and login_test.get("password_correct", False)

    return {
        "status": "ok" if all_ok else "degraded",
        "database": {
            "connected": db_ok,
            "error": db_error or None,
            "tables": tables,
            "columns": columns,
        },
        "users": users_info,
        "login_test": login_test,
        "cors": {
            "allowed_origins": ALLOWED_ORIGINS,
        },
        "env": env_info,
    }