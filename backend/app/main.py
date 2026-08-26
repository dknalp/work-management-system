"""FastAPI application entry point for the work-management-system backend.

Startup sequence
----------------
1. Initialize the Firebase Admin SDK (Firestore + Auth)
2. Register all API routers
3. Seed default RBAC permissions and initial task data (skipped if data
   already exists, so it is idempotent across restarts)

Environment variables
---------------------
FIREBASE_SERVICE_ACCOUNT_JSON
    Path to a Firebase service-account JSON key file, or the raw JSON
    string.  Falls back to Application Default Credentials when not set.
FRONTEND_URL
    Allowed CORS origin (default: http://localhost:3000)
"""

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Upload concurrency semaphore
# ---------------------------------------------------------------------------

# Limits the number of file uploads that may buffer data in memory at the
# same time.  With 2 uvicorn workers and a 2 GB max upload size the worst
# case without a semaphore is 2 × 2 GB = 4 GB resident per worker.
# UPLOAD_SEMAPHORE lives in app.routers.v1.files_utils to avoid a circular
# import with files_core (which needs the semaphore at module load time).

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore

from .deps import prewarm_permission_cache
from .firebase import get_db, initialize_firebase
from .routers import (
    activity,
    admin,
    analytics,
    auth,
    bots,
    calendar,
    kanban,
    permissions,
    pipelines,
    projects,
    tasks,
    team,
    users,
)
from .routers.v1 import (
    activity as v1_activity,
    agent_configs as v1_agent_configs,
    analytics as v1_analytics,
    chat as v1_chat,
    files_bulk,
    files_core,
    files_drive,
    files_misc,
    files_share,
    files_trash,
    me as v1_me,
    presence as v1_presence_mod,
    tasks as v1_tasks,
    team as v1_team,
    webhooks as v1_webhooks,
)

import os


# ── Startup / shutdown ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Firebase and seed default data, then yield for request handling."""
    initialize_firebase()
    db = get_db()
    _seed_default_permissions(db)
    _seed_initial_tasks(db)
    _seed_admin_user(db)
    # Pre-warm the permission cache so the first real request is never cold
    prewarm_permission_cache(db)
    yield
    # Graceful shutdown — nothing to tear down; Firebase SDK cleans itself up.


# ── App instance ───────────────────────────────────────────────────────────────

_env = os.getenv("APP_ENV", "production")
app = FastAPI(
    title="Work Management System API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _env == "development" else None,
    redoc_url="/redoc" if _env == "development" else None,
    openapi_url="/openapi.json" if _env == "development" else None,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3051")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request, exc: Exception):
    """Ensure CORS headers are present on unhandled 500 responses.

    FastAPI's CORSMiddleware only injects Access-Control-Allow-Origin into
    responses that pass through the normal response pipeline.  When an
    unhandled exception escapes all route handlers the middleware never runs,
    so the browser sees no CORS header and mis-reports the real error as a
    CORS block.  This handler catches those cases and re-adds the header.
    """
    import traceback
    from fastapi.responses import JSONResponse

    logger.error("Unhandled exception: %s", traceback.format_exc())
    origin = request.headers.get("origin", "")
    headers = {}
    if origin == FRONTEND_URL or not origin:
        headers["Access-Control-Allow-Origin"] = origin or FRONTEND_URL
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )


# ── Routers ────────────────────────────────────────────────────────────────────

