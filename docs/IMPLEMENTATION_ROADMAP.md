# Implementation Roadmap — Work Management System

This roadmap is dependency-aware. Each phase must be complete before the next begins.

---

## Phase 0 — Forensic Audit (COMPLETE)

**Objective**: Understand the entire system before changing anything.

**Deliverables**:
- `docs/CODEBASE_AUDIT.md` — full architecture and issue analysis
- `docs/CODEBASE_INVENTORY.json` — machine-readable feature inventory
- `docs/IMPLEMENTATION_ROADMAP.md` — this document

---

## Phase 1 — Critical Path Fixes (COMPLETE)

**Objective**: Restore the features that are broken at runtime due to implementation bugs,
not architectural problems.

**Completed changes**:

| File | Change |
|---|---|
| `backend/app/main.py` | Removed duplicate prefix args from `include_router()` for all legacy routers that self-declare a prefix. This fixes `/users/me`, `/users/me/preferences`, `/users/me/avatar`, `/admin/users`, `/admin/bots` and all sub-routes. |
| `frontend/app/admin/roles/page.tsx` | Fixed 4 path strings: `/admin/roles` → `/permissions/admin/roles`, `/admin/permissions` → `/permissions/admin/permissions` |
| `frontend/components/chat-widget.tsx` | Fixed contacts path (`/api/v1/messages/contacts` → `/api/v1/chat/contacts`) and WebSocket path (`/api/v1/ws/chat/{id}` → `/api/v1/chat/{id}/ws`) |
| `backend/app/routers/v1/chat.py` | Added `GET /api/v1/chat/contacts` endpoint that returns all active users except the caller |
| `frontend/components/admin/admin-shared.ts` | Replaced all 5 bot management stubs + 4 drive/storage stubs with real `apiClient` calls (bot functions) or clear `throw new Error(...)` with explanations (drive/storage — no backend yet) |

**User-visible behavior after Phase 1**:
- Profile page can be viewed and edited
- Settings/preferences can be changed
- Admin user management works
- Admin bot management works
- Admin roles/permissions management works
- Chat widget loads contacts and can open WebSocket DM conversations

---

## Phase 2 — Unified Task Model (NEXT)

**Objective**: Merge the two independent task systems (Tasks collection and Kanban blob) into
a single coherent data model. This is the highest-priority remaining architectural problem.

**Dependency**: Phase 1 must be complete (it is).

### 2.1 — Extend the Task schema

Add fields to the Task data model (additive — no migration needed for existing documents):

**Backend** (`backend/app/schemas.py`, `backend/app/routers/v1/tasks.py`):
```python
class TaskCreate(BaseModel):
    # ... existing fields ...
    project_id: Optional[str] = None      # FK to projects/{id}
    pipeline_id: Optional[str] = None     # FK to pipelines/{id}
    assignee_id: Optional[str] = None     # Firebase UID of assignee
    sort_order: Optional[int] = None      # for kanban ordering

class TaskResponse(BaseModel):
    # ... existing fields ...
    project_id: Optional[str] = None
    pipeline_id: Optional[str] = None
    assignee_id: Optional[str] = None
    sort_order: Optional[int] = None
```

**Frontend** (`frontend/types/task.ts`):
```typescript
export interface Task {
  // ... existing fields ...
  project_id?: string
  pipeline_id?: string
  assignee_id?: string    // replaces string assignee
  sort_order?: number
}
```

**Files affected**:
- `backend/app/schemas.py`
- `backend/app/routers/v1/tasks.py`
- `frontend/types/task.ts`
- `frontend/components/create-task-dialog.tsx` (add project_id selector)
- `frontend/components/tasks/edit-task-dialog.tsx` (add project_id, assignee_id)
- `frontend/components/tasks/task-columns.tsx` (display project badge if present)

**Tests**: `backend/tests/test_tasks.py` — verify project_id and assignee_id are stored/retrieved.

