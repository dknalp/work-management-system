# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
work-management-system/
├── backend/     # Backend code (Python/other)
└── frontend/    # Next.js web application
```

All frontend work happens under `frontend/`. Run all commands from the `frontend/` directory.

## Commands

Run from the `frontend/` directory:

```bash
pnpm dev        # Start dev server with Turbopack
pnpm build      # Production build
pnpm lint       # ESLint
pnpm typecheck  # TypeScript check (tsc --noEmit)
pnpm format     # Prettier (writes in place)
```

There are no tests in this project.

## Environment Variables

```bash
NEXT_PUBLIC_MOCK_AUTH=true       # Bypass real API auth, use localStorage mock user
NEXT_PUBLIC_API_URL=             # Backend base URL (defaults to http://localhost:8000)
FILE_STORAGE_PATH=               # Override where uploaded files are stored on disk
```

## Architecture

Next.js 16 App Router project under `frontend/`. All routes live under `frontend/app/`, all reusable UI under `frontend/components/`.

**Pages:**
- `/` — Landing page (marketing, no sidebar)
- `/dashboard` — Overview with KPI cards, charts, upcoming tasks, recent activity
- `/dashboard/board` — Kanban pipeline board
- `/calendar` — Calendar view
- `/tasks` — Task list
- `/team` — Team member management
- `/files/[[...path]]` — File explorer (catch-all route for nested directories)
- `/profile` — User profile page
- `/settings` — App settings page
- `/admin` — Admin panel (requires `is_admin`; redirects to `/dashboard` otherwise)
- `/admin/activity` — Full activity log
- `/(auth)/login`, `/(auth)/register`, `/(auth)/forgot-password`, `/(auth)/reset-password` — Auth pages (no sidebar, own layout)

**API Routes:**
- `GET /api/files/raw` — Serves raw file bytes for in-browser preview

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

**File system:** Files are stored locally under `frontend/data/`. `frontend/lib/actions/files.ts` contains Server Actions for list/delete/rename/move/createFolder. `frontend/lib/actions/upload.ts` handles uploads. `frontend/app/api/files/raw/route.ts` serves raw file bytes for preview. Path traversal is prevented via `getSafePath()` in each action. Server Actions `bodySizeLimit` is set to `2gb` in `frontend/next.config.mjs`.

**State:** No real database. Kanban state is in-memory React state (resets on refresh); hardcoded in `frontend/components/dashboard/board/kanban-board.tsx`. Tasks and activity log are persisted to `localStorage` via `useLocalStorage` (`wms:tasks`, `wms:activity`) — initial seed comes from `MOCK_TASKS` in `frontend/types/task.ts`. Team member seed data is in `frontend/contexts/team-context.tsx`. Dashboard chart data comes from `frontend/app/dashboard/data.json`. File explorer is the only server-rendered page, refreshed via `revalidatePath`.

**Auth:** `frontend/contexts/auth-context.tsx` provides `AuthProvider` / `useAuth()` (exposes `user`, `loading`, `login`, `logout`, `updateUser`). When `NEXT_PUBLIC_MOCK_AUTH=true`, auth bypasses the real API and stores a mock user in `localStorage` (`wms:mock_user`). In real mode, `frontend/lib/auth.ts` stores JWT tokens in `localStorage` (`wos_access_token`, `wos_refresh_token`) and syncs a `has_session` cookie. `frontend/proxy.ts` reads that cookie (and the `is_admin` cookie) to gate all protected routes, redirect away from auth pages when already logged in, and block non-admin users from `/admin`. `frontend/lib/api.ts` is the typed API client (base URL from `NEXT_PUBLIC_API_URL`, defaults to `http://localhost:8000`) with automatic token refresh on 401.

**Contexts:** Three global providers wrap the app in `frontend/app/layout.tsx`: `AuthProvider`, `TaskProvider` (`frontend/contexts/task-context.tsx` — shared task CRUD + activity log, use `useTasks()`), and `TeamProvider` (`frontend/contexts/team-context.tsx`, use `useTeam()`). Always use these hooks instead of prop-drilling.

**Naming collision:** There are two unrelated `Task` types. `frontend/types/task.ts` defines the Tasks-page `Task` (fields: `title`, `status`, `assignee`, `dueDate`, `tags`). `frontend/components/dashboard/board/kanban-card.tsx` defines the Kanban `Task` (fields: `content`, `columnId`, `priority`, `tags`). Never import one where the other is expected.

**TeamMember type:** Exported from `frontend/contexts/team-context.tsx` alongside `useTeam`. `frontend/app/team/page.tsx` and `frontend/app/admin/page.tsx` both import it from there.

**Tables:** `@tanstack/react-table` v8 powers both the Tasks table (`frontend/components/tasks/task-table.tsx`) and the Team table (`frontend/components/team/team-table.tsx`). Column definitions for Tasks are split into `frontend/components/tasks/task-columns.tsx`.

**Charts:** `recharts` used on the dashboard. **Calendar:** `react-day-picker` + `date-fns`.

**Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable` used for the Kanban board and file drag interactions.

**Generic reorderable table:** `frontend/components/data-table.tsx` is a standalone drag-to-reorder table (dnd-kit vertical sort) — distinct from the Tasks and Team tables which use `@tanstack/react-table`.

**UI components:** shadcn/ui with `radix-nova` style, Tailwind CSS v4, CSS variables for theming. Add new shadcn components with `pnpm dlx shadcn add <name>` (run from `frontend/`). Icons from `lucide-react`. Toasts via `sonner`. Drawers via `vaul`.

**Design tokens:** `frontend/brand-style.md` documents the full color palette, typography, spacing, and component style rules derived from `frontend/app/globals.css`. All colors use `oklch`. Consult it before adding new colors or overriding tokens.

**Path alias:** `@/*` maps to the `frontend/` root (e.g. `@/components/ui/button`).

**Fonts:** Geist (sans), Instrument Serif, Geist Mono — loaded via `next/font/google` and exposed as CSS variables (`--font-sans`, `--font-instrument-serif`, `--font-mono`) in `frontend/app/layout.tsx`. (Note: the variable is named `--font-sans` even though the font is Geist, not Inter.)

**Theme:** Dark/light via `next-themes` (`frontend/components/layout/theme-provider.tsx`). Toggle in `frontend/components/layout/mode-toggle.tsx`.