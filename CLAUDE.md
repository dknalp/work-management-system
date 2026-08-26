# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
work-management-system/
├── backend/     # FastAPI + Firebase Firestore backend
└── frontend/    # Next.js web application
```

Frontend commands run from `frontend/`. Backend commands run from `backend/`.

---

## Commands

**Frontend** — run from `frontend/`:
```bash
pnpm build          # Production build
pnpm lint           # ESLint
pnpm format         # Prettier (writes in place)
```

**Backend** — run from `backend/` with venv active (`source .venv/bin/activate`):
```bash
pip install -r requirements.txt           # Install dependencies
uvicorn app.main:app --reload --port 3052 # Dev server (port 3052)
pytest tests/                             # Run all backend tests
pytest tests/test_tasks.py               # Run a single test file
pytest tests/test_tasks.py::test_name    # Run a single test function
```

There are no migrations — Firestore is schemaless. Default permissions and seed tasks are written on first startup automatically (idempotent).

**Docker** — run from the repo root:
```bash
docker-compose up --build   # Build and start all services (frontend :3051, backend :3052)
```

---

## CRITICAL RULES

**NEVER start dev servers or backend processes on your own.** Do not run `pnpm dev`, `uvicorn`, `npm start`, or any server/process that binds to a port. The user manages their own servers. If verification requires a running server, ask the user to start it.

**NEVER run `pnpm typecheck` (or `tsc --noEmit`) without explicit user instruction.** It is resource-intensive and can crash the user's machine.

---

## Environment Variables

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_MOCK_AUTH=true       # Bypass real API auth, use localStorage mock user
NEXT_PUBLIC_API_URL=             # Backend base URL (defaults to http://localhost:3052)
```

**Backend** (`backend/.env`):
```bash
FIREBASE_SERVICE_ACCOUNT_JSON=   # Path to service account JSON, or raw JSON; falls back to ADC
FRONTEND_URL=http://localhost:3051
# Cloudflare R2 (optional — if set, files go to R2 instead of local disk)
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
FILE_STORAGE_PATH=               # Override local file storage path (default: frontend/data/)
```

---

## Frontend Architecture

Next.js 16 App Router project under `frontend/`. All routes live under `frontend/app/`, all reusable UI under `frontend/components/`.

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing page (no sidebar); authenticated users redirect to `/home` |
| `/home` | App home: KPI cards, charts, upcoming tasks, recent activity |
| `/board`, `/dashboard/board` | Kanban pipeline board |
| `/analytics`, `/analytics/board` | Analytics views |
| `/calendar` | Calendar view |
| `/tasks` | Task list (TanStack Table) |
| `/team` | Team member management |
| `/files/[[...path]]` | File explorer (catch-all, server-rendered) |
| `/pipelines`, `/pipelines/[id]` | Pipeline list and detail |
| `/projects/[slug]` | Project detail |
| `/profile`, `/settings` | User profile and app settings |
| `/admin`, `/admin/activity`, `/admin/roles` | Admin panel (requires `is_admin`) |
| `/agent-builder` | Agent/bot builder UI |
| `/(auth)/login` etc. | Auth pages (no sidebar, own layout) |

### Sidebar layout pattern

Every app page (not landing/auth) wraps content in:
```tsx
<SidebarProvider style={{ "--sidebar-width": "...", "--header-height": "..." } as React.CSSProperties}>
  <AppSidebar variant="inset" />
  <SidebarInset>
    <SiteHeader />
    <main>...</main>
  </SidebarInset>
</SidebarProvider>
```

### State and data

- **Tasks/activity:** Persisted to `localStorage` via `useLocalStorage` (`wms:tasks`, `wms:activity`). Initial seed from `MOCK_TASKS` in `frontend/types/task.ts`.
- **Kanban board:** In-memory React state only (resets on refresh). Hardcoded in `frontend/components/dashboard/board/kanban-board.tsx`.
- **Team:** Seeded in `frontend/contexts/team-context.tsx`.
- **Dashboard charts:** Static JSON at `frontend/app/dashboard/data.json`.
- **Files:** Only server-rendered page, refreshed via `revalidatePath`.

### Auth

`frontend/contexts/auth-context.tsx` → `AuthProvider` / `useAuth()` (exposes `user`, `loading`, `login`, `logout`, `updateUser`).