### 2.2 — Make Kanban a view of Tasks

**Decision required** (see CODEBASE_AUDIT.md Section 25 Q1 before starting this step):
Should Kanban board be a view of the Tasks collection?

**If yes** (recommended):
- Modify `GET /kanban/{pipeline_id}` to query `tasks` where `pipeline_id == {pipeline_id}`
- Modify `PUT /kanban/{pipeline_id}` to update `sort_order` on individual tasks
- Modify `frontend/components/dashboard/board/kanban-board.tsx` to read from `TaskContext`
  filtered by `pipeline_id`, grouped by `status` → columns
- Each column = a status value. Dragging a card to another column updates `task.status`.
- Delete/deprecate `kanban_states` collection after migration
- **Migration**: existing `kanban_states` blobs contain card content (title, priority).
  Write a one-time migration script that creates real `tasks` documents from them.

**If no** (keep Kanban independent):
- Document this decision explicitly in code comments and ADR
- Ensure both systems are clearly named to avoid confusion

**Files affected**:
- `backend/app/routers/kanban.py` (complete rewrite)
- `frontend/components/dashboard/board/kanban-board.tsx` (rewrite to use TaskContext)
- `frontend/components/dashboard/board/kanban-card.tsx` (use Task type)
- `frontend/types/task.ts` (KanbanTask type can be removed if unified)

**Tests**: `backend/tests/test_kanban.py` — verify tasks appear on board, status updates propagate.

### 2.3 — Fix project tasks tab

Once `project_id` exists on tasks, update `project-tasks-tab.tsx` to filter tasks by
`project_id` instead of string matching.

**Files affected**:
- `frontend/components/projects/project-tasks-tab.tsx`
- `frontend/contexts/task-context.tsx` (add `getTasksByProject(projectId)` helper)

**Database changes**: None — additive fields, no migration.

**User-visible behavior after Phase 2**:
- Kanban board shows real tasks (if unified)
- Tasks created on any page appear on the Kanban board
- Project page tasks tab shows correct tasks for that project
- Tasks can be assigned to a user by UID, not just display name

---

## Phase 3 — Security Hardening

**Objective**: Prevent direct Firestore client writes that bypass backend authorization.

**Dependency**: Phase 2 should be complete (Kanban migration done so we know which collections
are still actively used).

### 3.1 — Lock Firestore rules

Current rules allow any authenticated user to write directly to tasks, kanban_states, projects,
pipelines, chat_rooms. Since no frontend code uses the Firestore JS SDK, these can all be
denied for client access.

**Recommended `firestore.rules`**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All access goes through the FastAPI backend (Firebase Admin SDK),
    // which bypasses these rules. Direct client SDK access is denied.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

If any feature needs client-side Firestore access in the future (e.g. real-time presence),
add explicit fine-grained rules for that collection only.

**Files affected**:
- `firestore.rules`

**Tests**: Manual — confirm existing API flows still work after rule change (Admin SDK bypasses rules).

**User-visible behavior after Phase 3**:
- No visible change for normal users
- Security posture improved: direct Firestore manipulation by authenticated users blocked

---

## Phase 4 — Quality Cleanup

**Objective**: Fix silent error swallowing, remove legacy dead code, improve reliability.

### 4.1 — Fix empty catch blocks in backend

Four empty `except` / `except Exception: pass` blocks swallow errors silently:
- `backend/app/routers/v1/files_core.py:434`
- `backend/app/routers/admin.py:214`
- `backend/app/routers/v1/chat.py:207`
- `backend/app/routers/auth.py:103`

Replace with at minimum `logger.warning(...)` so errors are visible in server logs.

**Files affected**: The four files above.

### 4.2 — Fix empty_trash R2 atomicity

In `backend/app/routers/v1/files_trash.py`, `empty_trash` currently:
1. Deletes R2 objects
2. Then deletes Firestore records

If step 1 partially fails, Firestore records are deleted but R2 objects remain.