# Legacy (non-versioned) routers.
#
# IMPORTANT: routers that declare their own prefix via APIRouter(prefix=...)
# must NOT receive an extra prefix= here — FastAPI concatenates both, which
# would produce doubled paths (e.g. /users/users/me).  Routers WITHOUT a
# self-declared prefix (auth, permissions, projects, pipelines, kanban,
# calendar) still require the prefix= argument here.
#
# Self-prefixed routers (no prefix= in include_router):
app.include_router(auth.router, prefix="/auth", tags=["auth"])     # auth has no self-prefix
app.include_router(users.router, tags=["users"])                   # self-prefix: /users
app.include_router(admin.router, tags=["admin"])                   # self-prefix: /admin
app.include_router(bots.router, tags=["bots"])                     # self-prefix: /admin/bots
app.include_router(tasks.router, tags=["tasks"])                   # self-prefix: /tasks  (legacy)
app.include_router(activity.router, tags=["activity"])             # self-prefix: /activity (legacy)
app.include_router(team.router, tags=["team"])                     # self-prefix: /team  (legacy)
app.include_router(analytics.router, tags=["analytics"])           # self-prefix: /analytics (legacy)
app.include_router(permissions.router, prefix="/permissions", tags=["permissions"])  # no self-prefix
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(pipelines.router, prefix="/pipelines", tags=["pipelines"])
app.include_router(kanban.router, prefix="/kanban", tags=["kanban"])
app.include_router(calendar.router, prefix="/calendar", tags=["calendar"])

# v1 versioned API
_V1 = "/api/v1"
app.include_router(v1_me.router, prefix=_V1)
app.include_router(v1_agent_configs.router, prefix=_V1)
app.include_router(v1_tasks.router, prefix=_V1)
app.include_router(v1_team.router, prefix=_V1)
app.include_router(v1_activity.router, prefix=_V1)
app.include_router(v1_analytics.router, prefix=_V1)
app.include_router(files_core.router, prefix=_V1)
app.include_router(files_bulk.router, prefix=_V1)
app.include_router(files_trash.router, prefix=_V1)
app.include_router(files_share.router, prefix=_V1)
app.include_router(files_drive.router, prefix=_V1)
app.include_router(files_misc.router, prefix=_V1)
app.include_router(v1_webhooks.router, prefix=_V1)
app.include_router(v1_chat.router, prefix=_V1)
app.include_router(v1_presence_mod.router, prefix=_V1)
app.include_router(v1_presence_mod.ws_router, prefix=_V1)


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
def health_check():
    """Minimal liveness probe — does not touch Firestore."""
    return {"status": "ok"}


# ── Seed helpers ───────────────────────────────────────────────────────────────

_DEFAULT_PERMISSIONS: list[tuple[str, str]] = [
    # (role, permission)
    ("admin",   "tasks:view"),
    ("admin",   "tasks:create"),
    ("admin",   "tasks:edit"),
    ("admin",   "tasks:delete"),
    ("admin",   "team:view"),
    ("admin",   "team:manage"),
    ("admin",   "analytics:view"),
    ("admin",   "files:view"),
    ("admin",   "files:upload"),
    ("admin",   "files:delete"),
    ("manager", "tasks:view"),
    ("manager", "tasks:create"),
    ("manager", "tasks:edit"),
    ("manager", "team:view"),
    ("manager", "analytics:view"),
    ("manager", "files:view"),
    ("manager", "files:upload"),
    ("member",  "tasks:view"),
    ("member",  "tasks:create"),
    ("member",  "files:view"),
]


def _seed_default_permissions(db: firestore.Client) -> None:
    """Write default RBAC permission documents to Firestore.

    Each permission is stored as ``role_permissions/{role}_{permission}``.
    Uses ``create()`` semantics so existing documents are never overwritten.
    """
    col = db.collection("role_permissions")
    for role, perm in _DEFAULT_PERMISSIONS:
        doc_id = f"{role}_{perm.replace(':', '_')}"
        doc_ref = col.document(doc_id)
        if not doc_ref.get().exists:
            doc_ref.set({
                "role": role,
                "permission": perm,
                "created_at": datetime.now(timezone.utc),
            })