- When `NEXT_PUBLIC_MOCK_AUTH=true`, bypasses the API and stores a mock user in `localStorage` (`wms:mock_user`).
- In real mode, `frontend/lib/auth.ts` stores JWT tokens in `localStorage` (`wos_access_token`, `wos_refresh_token`) and syncs a `has_session` cookie.
- `frontend/proxy.ts` is the Next.js middleware (named `proxy.ts`, not `middleware.ts`): reads `has_session`, `is_admin`, and `user_role` cookies to gate protected routes, redirect from auth pages when logged in, and block non-admin from `/admin`.
- `frontend/lib/api.ts` is the typed API client (base URL from `NEXT_PUBLIC_API_URL`, defaults to `http://localhost:3052`) with automatic token refresh on 401.

### Global contexts (in nesting order in `frontend/app/layout.tsx`)

1. `AuthProvider` — user identity
2. `PermissionsProvider` (`frontend/contexts/permissions-context.tsx`) — RBAC checks via `usePermissions()`
3. `TaskProvider` (`frontend/contexts/task-context.tsx`) — shared task CRUD + activity log via `useTasks()`
4. `TeamProvider` (`frontend/contexts/team-context.tsx`) — team members via `useTeam()`

Always use these hooks instead of prop-drilling. Page-scoped contexts also in `frontend/contexts/`: `CalendarContext`, `NotificationsContext`, `PipelineContext`, `PresenceContext`, `ProjectContext`.

Standalone hooks (not providers) in `frontend/contexts/`: `use-local-storage.ts`, `use-mobile.ts`, `use-permission.ts`, `use-pinned-folders.ts`. Check here before writing a new hook.

### Naming collision — two `Task` types

| Type | File | Fields |
|---|---|---|
| Tasks-page `Task` | `frontend/types/task.ts` | `title`, `status`, `assignee`, `dueDate`, `tags` |
| Kanban `Task` | `frontend/components/dashboard/board/kanban-card.tsx` | `content`, `columnId`, `priority`, `tags` |

Never import one where the other is expected.

### Other important types

- **`TeamMember`** — exported from `frontend/contexts/team-context.tsx` alongside `useTeam`. Both `frontend/app/team/page.tsx` and `frontend/app/admin/page.tsx` import from there.

### Key libraries

| Purpose | Library |
|---|---|
| Tables | `@tanstack/react-table` v8 (`task-table.tsx`, `team-table.tsx`; column defs split to `task-columns.tsx`) |
| Drag-to-reorder table | `frontend/components/data-table.tsx` (dnd-kit vertical sort, distinct from TanStack tables) |
| Charts | `recharts` (dashboard) |
| Calendar | `react-day-picker` + `date-fns` |
| Drag & drop (Kanban/files) | `@dnd-kit/core` + `@dnd-kit/sortable` |
| UI components | shadcn/ui (`radix-nova` style), Tailwind CSS v4, `lucide-react` icons |
| Toasts | `sonner` |
| Drawers | `vaul` |

Add new shadcn components with `pnpm dlx shadcn add <name>` (from `frontend/`).

### Design tokens

`frontend/brand-style.md` documents the full color palette, typography, spacing, and component style rules. All colors use `oklch`. Consult before adding new colors or overriding tokens.

### Path alias

`@/*` maps to `frontend/` root (e.g. `@/components/ui/button`).

### Lib directory

`frontend/lib/` contains: `api.ts`, `auth.ts`, `permissions.ts`, `utils.ts` (Tailwind `cn()`), `server-auth.ts`, `google-oauth.ts`, `custom-nav.ts`, `actions/files.ts` (Server Actions for file operations).

### Fonts

Geist (sans), Instrument Serif, Geist Mono — loaded via `next/font/google`, exposed as `--font-sans`, `--font-instrument-serif`, `--font-mono`. Note: the variable is `--font-sans` even though the font is Geist.

### Theme

Dark/light via `next-themes` (`frontend/components/layout/theme-provider.tsx`). Toggle in `frontend/components/layout/mode-toggle.tsx`.

---

## Backend Architecture

FastAPI + Firebase application in `backend/app/`. Firestore is the primary database; Firebase Authentication handles user auth. Activate the venv at `backend/.venv` before running any Python commands.

### Entry point: `backend/app/main.py`

