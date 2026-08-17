# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
work-management-system/
├── backend/     # FastAPI + SQLAlchemy Python backend
└── frontend/    # Next.js web application
```

Frontend commands run from `frontend/`. Backend commands run from `backend/`.

## Performance Policy

- You may run `pnpm lint` or `tsc --noEmit` when needed.
- Do not wrap them in long shell pipelines (`grep`, `sed`, `awk`, `xargs`, `find`, `head`, `tail`, complex pipes, or command chains) unless I explicitly request it.
- Prefer running commands directly and inspect the output yourself instead of filtering it through shell pipelines.
- Avoid repeatedly re-running the same validation command after every edit.
- Run validation only when it provides new information.

## CRITICAL RULES

**NEVER start dev servers or backend processes on your own.** Do not run `pnpm dev`, `uvicorn`, `npm start`, or any server/process that binds to a port. The user manages their own servers. If verification requires a running server, ask the user to start it — do not start it yourself.

**NEVER run `pnpm typecheck` (or `tsc --noEmit`) without explicit user instruction.** It is resource-intensive and can crash the user's machine. Do not run it as part of verification, post-edit checks, or any autonomous workflow.

## Commands

**Frontend** — run from `frontend/`:
```bash
pnpm build      # Production build
pnpm lint       # ESLint
pnpm format     # Prettier (writes in place)
```

**Backend** — run from `backend/` with venv active (`source .venv/bin/activate`):
```bash
pip install -r requirements.txt           # Install dependencies
uvicorn app.main:app --reload --port 3052  # Dev server (port 3052)
alembic upgrade head                      # Apply DB migrations (alembic/ dir is at backend/alembic/)
alembic revision --autogenerate -m "..."  # Generate migration from model changes
```

**Docker** — run from the repo root:
```bash
docker-compose up --build   # Build and start all services (frontend :3000, backend :3052, postgres :5433)
```

There are no tests in this project.

## Environment Variables

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_MOCK_AUTH=true       # Bypass real API auth, use localStorage mock user
NEXT_PUBLIC_API_URL=             # Backend base URL (defaults to http://localhost:3052)
```

**Backend** (`backend/.env`):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workos
SECRET_KEY=...          # JWT signing key
FRONTEND_URL=http://localhost:3000
# Cloudflare R2 (optional — if set, files are stored in R2 instead of local disk)
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=          # Public base URL for serving R2 files
FILE_STORAGE_PATH=      # Override where uploaded files are stored on disk (local mode only)
```

## Architecture

Next.js 16 App Router project under `frontend/`. All routes live under `frontend/app/`, all reusable UI under `frontend/components/`.

**Pages:**
- `/` — Landing page (marketing, no sidebar); authenticated users are redirected to `/home`
- `/home` — Main app home (overview with KPI cards, charts, upcoming tasks, recent activity)
- `/board` — Kanban pipeline board (standalone route)
- `/dashboard` — Dashboard alias; `/dashboard/board` also exists
- `/analytics` and `/analytics/board` — Analytics views
- `/calendar` — Calendar view
- `/tasks` — Task list
- `/team` — Team member management
- `/files/[[...path]]` — File explorer (catch-all route for nested directories)
- `/pipelines` and `/pipelines/[id]` — Pipeline list and detail
- `/projects/[slug]` — Project detail
- `/docs` — Docs page
- `/profile` — User profile page
- `/settings` — App settings page
- `/admin` — Admin panel (requires `is_admin`; redirects to `/home` otherwise)
- `/admin/activity` — Full activity log
- `/admin/roles` — Role permission management
- `/agent-builder` — Agent/bot builder UI
- `/(auth)/login`, `/(auth)/register`, `/(auth)/forgot-password`, `/(auth)/reset-password` — Auth pages (no sidebar, own layout)

**API Routes** (all deleted/moved to backend — files are now served via backend v1 API):
- File operations (list, upload, rename, move, delete, raw preview, zip download) are handled by `backend/app/routers/v1/files.py` via `POST /api/v1/files/...`

**Sidebar layout pattern:** Every app page (not landing/auth) wraps content in:
```tsx
<SidebarProvider style={{ "--sidebar-width": "...", "--header-height": "..." } as React.CSSProperties}>
  <AppSidebar variant="inset" />
  <SidebarInset>
    <SiteHeader />
    <main>...</main>
  </SidebarInset>
