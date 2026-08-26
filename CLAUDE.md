# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
work-management-system/
├── backend/     # FastAPI + Firebase Firestore backend
└── frontend/    # Next.js web application
```

Frontend commands run from `frontend/`. Backend commands run from `backend/`.

## Non-Negotiable Session Rules

These apply to every task in every conversation — no exceptions, no shortcuts:

1. **Maintainable & readable code.** Every piece of code you write must be understandable to a stranger with no prior context. Clear naming, single-responsibility functions, no clever tricks that sacrifice clarity for brevity.
2. **No dead code.** Never leave commented-out code, unused imports, unused variables, or abandoned functions in the codebase. If something is removed, remove it completely.
3. **Comments in English — always.** Every module opens with a docstring stating what it owns. Every non-trivial function has a docstring (purpose, params, return, gotchas). Inline comments explain *why*, not *what*. Magic numbers, business rules, and non-obvious constraints must be commented. Use standard Python docstrings and JSDoc (`/** */`) in TypeScript.
4. **Tests are mandatory.** Before considering any non-trivial feature or bug fix done, write a corresponding test in `backend/tests/` (Python) or `frontend/tests/` (TypeScript). A task is not complete until a test exists that would catch its regression.

## Performance Policy

- You may run `pnpm lint` or `tsc --noEmit` when needed.
- Do not wrap them in long shell pipelines (`grep`, `sed`, `awk`, `xargs`, `find`, `head`, `tail`, complex pipes, or command chains) unless I explicitly request it.
- Prefer running commands directly and inspect the output yourself instead of filtering it through shell pipelines.
- Avoid repeatedly re-running the same validation command after every edit.
- Run validation only when it provides new information.

## CRITICAL RULES

**NEVER start dev servers or backend processes on your own.** Do not run `pnpm dev`, `uvicorn`, `npm start`, or any server/process that binds to a port. The user manages their own servers. If verification requires a running server, ask the user to start it — do not start it yourself.

**NEVER run `pnpm typecheck` (or `tsc --noEmit`) without explicit user instruction.** It is resource-intensive and can crash the user's machine. Do not run it as part of verification, post-edit checks, or any autonomous workflow.

## Engineering Philosophy

Write code for the version of this codebase that exists 10 years and 40 releases from now, not just for today's ticket.

**Maintainability over quick fixes.** Never patch around a problem to make it pass — fix the root cause. If a proper fix requires touching more files, do it. Hacks compound; a codebase full of them becomes unmaintainable within a year.

**File size discipline.** Keep files under ~300 lines. If a file grows past 400–500 lines, split it into focused modules (the `files.py` → `files_core.py` / `files_bulk.py` / etc. split is the reference pattern for how to do this). Each file should have one clear responsibility that fits in a single sentence.

**Readable, not clever.** Name variables, functions, and modules for what they do, not how they do it. A future engineer should understand a function's intent in 10 seconds without reading its implementation.

**Documentation & comments.** Write comments for the developer who joins this project two years from now with zero context. Every module must open with a docstring explaining what it owns and what it does not own. Every non-trivial function must have a docstring covering its purpose, parameters, return value, and any gotchas. Inline comments should explain *why* a decision was made, not *what* the code literally does — the code already shows the what. Comment on business rules, edge cases, magic numbers, and non-obvious constraints. In Python use standard docstring format; in TypeScript use JSDoc (`/** ... */`). A function that is hard to explain in a comment is a signal it needs to be broken up.

**Explicit interfaces.** Every function's inputs and outputs must be clear from its signature alone — typed parameters, typed return values, no implicit side effects hidden in the body. In Python, use full type annotations. In TypeScript, avoid `any`.

**Test before done.** When adding a non-trivial function or fixing a bug, write a test in `backend/tests/` (Python) or `frontend/tests/` (TypeScript). Tests are named after the module they cover (`test_files_core.py`, `test_bulk_operations.py`). Do not mark a task done until a test exists that would catch its regression — "it works" is not verification, a passing test is.

**No dead code.** If you remove a feature or refactor a path, delete the old code immediately in the same commit. Commented-out code, unused imports, and abandoned functions are noise that misleads future readers and must never be left behind.

**Change blast radius.** Before editing a shared utility, type, or model, check how many files import it. Prefer adding a new focused helper over modifying a widely-used one. If you must change a shared contract, update all call sites in the same commit.

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

---

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
```

There are no migrations — Firestore is schemaless. Default permissions and seed tasks are written on first startup automatically (idempotent).

**Docker** — run from the repo root:
```bash
docker-compose up --build   # Build and start all services (frontend :3051, backend :3052)
```