_SEED_TASKS: list[dict[str, Any]] = [
    {
        "id": "TASK-001",
        "title": "Set up project repository",
        "description": "Initialize the Git repository and configure CI/CD pipeline.",
        "status": "done",
        "priority": "high",
        "assignees": ["Alice Johnson"],
        "due_date": "2025-01-15",
        "tags": ["setup", "devops"],
    },
    {
        "id": "TASK-002",
        "title": "Design database schema",
        "description": "Create the initial entity-relationship diagram.",
        "status": "done",
        "priority": "high",
        "assignees": ["Bob Smith"],
        "due_date": "2025-01-20",
        "tags": ["design", "database"],
    },
    {
        "id": "TASK-003",
        "title": "Implement authentication system",
        "description": "Build login, registration, and JWT token management.",
        "status": "in-progress",
        "priority": "high",
        "assignees": ["Carol Davis"],
        "due_date": "2025-02-01",
        "tags": ["auth", "backend"],
    },
    {
        "id": "TASK-004",
        "title": "Create dashboard UI",
        "description": "Build the main dashboard with KPI cards and charts.",
        "status": "in-progress",
        "priority": "medium",
        "assignees": ["Dave Wilson"],
        "due_date": "2025-02-10",
        "tags": ["frontend", "ui"],
    },
    {
        "id": "TASK-005",
        "title": "Write API documentation",
        "description": "Document all REST endpoints using OpenAPI spec.",
        "status": "todo",
        "priority": "medium",
        "assignees": ["Eve Martinez"],
        "due_date": "2025-02-15",
        "tags": ["documentation"],
    },
    {
        "id": "TASK-006",
        "title": "Performance optimization",
        "description": "Profile the backend and optimize slow database queries.",
        "status": "todo",
        "priority": "low",
        "assignees": ["Frank Brown"],
        "due_date": "2025-03-01",
        "tags": ["performance", "backend"],
    },
]


def _seed_initial_tasks(db: firestore.Client) -> None:
    """Seed initial task documents into Firestore on first run.

    Uses ``create()`` semantics so this is idempotent — re-running the
    application will never overwrite modified tasks.  Each seed document is
    written with the full canonical schema so the router's normalizer never
    has to fill in defaults for seed data.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    col = db.collection("tasks")
    for task in _SEED_TASKS:
        doc_ref = col.document(task["id"])
        if not doc_ref.get().exists:
            doc_ref.set({
                **task,
                "created_at": today,
                "completed_at": None,
                "updated_at": None,
                "sub_tasks": [],
                "comments": [],
            })


def _seed_admin_user(db: firestore.Client) -> None:
    """Create the first admin user account on startup if one does not exist.

    Reads ``ADMIN_EMAIL`` and ``ADMIN_PASSWORD`` from environment variables.
    Skipped entirely when either variable is missing, or when a user with
    ``is_admin=True`` already exists in Firestore (i.e. fully idempotent).

    This runs on every startup but does nothing after the first successful run.
    """
    from firebase_admin import auth as fb_auth

    email = os.getenv("ADMIN_EMAIL", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "").strip()

    if not email or not password:
        # Nothing to do — admin seeding is opt-in via env vars
        return

    # Check if any admin already exists to keep this truly idempotent
    existing_admins = list(
        db.collection("users").where("is_admin", "==", True).limit(1).stream()
    )
    if existing_admins:
        return

    now = datetime.now(timezone.utc)

    # Try to find an existing Firebase Auth user with this email first
    try:
        fb_user = fb_auth.get_user_by_email(email)
        uid = fb_user.uid
        # Update password in case it changed
        fb_auth.update_user(uid, password=password, display_name="Admin")
    except fb_auth.UserNotFoundError:
        # Create a fresh Firebase Auth account
        fb_user = fb_auth.create_user(
            email=email,
            password=password,
            display_name="Admin",
        )
        uid = fb_user.uid
    except Exception as exc:
        logger.error("[startup] Could not create/update admin Firebase Auth account: %s", exc)
        return

    # Write (or overwrite) the Firestore profile with admin privileges
    db.collection("users").document(uid).set({
        "name": "Admin",
        "email": email,
        "role": "admin",
        "is_admin": True,
        "is_active": True,
        "bio": None,
        "avatar_url": None,
        "created_at": now,
        "updated_at": None,
    })

    logger.info("[startup] Admin account seeded successfully.")