</SidebarProvider>
```

**File system:** Files are stored locally under `frontend/data/` by default. If Cloudflare R2 env vars are set, `backend/app/r2.py` handles all storage operations (upload/download/delete/list) against R2 instead. `frontend/lib/actions/files.ts` contains Server Actions that call the backend v1 files API. Path traversal is prevented via `getSafePath()` in each action. Server Actions `bodySizeLimit` is set to `2gb` in `frontend/next.config.mjs`.

**State:** No real database on the frontend. Kanban state is in-memory React state (resets on refresh); hardcoded in `frontend/components/dashboard/board/kanban-board.tsx`. Tasks and activity log are persisted to `localStorage` via `useLocalStorage` (`wms:tasks`, `wms:activity`) — initial seed comes from `MOCK_TASKS` in `frontend/types/task.ts`. Team member seed data is in `frontend/contexts/team-context.tsx`. Dashboard chart data comes from `frontend/app/dashboard/data.json`. File explorer is the only server-rendered page, refreshed via `revalidatePath`.

**Auth:** `frontend/contexts/auth-context.tsx` provides `AuthProvider` / `useAuth()` (exposes `user`, `loading`, `login`, `logout`, `updateUser`). When `NEXT_PUBLIC_MOCK_AUTH=true`, auth bypasses the real API and stores a mock user in `localStorage` (`wms:mock_user`). In real mode, `frontend/lib/auth.ts` stores JWT tokens in `localStorage` (`wos_access_token`, `wos_refresh_token`) and syncs a `has_session` cookie. `frontend/proxy.ts` is the Next.js middleware (named `proxy.ts` instead of the conventional `middleware.ts`): it reads the `has_session`, `is_admin`, and `user_role` cookies to gate all protected routes, redirect away from auth pages when already logged in, and block non-admin users from `/admin`. `frontend/lib/api.ts` is the typed API client (base URL from `NEXT_PUBLIC_API_URL`, defaults to `http://localhost:3052`) with automatic token refresh on 401.

**Contexts:** Four global providers wrap the app in `frontend/app/layout.tsx` (in nesting order): `AuthProvider`, `PermissionsProvider` (`frontend/contexts/permissions-context.tsx` — RBAC checks, use `usePermissions()`), `TaskProvider` (`frontend/contexts/task-context.tsx` — shared task CRUD + activity log, use `useTasks()`), and `TeamProvider` (`frontend/contexts/team-context.tsx`, use `useTeam()`). Always use these hooks instead of prop-drilling. Additional page-scoped contexts in `frontend/contexts/`: `CalendarContext`, `NotificationsContext`, `PipelineContext`, `PresenceContext`, `ProjectContext`.

**Custom hooks:** `frontend/contexts/` also contains standalone hooks (not providers): `use-local-storage.ts`, `use-mobile.ts`, `use-permission.ts`, `use-pinned-folders.ts`. Check here before writing a new hook.

**Naming collision:** There are two unrelated `Task` types. `frontend/types/task.ts` defines the Tasks-page `Task` (fields: `title`, `status`, `assignee`, `dueDate`, `tags`). `frontend/components/dashboard/board/kanban-card.tsx` defines the Kanban `Task` (fields: `content`, `columnId`, `priority`, `tags`). Never import one where the other is expected.

**TeamMember type:** Exported from `frontend/contexts/team-context.tsx` alongside `useTeam`. `frontend/app/team/page.tsx` and `frontend/app/admin/page.tsx` both import it from there.

**Tables:** `@tanstack/react-table` v8 powers both the Tasks table (`frontend/components/tasks/task-table.tsx`) and the Team table (`frontend/components/team/team-table.tsx`). Column definitions for Tasks are split into `frontend/components/tasks/task-columns.tsx`.

**Charts:** `recharts` used on the dashboard. **Calendar:** `react-day-picker` + `date-fns`.

**Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable` used for the Kanban board and file drag interactions.

**Generic reorderable table:** `frontend/components/data-table.tsx` is a standalone drag-to-reorder table (dnd-kit vertical sort) — distinct from the Tasks and Team tables which use `@tanstack/react-table`.

**UI components:** shadcn/ui with `radix-nova` style, Tailwind CSS v4, CSS variables for theming. Add new shadcn components with `pnpm dlx shadcn add <name>` (run from `frontend/`). Icons from `lucide-react`. Toasts via `sonner`. Drawers via `vaul`.

**Design tokens:** `frontend/brand-style.md` documents the full color palette, typography, spacing, and component style rules derived from `frontend/app/globals.css`. All colors use `oklch`. Consult it before adding new colors or overriding tokens.

**Path alias:** `@/*` maps to the `frontend/` root (e.g. `@/components/ui/button`).

**Lib:** `frontend/lib/` contains: `api.ts` (typed API client), `auth.ts` (token storage helpers), `permissions.ts` (RBAC helper functions), `utils.ts` (Tailwind `cn()` merge), `server-auth.ts` (server-side auth helpers), `google-oauth.ts` (Google OAuth helpers), `custom-nav.ts` (navigation helpers), and `actions/` (Next.js Server Actions: `files.ts`).

**Types:** Shared TypeScript types live in `frontend/types/`. Contains `task.ts` (Tasks-page `Task` type + `MOCK_TASKS` seed), `pipeline.ts`, `project.ts`, and `agent.ts` (agent/bot builder types).

**Fonts:** Geist (sans), Instrument Serif, Geist Mono — loaded via `next/font/google` and exposed as CSS variables (`--font-sans`, `--font-instrument-serif`, `--font-mono`) in `frontend/app/layout.tsx`. (Note: the variable is named `--font-sans` even though the font is Geist, not Inter.)

**Theme:** Dark/light via `next-themes` (`frontend/components/layout/theme-provider.tsx`). Toggle in `frontend/components/layout/mode-toggle.tsx`.

## Backend Architecture

FastAPI + SQLModel application in `backend/app/`. SQLModel combines Pydantic v2 and SQLAlchemy; Alembic handles migrations. Activate the venv at `backend/.venv` before running any Python commands.

**Entry point:** `backend/app/main.py` — creates the app, registers all routers, configures CORS (allowed origin from `FRONTEND_URL` env var, defaults to `http://localhost:3000`). On startup: creates tables, runs idempotent column migrations (`migrate_db()`), seeds initial tasks (only on first run when no users exist), seeds roles, seeds default RBAC permissions, and cleans up expired tokens.

**Flat module layout**:
- `app/models.py` — all SQLModel table models (`User`, `Task`, `RolePermission`, `PasswordResetToken`, `CustomRole`, etc.)
- `app/schemas.py` — all Pydantic request/response schemas
- `app/database.py` — engine (`DATABASE_URL` env var, defaults to `postgresql://postgres:postgres@localhost:5432/workos`), `get_session` FastAPI dependency
- `app/security.py` — JWT creation/decoding (python-jose), password hashing (passlib/bcrypt)
- `app/deps.py` — `get_current_user` FastAPI dependency
- `app/r2.py` — Cloudflare R2 storage client (boto3/s3 compatible); used by the v1 files router when R2 env vars are present
- `app/routers/` — one file per domain: `auth`, `users`, `admin`, `bots`, `tasks`, `activity`, `team`, `analytics`, `permissions`
- `app/routers/v1/` — versioned public API (`/api/v1`): `me`, `tasks`, `team`, `activity`, `analytics`, `files`, `webhooks`, `chat`, `presence` — accepts both JWT and API key auth

**File storage routing:** `app/routers/v1/files.py` checks for R2 env vars at request time. If `CLOUDFLARE_ACCOUNT_ID` / `R2_BUCKET_NAME` are set it delegates to `app/r2.py`; otherwise it reads/writes from `FILE_STORAGE_PATH` (defaults to `frontend/data/` relative to the repo root).

**Auth:** JWT access + refresh tokens. `POST /auth/register`, `POST /auth/login` return both. `POST /auth/refresh` rotates access token. Password reset is mock-email only (prints reset URL to stdout). Google OAuth is wired in the auth router.

**RBAC:** Three roles (`admin`, `manager`, `member`) with per-permission grants stored in `RolePermission` table. Default permissions are seeded at startup in `app/routers/permissions.py`. Admin users: `is_admin=True` OR `role="admin"` — both are checked. Frontend enforces RBAC via `frontend/contexts/permissions-context.tsx` and `frontend/lib/permissions.ts`; `frontend/components/auth/access-denied.tsx` is the blocked-access fallback UI.

**Docker topology** (`docker-compose.yml`):
- `frontend` — Next.js, port 3000, standalone output
- `backend` — FastAPI via `entrypoint.sh` (runs migrations then uvicorn), port 3052
- `db` — PostgreSQL 15, port 5433 (host) → 5432 (container), volume `pgdata`