## Environment Variables

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_MOCK_AUTH=true       # Bypass real API auth, use localStorage mock user
NEXT_PUBLIC_API_URL=             # Backend base URL (defaults to http://localhost:3052)
```

**Backend** (`backend/.env`):
```bash
# Path to Firebase service account JSON key file, OR the raw JSON string.
# Falls back to Application Default Credentials (ADC) when unset.
FIREBASE_SERVICE_ACCOUNT_JSON=
FRONTEND_URL=http://localhost:3051
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
- File operations are handled by the split file routers under `backend/app/routers/v1/files_*.py` via `/api/v1/files/...`
- Google Drive import streams progress via SSE (`/api/v1/files/drive/import`)
- Bulk operations (move, copy, trash) via `/api/v1/files/bulk/...`
- Share links via `/api/v1/files/share/...`

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

FastAPI + Firebase application in `backend/app/`. Firestore is the primary database; Firebase Authentication handles user auth. Activate the venv at `backend/.venv` before running any Python commands. There are no migrations — Firestore is schemaless.

**Entry point:** `backend/app/main.py` — initializes Firebase Admin SDK, registers all routers, configures CORS (allowed origin from `FRONTEND_URL` env var, defaults to `http://localhost:3000`). On startup: seeds default RBAC permissions and initial tasks (idempotent — never overwrites existing documents).

**Flat module layout**:
- `app/models.py` — plain Pydantic `BaseModel` classes matching Firestore collections (no SQLAlchemy)
- `app/schemas.py` — all Pydantic request/response schemas
- `app/firebase.py` — Firebase Admin SDK initialization (`initialize_firebase()`) and `get_db()` FastAPI dependency
- `app/firebase_auth.py` — `verify_firebase_token()` wrapper around Firebase Admin `auth.verify_id_token()`
- `app/security.py` — API key generation and SHA-256 hashing (no JWT, no bcrypt)
- `app/deps.py` — `get_current_actor` / `get_current_user` / `require_permission` FastAPI dependencies
- `app/r2.py` — Cloudflare R2 storage client (boto3/s3 compatible); used by the v1 files router when R2 env vars are present
- `app/routers/` — one file per domain: `auth`, `users`, `admin`, `bots`, `tasks`, `activity`, `team`, `analytics`, `permissions`, `projects`, `pipelines`, `kanban`, `calendar`
- `app/routers/v1/` — versioned public API (`/api/v1`): `me`, `tasks`, `team`, `activity`, `analytics`, `files`, `webhooks`, `chat`, `presence` — accepts both Firebase ID tokens and bot API keys

**File storage routing:** The v1 files API has been split into focused modules under `app/routers/v1/`:
- `files_core.py` — list, upload, download, rename, delete (basic CRUD)
- `files_bulk.py` — bulk move, copy, and trash operations
- `files_trash.py` — trash management (list, restore, permanent delete)
- `files_share.py` — file sharing (create/revoke share links, access by token)
- `files_drive.py` — recursive Google Drive folder import with progress tracking (SSE)
- `files_misc.py` — zip download, raw preview, and other utilities
- `files_utils.py` — shared helpers (path safety, storage backend selection)

Each module checks for R2 env vars at request time. If `CLOUDFLARE_ACCOUNT_ID` / `R2_BUCKET_NAME` are set it delegates to `app/r2.py`; otherwise it reads/writes from `FILE_STORAGE_PATH` (defaults to `frontend/data/` relative to the repo root). File metadata (name, path, size, mime_type, owner_id, etc.) is stored in Firestore `file_records` collection; file bytes live in R2 or on local disk unchanged.

**Auth:** Firebase Authentication. `POST /auth/register` creates a Firebase Auth user + a Firestore `users/{uid}` profile document. Login is done **client-side** via the Firebase JS SDK (`signInWithEmailAndPassword`), which returns an ID token. The backend verifies ID tokens via `firebase_admin.auth.verify_id_token()` in `firebase_auth.py`. Password reset uses Firebase's built-in link generation. Google OAuth is handled client-side through Firebase Auth.

**RBAC:** Three built-in roles (`admin`, `manager`, `member`) with per-permission grants stored in the `role_permissions` Firestore collection (document ID: `{role}_{permission}`). Default permissions are seeded at startup in `app/routers/permissions.py`. Admin users: `is_admin=True` OR `role="admin"` — both are checked. Frontend enforces RBAC via `frontend/contexts/permissions-context.tsx` and `frontend/lib/permissions.ts`; `frontend/components/auth/access-denied.tsx` is the blocked-access fallback UI.

**Docker topology** (`docker-compose.yml`):
- `frontend` — Next.js, port 3051, standalone output
- `backend` — FastAPI via `entrypoint.sh` (no migrations), port 3052
- No database container — Firestore is a hosted Firebase service