Fix: reverse the order — delete Firestore records first (using a batch), then R2 objects.
Orphaned R2 objects (R2 deleted, Firestore survives) are worse than orphaned local state.

**Files affected**: `backend/app/routers/v1/files_trash.py`

### 4.3 — Remove legacy router tier

After confirming no external consumers use the unversioned paths, remove:
- `backend/app/routers/tasks.py` (legacy, never called by frontend)
- `backend/app/routers/team.py` (legacy, never called by frontend)
- `backend/app/routers/activity.py` (legacy, never called by frontend)
- `backend/app/routers/analytics.py` (legacy, never called by frontend)

Also remove their imports and `include_router()` calls from `main.py`.

**Decision required**: Confirm no bots/webhooks/scripts call these unversioned paths.

**Files affected**: 4 router files + `backend/app/main.py`

### 4.4 — Fix pre-existing lint errors

Two pre-existing ESLint errors (will not cause crashes but violate the codebase rules):
- `frontend/app/admin/roles/page.tsx:130` — setState in useEffect
- `frontend/components/chat-widget.tsx:75` — ref read during render

**Files affected**: The two files above.

**User-visible behavior after Phase 4**:
- Backend errors now appear in server logs
- Trash emptying is safer against partial failures
- Codebase is smaller and easier to maintain

---

## Phase 5 — Missing Features

**Objective**: Implement features that have UI/frontend but no backend implementation, and
improvements to existing features.

### 5.1 — Storage & Drive admin config

Add backend endpoints for:
- `GET /admin/storage/config` — returns current storage backend (local/R2) and path
- `PATCH /admin/storage/config` — updates local storage path (runtime config)
- `GET /api/v1/files/drive/status` — returns Drive connection status
- `GET /api/v1/files/drive/connect` — returns OAuth URL for Drive authorization
- `DELETE /api/v1/files/drive/connection` — disconnects Drive

**Decision required**: Is Google Drive integration a priority for this release?

### 5.2 — Real-time presence

Current presence system sends heartbeats but has no push mechanism. Other clients learn
about presence changes only on reload.

Options:
1. Add Firestore JS SDK to frontend (client-side only for the `presence` collection)
2. Use the existing WebSocket (`/api/v1/ws/notifications`) to push presence change events
3. Poll `/api/v1/presence` every 30 seconds (simple, slightly stale)

Option 3 is the lowest-risk path.

### 5.3 — Task comment and chat message edit/delete

Currently:
- Task comments: create only (no edit, no delete)
- Chat messages: create only (no edit, no delete)

Add backend endpoints and frontend UI for both.

### 5.4 — User account deletion

No `DELETE /users/me` endpoint exists. Add it with proper cleanup:
- Delete Firebase Auth account
- Delete Firestore `users/{uid}` document
- Mark their tasks/files as orphaned or reassigned

---

## Dependency Graph

```
Phase 0 (Audit)
    ↓
Phase 1 (Critical fixes) ← DONE
    ↓
Phase 2 (Unified task model)
    ├→ Decision: Kanban unification approach
    └→ Phase 3 (Security — can run in parallel with Phase 2)
         ↓
         Phase 4 (Quality cleanup)
              ↓
              Phase 5 (Missing features)
```

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Kanban migration corrupts existing board state | Write migration script, test on dev, backup before running |
| Legacy router removal breaks external consumers | Audit bot/webhook call logs before removing |
| Firestore rules lockdown breaks a hidden client-side SDK usage | `grep -r "getFirestore\|initializeFirestore\|collection(" frontend/` — currently returns nothing |
| Additive task fields break existing task queries | No — Firestore is schemaless; additive fields are safe |

---

## How to Track Progress

Each phase should result in a git commit or PR with:
- Updated `docs/CODEBASE_INVENTORY.json` (`status` fields updated)
- Tests that cover the changed behavior
- Update to this roadmap (mark phase complete, update dates)