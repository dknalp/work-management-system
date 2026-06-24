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

## Architecture

Next.js 16 App Router project under `frontend/`. All routes live under `frontend/app/`, all reusable UI under `frontend/components/`.

**Pages:**
- `/` — Landing page (marketing, no sidebar)
- `/dashboard` — Overview with KPI cards, upcoming tasks, recent activity
- `/dashboard/board` — Kanban pipeline board
- `/calendar` — Calendar view
- `/tasks` — Task list
- `/team` — Team member management
- `/files/[[...path]]` — File explorer (catch-all route for nested directories)

**Sidebar layout pattern:** Every app page (not landing) wraps content in:
```tsx
<SidebarProvider style={{ "--sidebar-width": "...", "--header-height": "..." }}>
  <AppSidebar variant="inset" />
  <SidebarInset>
    <SiteHeader />
    <main>...</main>
  </SidebarInset>
</SidebarProvider>
```

**File system:** Files are stored locally under `frontend/data/`. `frontend/lib/actions/files.ts` contains Server Actions for list/delete/rename/move/createFolder. `frontend/lib/actions/upload.ts` handles uploads. `frontend/app/api/files/raw/route.ts` serves raw file bytes for preview. Path traversal is prevented via `getSafePath()` in each action. Server Actions bodySizeLimit is set to 10mb in `frontend/next.config.mjs`.

**State:** No database or auth. All page state is in-memory React state — data resets on page refresh. Kanban initial data is hardcoded in `frontend/components/dashboard/board/kanban-board.tsx`. Task mock data lives in `frontend/components/tasks/task-types.ts` (exported as `MOCK_TASKS`). Team member seed data is hardcoded in `frontend/app/team/page.tsx`. Dashboard chart data comes from `frontend/app/dashboard/data.json`. File explorer is the only server-rendered page, refreshed via `revalidatePath`.

**Naming collision:** There are two unrelated `Task` types. `frontend/components/tasks/task-types.ts` defines the Tasks-page `Task` (fields: `title`, `status`, `assignee`, `dueDate`, `tags`). `frontend/components/dashboard/board/kanban-card.tsx` defines the Kanban `Task` (fields: `content`, `columnId`, `priority`, `tags`). Never import one where the other is expected.

**TeamMember type:** Exported from `frontend/app/team/page.tsx` (not a separate types file). `frontend/components/team/team-table.tsx` imports it directly from the page: `import { TeamMember } from "@/app/team/page"`.

**Tables:** `@tanstack/react-table` v8 powers both the Tasks table (`frontend/components/tasks/task-table.tsx`) and the Team table (`frontend/components/team/team-table.tsx`). Column definitions for Tasks are split into `frontend/components/tasks/task-columns.tsx`.

**Charts:** `recharts` used on the dashboard. **Calendar:** `react-day-picker` + `date-fns`.

**Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable` used for the Kanban board and file drag interactions.

**Generic reorderable table:** `frontend/components/data-table.tsx` is a standalone drag-to-reorder table (dnd-kit vertical sort) — distinct from the Tasks and Team tables which use `@tanstack/react-table`.

**UI components:** shadcn/ui with `radix-nova` style, Tailwind CSS v4, CSS variables for theming. Add new shadcn components with `pnpm dlx shadcn add <component>` (run from `frontend/`). Icons from `lucide-react`. Toasts via `sonner`. Drawers via `vaul`.

**Design tokens:** `frontend/brand-style.md` documents the full color palette, typography, spacing, and component style rules derived from `frontend/app/globals.css`. All colors use `oklch`. Consult it before adding new colors or overriding tokens.

**Path alias:** `@/*` maps to the `frontend/` root (e.g. `@/components/ui/button`).

**Fonts:** Inter (sans), Instrument Serif, Geist Mono — loaded via `next/font/google` and exposed as CSS variables in `frontend/app/layout.tsx`.

**Theme:** Dark/light via `next-themes` (`frontend/components/theme-provider.tsx`). Toggle in `frontend/components/mode-toggle.tsx`.