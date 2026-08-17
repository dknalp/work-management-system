---
name: project-overview
description: Work Management System genel mimari ve tech stack
metadata:
  type: project
---

# Work Management System

**Stack:** Next.js 16 (App Router) + FastAPI + SQLModel + PostgreSQL + R2/local storage

**Monorepo:**
- `frontend/` — Next.js, port 3000
- `backend/` — FastAPI, port 3052
- `docker-compose.yml` — frontend + backend + postgres

**Files sistemi:**
- Backend: `backend/app/routers/v1/files.py` (799 satır)
- Model: `FileRecord` in `backend/app/models.py`
- Frontend: `frontend/components/files/` (12 bileşen)
- Actions: `frontend/lib/actions/files.ts`
- Page: `frontend/app/files/[[...path]]/page.tsx`

**Depolama:** R2 (env var varsa) yoksa `frontend/data/` local disk

**Auth:** JWT, `get_current_user` dep, her file endpoint auth gerektirir

**UI:** shadcn/ui + radix-nova + Tailwind v4 + lucide-react + sonner (toast) + dnd-kit