Initializes Firebase Admin SDK, registers all routers, configures CORS (allowed origin from `FRONTEND_URL`, defaults to `http://localhost:3000`). On startup: seeds default RBAC permissions and initial tasks (idempotent).

**Adding a new router:** import it in `main.py` and call `app.include_router(router, prefix="/...")`. Then add it to `app/routers/__init__.py` (or `app/routers/v1/__init__.py` for v1 routes).

### Module layout

| File | Responsibility |
|---|---|
| `app/models.py` | Plain Pydantic `BaseModel` classes matching Firestore collections (no ORM) |
| `app/schemas.py` | All Pydantic request/response schemas |
| `app/firebase.py` | Firebase Admin SDK init (`initialize_firebase()`) and `get_db()` FastAPI dependency |
| `app/firebase_auth.py` | `verify_firebase_token()` wrapping Firebase Admin `auth.verify_id_token()` |
| `app/security.py` | API key generation and SHA-256 hashing (no JWT, no bcrypt) |
| `app/deps.py` | `get_current_actor` / `get_current_user` / `require_permission` FastAPI dependencies |
| `app/r2.py` | Cloudflare R2 storage client (boto3/s3-compatible) |

### Routers

`app/routers/` — one file per domain, no versioning: `auth`, `users`, `admin`, `bots`, `tasks`, `activity`, `team`, `analytics`, `permissions`, `projects`, `pipelines`, `kanban`, `calendar`.

`app/routers/v1/` — versioned public API (`/api/v1`), accepts both Firebase ID tokens and bot API keys: `me`, `tasks`, `team`, `activity`, `analytics`, `files_*` (see below), `webhooks`, `chat`, `presence`, `agent_configs`.

### File storage routers (all under `app/routers/v1/`)

| Module | Handles |
|---|---|
| `files_core.py` | List, upload, download, rename, delete (basic CRUD) |
| `files_bulk.py` | Bulk move, copy, and trash |
| `files_trash.py` | Trash management (list, restore, permanent delete) |
| `files_share.py` | Share links (create/revoke, access by token) |
| `files_drive.py` | Recursive Google Drive folder import with SSE progress |
| `files_misc.py` | Zip download, raw preview, other utilities |
| `files_utils.py` | Shared helpers (path safety, storage backend selection) |

Each module checks for R2 env vars at request time. If `CLOUDFLARE_ACCOUNT_ID` / `R2_BUCKET_NAME` are set it delegates to `app/r2.py`; otherwise reads/writes from `FILE_STORAGE_PATH` (defaults to `frontend/data/` relative to repo root). File metadata is stored in Firestore `file_records` collection; file bytes live in R2 or on disk.

### Auth model

Firebase Authentication. `POST /auth/register` creates a Firebase Auth user + a Firestore `users/{uid}` profile document. Login is **client-side** via the Firebase JS SDK; the resulting ID token is verified server-side via `firebase_admin.auth.verify_id_token()`. Password reset uses Firebase's built-in link generation.

### RBAC

Three built-in roles (`admin`, `manager`, `member`) with per-permission grants stored in `role_permissions` Firestore collection (document ID: `{role}_{permission}`). Default permissions seeded at startup in `app/routers/permissions.py`. Admin: `is_admin=True` OR `role="admin"` — both are checked. Frontend enforces RBAC via `permissions-context.tsx` and `lib/permissions.ts`; `components/auth/access-denied.tsx` is the blocked-access fallback.

### Docker topology (`docker-compose.yml`)

- `frontend` — Next.js, port 3051, standalone output
- `backend` — FastAPI via `entrypoint.sh`, port 3052
- No database container — Firestore is a hosted Firebase service

---

## Agent Team (added by workers-init on 2026-08-21)

This project uses the **team-lead agent system**.

### Mandatory behavior

- Complex or multi-step tasks → Team Lead MUST coordinate workers
- Team Lead MUST NOT implement features directly — spawn the appropriate worker
- Workers available: worker-frontend, worker-backend, worker-tester, worker-reviewer,
  worker-devops, worker-researcher, worker-architect, worker-security

### Auto-detected stack

- **Language/Runtime:** TypeScript (Node 20) + Python 3.x
- **Framework:** Next.js 16 (App Router) + FastAPI
- **Test runner:** not detected (no jest/vitest/pytest config found)
- **Services:** frontend (port 3051), backend (port 3052), db — PostgreSQL 15 (port 5433)