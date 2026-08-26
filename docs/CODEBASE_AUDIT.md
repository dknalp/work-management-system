# Codebase Audit — Work Management System

**Date**: 2026-08-26  
**Scope**: Full read-only static analysis of entire repository.  
**Phase 1 fixes applied**: Yes (chat paths, double-prefix bug, bot stubs, admin roles paths).

---

## 1. Executive Summary

This application is a work-management SaaS (tasks, projects, pipelines, kanban board, files,
team management, calendar, analytics, chat). The frontend is Next.js 16 App Router with React
Context state management. The backend is FastAPI with Firestore (via Firebase Admin SDK) as the
primary database and Cloudflare R2 (or local disk) for file storage.

**The most critical pre-fix bug** was a double-prefix bug in `backend/app/main.py` where legacy
routers (users, admin, bots, tasks, team, activity, analytics) each declare their own
`APIRouter(prefix=...)` AND receive a duplicate `prefix=` argument in `include_router()`.
FastAPI concatenates both, producing paths like `/users/users/me` and `/admin/admin/users`
that are completely unreachable from the frontend.

**Second critical issue**: The chat widget called two API endpoints that did not exist:
`/api/v1/messages/contacts` (should be `/api/v1/chat/contacts`) and the WebSocket path
`/api/v1/ws/chat/{roomId}` (should be `/api/v1/chat/{roomId}/ws`).

**Third critical issue**: All bot management functions in the admin panel
(`frontend/components/admin/admin-shared.ts`) were stub functions that always threw errors.
A complete, working backend at `/admin/bots/*` existed but was never called.

All three issues were fixed in Phase 1. See Section 21 for the complete list.

---

## 2. Current Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript |
| State management | React Context (no Zustand/Redux/TanStack Query) |
| Auth (client) | Firebase JS SDK (`signInWithEmailAndPassword`, `getIdToken`) |
| Auth tokens | `localStorage` (`wos_access_token`, `wos_refresh_token`) |
| API client | Thin fetch wrapper (`frontend/lib/api.ts`) |
| Backend | FastAPI (Python) |
| Backend auth | Firebase Admin SDK (`verify_id_token`) |
| Database | Firestore (Admin SDK — server-side only) |
| File storage | Cloudflare R2 (if env vars set) or local disk |
| Middleware | `frontend/proxy.ts` (Next.js middleware — reads cookies for route gating) |

### Router tiers

The backend has two parallel tiers:

**Legacy tier** (no `/api/v1` prefix) — mounted directly on the app:

| Router | Self-prefix | Final paths |
|---|---|---|
| auth | none | `/auth/*` |
| users | `/users` | `/users/*` |
| admin | `/admin` | `/admin/*` |
| bots | `/admin/bots` | `/admin/bots/*` |
| tasks (legacy) | `/tasks` | `/tasks/*` |
| team (legacy) | `/team` | `/team/*` |
| activity (legacy) | `/activity` | `/activity/*` |
| analytics (legacy) | `/analytics` | `/analytics/*` |
| permissions | none | `/permissions/*` |
| projects | none | `/projects/*` |
| pipelines | none | `/pipelines/*` |
| kanban | none | `/kanban/*` |
| calendar | none | `/calendar/*` |

**Versioned tier** (`/api/v1` prefix):

| Router | Sub-prefix | Final paths |
|---|---|---|
| v1/me | `/me` | `/api/v1/me` |
| v1/tasks | `/tasks` | `/api/v1/tasks/*` |
| v1/team | `/team` | `/api/v1/team/*` |
| v1/activity | `/activity` | `/api/v1/activity/*` |
| v1/analytics | `/analytics` | `/api/v1/analytics/*` |
| v1/files_* | `/files` | `/api/v1/files/*` |
| v1/agents | `/agents` | `/api/v1/agents/*` |
| v1/chat | `/chat` | `/api/v1/chat/*` |
| v1/presence | `/presence` | `/api/v1/presence/*` |
| v1/ws (presence) | `/ws` | `/api/v1/ws/notifications` |
| v1/webhooks | `/webhooks` | `/api/v1/webhooks/*` |

---

## 3. Actual Data Flow

### Write (example: create task)

```
CreateTaskDialog.handleSubmit()
  → TaskContext.createTask(data)
    → apiClient.post("/api/v1/tasks", data)        # attaches Firebase ID token
      → FastAPI: get_current_actor()
          → firebase_auth.verify_firebase_token()  # validates ID token
          → loads User from Firestore users/{uid}
      → require_permission("create_task")
      → Firestore: tasks.add({...data, owner_id: uid, created_at: SERVER_TIMESTAMP})
      → return TaskResponse (200 OK)
    → TaskContext: setTasks([...tasks, newTask])   # optimistic confirmed
    → toast.success()
```

### Read (example: task list on mount)

```
TaskProvider.useEffect mount
  → apiClient.get("/api/v1/tasks")
    → FastAPI: verify token → list tasks (filtered by authorization)
    → return Task[]
  → setTasks(data)
  → Any component using useTasks() re-renders with live data
```

---

## 4. Feature Inventory

See Section 21 (Feature Status Matrix) for the complete CRUD status per feature.

Key features and their status:

- **Tasks**: Fully working. CRUD via `/api/v1/tasks`. Comments, activity log, tags.
- **Projects**: Fully working. CRUD via `/projects/*`.
- **Pipelines**: Fully working. CRUD via `/pipelines/*`.
- **Kanban board**: Partially working. State persists to Firestore but is **disconnected** from the Tasks collection. Two independent task data models exist.
- **Calendar**: Fully working. CRUD via `/calendar/*`.
- **Files**: Fully working. Upload/download/trash/share/bulk ops via `/api/v1/files/*`.
- **Team management**: Fully working. CRUD via `/api/v1/team/members`.
- **Analytics**: Fully working. Computed server-side from Firestore.
- **Auth**: Fully working (Firebase Auth).
- **User profile**: Fully working after Phase 1 fix (double-prefix bug was blocking `/users/me`).
- **Admin — Users**: Fully working after Phase 1 fix.
- **Admin — Bots**: Fully working after Phase 1 fix (was: all stubs).
- **Admin — Roles/Permissions**: Fully working after Phase 1 fix (wrong paths corrected).
- **Agent builder**: Fully working. CRUD via `/api/v1/agents/*`.
- **Chat (DM)**: Functional after Phase 1 fix (wrong paths corrected, contacts endpoint added).
- **Notifications**: Fully working (derived from API-backed activity + WebSocket push).
- **Settings**: Fully working. Preferences persisted via `/users/me/preferences`.

---

## 5. Persistence Audit

### LocalStorage keys

| Key | Purpose | Source of truth | Verdict |
|---|---|---|---|
| `wos_access_token` | Firebase ID token | Firebase Auth | **Legitimate** — short-lived cache |
| `wos_refresh_token` | Firebase refresh token | Firebase Auth | **Legitimate** — short-lived cache |
| `wms:mock_user` | Mock user for dev (`NEXT_PUBLIC_MOCK_AUTH=true`) | Dev-only | **Legitimate** — dev bypass |
| `wms:notifications_read` | Set of read notification IDs | Client UI state | **Legitimate** — not canonical data |
| `wms:chat_read` | Map of chat rooms to last-read timestamp | Client UI state | **Legitimate** — not canonical data |
| `wms:custom_roles` | Custom roles in mock-auth mode | Should be Firestore | **Problematic** — mock mode only |
| `wms:activity` | Activity log cache | Firestore (via `/api/v1/activity`) | **Acceptable** — optimistic cache, not source of truth |

### Conclusion

There is no case where server-owned entities (tasks, users, files, projects) are stored only in
localStorage. All `localStorage` usage is either legitimate client-UI state, dev-mode bypasses,
or optimistic caches backed by server reads.

---

## 6. Firebase Audit

### Initialization

`backend/app/firebase.py` initializes the Firebase Admin SDK on startup. Accepts a service
account JSON via `FIREBASE_SERVICE_ACCOUNT_JSON` env var (raw JSON string or file path), or
falls back to Application Default Credentials (ADC). Initialization is idempotent (guards with
`firebase_admin.get_app()`).

### Collections

| Collection | Owner | Key fields |
|---|---|---|
| `users/{uid}` | Backend | name, email, role, is_admin, is_active, avatar_url, bio |
| `users/{uid}/preferences` | Backend | notification settings, theme, etc. |
| `tasks/{id}` | Backend | title, status, priority, assignee, due_date, owner_id, tags |
| `task_comments/{id}` | Backend | task_id, user_id, content, created_at |
| `projects/{id}` | Backend | name, description, status, owner_id |
| `pipelines/{id}` | Backend | name, stages, project_id |
| `kanban_states/{pipeline_id}` | Backend | state (opaque JSON blob) |
| `calendar_events/{id}` | Backend | title, start, end, user_id |
| `team_members/{id}` | Backend | name, email, role, department |
| `activity/{id}` | Backend | action, entity_type, entity_id, user_id, created_at |
| `bots/{id}` | Backend | name, key_hash, key_prefix, owner_id, is_active |
| `agent_configs/{id}` | Backend | name, config, owner_id |
| `file_records/{id}` | Backend | name, path, size, mime_type, r2_key, owner_id |
| `file_shares/{id}` | Backend | file_id, token, expires_at |
| `file_access_logs/{id}` | Backend | file_id, accessor_id |
| `chat_rooms/{room_id}` | Backend | participants |
| `chat_rooms/{room_id}/messages/{id}` | Backend | content, sender_id, created_at |
| `presence/{uid}` | Backend | last_seen, is_online |
| `webhooks/{id}` | Backend | url, events, secret_hash, owner_id |
| `role_permissions/{role}_{perm}` | Backend | role, permission, granted |
| `custom_roles/{name}` | Backend | name, is_system, created_at |
| `analytics/*` | Not stored | Computed on-demand |

### No client-side Firestore SDK

The frontend does **not** use the Firestore JS SDK. All reads/writes go through the FastAPI
backend. This means Firestore security rules are not exercised in normal operation.

---

## 7. Authentication Audit

### Flow

```
Registration:
  Frontend: Firebase JS SDK createUserWithEmailAndPassword()
    → Firebase Auth: creates uid
    → Backend: POST /auth/register (sends Firebase ID token)
      → creates Firestore users/{uid} document
      → sets is_admin, role based on whether it is the first user

Login:
  Frontend: Firebase JS SDK signInWithEmailAndPassword()
    → Firebase Auth: returns ID token
    → tokenStorage.setToken(idToken) → localStorage wos_access_token
    → sets has_session=true cookie (read by middleware)

API call:
  apiClient reads wos_access_token from localStorage
    → attaches as Authorization: Bearer {token}
    → Backend: deps.get_current_actor() → firebase_auth.verify_id_token()
      → loads User from Firestore users/{uid}
      → checks is_active flag
      → returns Actor (User | BotAccount)

Token refresh:
  apiClient: on 401 response, calls firebase_auth.currentUser.getIdToken(forceRefresh=true)
    → retries once before redirecting to /login

Logout:
  frontend: Firebase JS SDK signOut() → tokenStorage.clearTokens()
```

### Authorization

Three built-in roles: `admin`, `manager`, `member`. Permissions stored in Firestore
`role_permissions` collection. Frontend enforces via `PermissionsContext`/`usePermissions()`.
Backend enforces via `require_permission()` dependency (reads from Firestore on each request).

Admin access: `user.is_admin == True OR user.role == "admin"`.

### Security gaps

- Firestore security rules allow direct client writes from any authenticated user on tasks,
  kanban_states, projects, pipelines, chat_rooms (see Section 12). Since the frontend never
  uses the Firestore JS SDK, this is not currently exploitable via the app — but a malicious
  user with a valid token could write arbitrary data directly to Firestore.

---

## 8. Firestore Data Model

### Current model

Tasks are stored in `tasks/{id}` with these fields (VERIFIED from `schemas.py`):

```python
{
  "title": str,
  "description": Optional[str],
  "status": Literal["todo", "in_progress", "done", "cancelled"],
  "priority": Literal["low", "medium", "high"],
  "assignee": Optional[str],         # display name — NOT a user UID
  "due_date": Optional[datetime],
  "tags": list[str],
  "owner_id": str,                   # Firebase UID of creator
  "created_at": datetime,
  "updated_at": datetime,
}
```

Missing relational fields:
- No `project_id` FK (project is not linked to tasks at the data model level)
- No `pipeline_id` FK
- `assignee` is a display string, not a UID — cannot do reverse lookup

### Target model additions

```python
{
  # ... existing fields ...
  "project_id": Optional[str],    # FK to projects/{id}
  "pipeline_id": Optional[str],   # FK to pipelines/{id}
  "assignee_id": Optional[str],   # Firebase UID of assignee
  "sort_order": Optional[int],    # for kanban card ordering
}
```

No migration required (Firestore is schemaless — additive fields). Existing documents will
have `None` for these fields until re-saved.

---

## 9. Cloudflare R2 Audit

### Architecture

```
Frontend → apiClient → /api/v1/files/* → FastAPI
  → files_utils.py: _use_r2() checks env vars
    → If R2: app/r2.py (boto3/s3-compatible) → Cloudflare R2
    → If local: writes to FILE_STORAGE_PATH (default: frontend/data/)
  → Firestore: file_records/{id} stores metadata
```

### File metadata shape (VERIFIED from files_core.py)

```python
{
  "name": str,
  "path": str,              # virtual directory path
  "size": int,
  "mime_type": str,
  "r2_key": str,            # R2 object key OR local relative path
  "owner_id": str,
  "is_folder": bool,
  "is_trashed": bool,
  "trashed_at": Optional[datetime],
  "created_at": datetime,
}
```

### Atomicity concern

`empty_trash` in `files_trash.py` deletes R2 objects first, then Firestore records in a batch.
If R2 deletions partially fail, Firestore records may be deleted while R2 objects remain
(orphaned R2 storage). Severity: **Medium**. Workaround: reverse order (delete Firestore first;
orphaned R2 objects don't cause data loss since the app uses Firestore as the index).

### Authorization

All file access is checked against `owner_id`. Shared files checked via `file_shares` token
and `expires_at`. No cross-user file access is possible through the API.

---

## 10. Local Storage Audit

All localStorage usage is legitimate. See Section 5 (Persistence Audit) for the complete list.
No server-owned data is treated as client-owned state.

---

## 11. CRUD Audit

| Entity | Create | Read | Update | Delete | Source of truth | Notes |
|---|---|---|---|---|---|---|
| User (auth) | ✅ | ✅ | ✅ | ❌ | Firebase Auth + Firestore | No delete-account endpoint |
| User preferences | ✅ | ✅ | ✅ | n/a | Firestore | |
| Task | ✅ | ✅ | ✅ | ✅ | Firestore | Missing project_id, assignee_id |
| Task comment | ✅ | ✅ | ❌ | ❌ | Firestore | No edit/delete for comments |
| Project | ✅ | ✅ | ✅ | ✅ | Firestore | |
| Pipeline | ✅ | ✅ | ✅ | ✅ | Firestore | |
| Kanban board | ✅ | ✅ | ✅ | n/a | Firestore | Isolated from Tasks collection |
| Calendar event | ✅ | ✅ | ✅ | ✅ | Firestore | |
| Team member | ✅ | ✅ | ✅ | ✅ | Firestore | |
| File | ✅ | ✅ | ✅ | ✅ | Firestore + R2 | Full lifecycle |
| File share | ✅ | ✅ | n/a | ✅ | Firestore | |
| Bot | ✅ | ✅ | ✅ | ✅ | Firestore | Fixed in Phase 1 |
| Agent config | ✅ | ✅ | ✅ | ✅ | Firestore | |
| Chat message | ✅ | ✅ | ❌ | ❌ | Firestore | No edit/delete for messages |
| Webhook | ✅ | ✅ | ✅ | ✅ | Firestore | |
| Role | ✅ | ✅ | n/a | ✅ | Firestore | Fixed in Phase 1 |
| Permission | n/a | ✅ | ✅ | n/a | Firestore | Fixed in Phase 1 |

---

## 12. Security Audit

### Firestore rules

`firestore.rules` allows any authenticated user to read/write:
- `tasks`, `kanban_states`, `projects`, `pipelines`, `chat_rooms`

Since the frontend never uses the Firestore JS SDK, this is not currently exploitable through
the app. However, a user with a valid Firebase ID token could use the Firestore REST API or
client SDK to bypass backend authorization entirely.

**Recommended fix**: Lock all collections to deny direct client writes:
```
match /{document=**} {
  allow read, write: if false;  // all access via Admin SDK only
}
```
Add explicit read rules only for collections that legitimately need client-side access.

### Backend authorization

- All API endpoints require a valid Firebase ID token (or bot API key).
- Admin endpoints (`/admin/*`) check `user.is_admin`.
- RBAC permissions checked via `require_permission()` dependency.
- File access checked against `owner_id`.

### Bot API key security

API keys are generated with `secrets.token_urlsafe(32)`, stored only as SHA-256 hash
(`key_hash`). Full key returned only on creation. Prefix (`key_prefix`) stored for display.
This is correct key management.

---

## 13. Async / State Consistency Audit

### Good patterns

- TaskContext uses optimistic updates: creates local state immediately, then confirms via API.
- CalendarContext: refetches from backend after every mutation (not optimistic).
- Kanban board: saves state to backend on every drag-and-drop.

### Issues found

- `files_trash.py` `empty_trash`: R2 deletions are not atomic with Firestore batch (see Section 9).
- `frontend/app/admin/roles/page.tsx:130`: calls `setState` synchronously in a `useEffect`
  — pre-existing lint error, causes potential cascade renders.
- `frontend/components/chat-widget.tsx:75`: reads `ref.current` during render — pre-existing
  lint error.

---

## 14. Error Handling Audit

### Backend

- Most routes use `raise HTTPException(status_code=4xx, detail=...)` correctly.
- `files_core.py:434` has an empty `except Exception: pass` block — swallows errors silently.
- `admin.py:214` has an empty `except Exception: pass` block — swallows errors.
- `chat.py:207` has an empty `except Exception: pass` block — swallows WebSocket errors.
- `auth.py:103` has an empty `except: pass` — swallows cleanup errors on failed registration.

### Frontend

- Most API calls use `try/catch` with `toast.error(...)`.
- Chat widget loads contacts in a fire-and-forget `useEffect` with no visible error state.

---

## 15. Architectural Problems

### A-01 · Two independent task data models (HIGHEST PRIORITY)

The `tasks` Firestore collection and the `kanban_states` Firestore collection are completely
independent. Tasks created on the Tasks page do not appear on the Kanban board. Tasks created
on the Kanban board are not real tasks — they are an opaque blob stored in `kanban_states`.

This is the single largest architectural inconsistency.

**Solution**: Kanban board should become a view of the `tasks` collection. Each column = a
task status. Cards = tasks ordered by a `sort_order` field. `kanban_states` stores only column
order and card position metadata (or is eliminated entirely if status = column).

### A-02 · Legacy router tier is dead code

Legacy routers (`/tasks`, `/team`, `/activity`, `/analytics`) are never called by the frontend
(which uses `/api/v1/*` for all of these). They add maintenance overhead and risk schema drift.

### A-03 · No task → project relational FK

Tasks have a free-text `assignee` string and no `project_id`. The project tasks tab filters by
string matching which is unreliable.

### A-04 · Direct Firestore write exposure

Firestore rules don't block authenticated clients from writing directly. Should be locked down.

### A-05 · `empty_trash` R2 atomicity

Covered in Section 9. Reverse operation order to reduce orphan risk.

---

## 16. Root Cause Analysis

### R-01 · Double-prefix bug (FIXED in Phase 1)

All legacy routers in `backend/app/main.py` received a `prefix=` argument in `include_router()`
despite already declaring their own prefix via `APIRouter(prefix=...)`. FastAPI concatenates
both, producing paths like `/users/users/me` unreachable by the frontend. Root cause: developer
added self-declared prefixes to routers without removing the mount-time prefix already in
`main.py`. **Fixed by removing the duplicate prefix arguments from `include_router()` calls.**

### R-02 · Chat API path mismatch (FIXED in Phase 1)

Frontend chat-widget was built against a different API contract than the backend chat router.
Frontend used `/api/v1/messages/contacts` and `/api/v1/ws/chat/{id}`. Backend had
`/api/v1/chat/contacts` (now added) and `/api/v1/chat/{id}/ws`. No integration test existed
to catch this. **Fixed by aligning frontend paths to backend and adding the contacts endpoint.**

### R-03 · Bot management stubs (FIXED in Phase 1)

`admin-shared.ts` was scaffolded as a stub file and never connected to the backend. The
developer wrote UI (bots-section.tsx) calling these stubs but never implemented the API calls.
The working backend `/admin/bots/*` router was orphaned. **Fixed by replacing all stubs with
real `apiClient` calls.**

### R-04 · Kanban/Tasks disconnection (NOT YET FIXED)

Two independent developers or development sessions built the Tasks system (flat list) and the
Kanban system (pipeline-scoped drag board) without integrating them. Both are complete on
their own but they are parallel systems rather than a single unified task model.

---

## 17. Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                         │
│                                                             │
│  React Contexts (auth, tasks, team, permissions, etc.)      │
│       ↕                                                     │
│  apiClient (frontend/lib/api.ts)                            │
│    - attaches Firebase ID token                             │
│    - handles 401 token refresh                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI backend (port 3052)                                │
│                                                             │
│  deps.py: verify Firebase token → load User from Firestore  │
│  deps.py: require_permission() → RBAC check                 │
│       ↕                                                     │
│  Router layer (/api/v1/* for all new code)                  │
│       ↕                                                     │
│  Firestore (Firebase Admin SDK)   R2 / local disk           │
└─────────────────────────────────────────────────────────────┘
```

**Rules for each layer:**

- **UI components**: read from context hooks only. Never call `apiClient` directly unless they own that slice of state (profile page, settings page).
- **Context hooks**: own a slice of server state. Fetch on mount, mutate via API, update local state optimistically.
- **apiClient**: the only HTTP client. All requests go through it.
- **Backend routers**: validate inputs, authorize, read/write Firestore, return responses.
- **Firestore**: accessed only by the backend Admin SDK. No client-side SDK.
- **localStorage**: only for tokens (Firebase ID tokens), UI preferences (notifications read, theme), and dev-only mock auth.

---

## 18. Target Data Model

See Section 8. Key additions to make the architecture coherent:

```python
# Task (target additions)
{
  "project_id":  Optional[str],  # FK to projects/{id}
  "pipeline_id": Optional[str],  # FK to pipelines/{id}
  "assignee_id": Optional[str],  # Firebase UID (replaces free-text assignee)
  "sort_order":  Optional[int],  # for kanban ordering within a pipeline/status
}
```

---

## 19. Feature Dependency Graph

```
Firebase Auth (identity)
  └→ User profile (Firestore users/{uid})
       └→ RBAC / permissions
            └→ Tasks (create/edit/delete require permissions)
            └→ Projects
            └→ Team management
            └→ Admin panel
                 └→ Roles/Permissions management
                 └→ Bot management

Tasks
  └→ Activity log
  └→ Task comments
  └→ Kanban board (currently disconnected — must be unified)
  └→ Calendar (tasks with due dates surface in calendar)
  └→ Analytics (computed from tasks)
  └→ Notifications (derived from activity)

Files
  └→ R2 / local storage (binary)
  └→ Firestore file_records (metadata)
  └→ Share links

Chat
  └→ Team members (contacts list)
  └→ WebSocket (real-time messages)
```

---

## 20. Prioritized Problem List

### P0 — Fixed in Phase 1

| ID | Problem | Files | Fix Applied |
|---|---|---|---|
| B-01 | Double-prefix bug blocks `/users/me`, `/admin/*` | `backend/app/main.py` | Removed duplicate prefix args |
| B-02 | Chat widget calls wrong API paths | `chat-widget.tsx` | Fixed both paths |
| B-03 | Missing `GET /api/v1/chat/contacts` endpoint | `chat.py` | Added endpoint |
| B-04 | Bot management stubs never call backend | `admin-shared.ts` | Replaced with real apiClient calls |
| B-05 | Admin roles/permissions page calls wrong paths | `admin/roles/page.tsx` | Fixed 4 path strings |

### P1 — Core architecture (Phase 2)

| ID | Problem | Severity |
|---|---|---|
| A-01 | Two independent task systems (Tasks vs Kanban) | Critical architecture |
| A-03 | No task→project FK, no assignee UID | Core data model |
| A-02 | Legacy router tier dead code | Medium — maintenance risk |

### P2 — Security (Phase 3)

| ID | Problem | Severity |
|---|---|---|
| A-04 | Firestore rules allow direct client writes | Medium security gap |
| A-05 | `empty_trash` R2 atomicity | Medium data integrity |

### P3 — Quality (Phase 4)

| ID | Problem | Severity |
|---|---|---|
| Q-01 | `files_core.py:434` swallows exceptions | Low |
| Q-02 | `admin.py:214` swallows exceptions | Low |
| Q-03 | Pre-existing lint errors in roles/page.tsx and chat-widget.tsx | Low |
| Q-04 | No task comment edit/delete | Low |
| Q-05 | No chat message edit/delete | Low |
| Q-06 | No user account deletion | Low |
| Q-07 | Presence is not real-time (no push) | Low |

---

## 21. Feature Status Matrix (Post Phase 1)

| Feature | Status | Notes |
|---|---|---|
| Auth — Login/Logout/Register | ✅ Working | |
| Auth — Token refresh | ✅ Working | |
| User profile (view/edit) | ✅ Working | Fixed (double-prefix) |
| User avatar upload | ✅ Working | Fixed (double-prefix) |
| User preferences | ✅ Working | Fixed (double-prefix) |
| Tasks — CRUD | ✅ Working | |
| Tasks — Comments (read/create) | ✅ Working | No edit/delete |
| Tasks — Activity log | ✅ Working | |
| Tasks — Assignee (relational) | ⚠️ Partial | String only, not UID |
| Tasks — Project link | ❌ Missing | No FK |
| Kanban board | ⚠️ Isolated | Disconnected from Tasks |
| Calendar | ✅ Working | |
| Projects — CRUD | ✅ Working | |
| Projects — Tasks tab | ⚠️ Partial | No project_id FK |
| Pipelines — CRUD | ✅ Working | |
| Analytics | ✅ Working | |
| Team management | ✅ Working | |
| Admin — Users | ✅ Working | Fixed (double-prefix) |
| Admin — Roles/Permissions | ✅ Working | Fixed (wrong paths) |
| Admin — Bots | ✅ Working | Fixed (stubs → real API) |
| Admin — Storage/Drive config | ❌ No backend | Stubs with clear error messages |
| Agent builder | ✅ Working | |
| Files — CRUD | ✅ Working | |
| Files — Trash/Restore | ✅ Working | |
| Files — Bulk operations | ✅ Working | |
| Files — Share links | ✅ Working | |
| Files — Google Drive import | ✅ Working | |
| Chat (DM) | ✅ Working | Fixed (wrong paths + missing endpoint) |
| Chat — WebSocket real-time | ✅ Working | Fixed (wrong WS path) |
| Notifications | ✅ Working | Derived from activity |
| Presence — heartbeat | ✅ Working | |
| Presence — real-time push | ⚠️ Partial | No broadcast, clients poll |
| Settings | ✅ Working | |
| Webhooks | ✅ Working | API-only |

---

## 22. Recommended Implementation Order

See `IMPLEMENTATION_ROADMAP.md` for the full phased plan.

Short summary:
1. ~~Phase 1: Critical path fixes~~ **DONE**
2. Phase 2: Unified task model (Tasks + Kanban integration, project_id FK, assignee_id)
3. Phase 3: Security hardening (Firestore rules)
4. Phase 4: Quality cleanup (empty catch blocks, legacy router removal, comment edit/delete)
5. Phase 5: Missing features (storage/Drive admin config, presence real-time, account deletion)

---

## 23. Testing Strategy

For every important mutation, verify:
1. Perform action in UI
2. Observe frontend state update
3. Query backend (GET the same resource)
4. Confirm data is present after page reload
5. Confirm from a second user/session that visibility matches permissions

Automated tests needed:
- `backend/tests/test_tasks.py` — full CRUD, authorization
- `backend/tests/test_auth.py` — register/login/token refresh
- `backend/tests/test_admin.py` — user management, bot management
- `backend/tests/test_files.py` — upload, download, share, trash
- `backend/tests/test_chat.py` — contacts list, send message, WebSocket

---

## 24. Risks

1. **Kanban ↔ Tasks migration** — existing `kanban_states` documents contain card content that
   must be migrated to the `tasks` collection. This is the highest-risk operation.
2. **Double-prefix fix side effects** — any external tools/scripts calling legacy paths would
   break. Unlikely (these paths were unreachable before the fix too), but worth auditing.
3. **Firestore rules lockdown** — if any part of the app accidentally uses the Firestore JS SDK
   client-side (currently: none), locking rules would break it.

---

## 25. Questions Requiring Human Decision

1. **Kanban architecture**: Should the Kanban board become a _view_ of the Tasks collection
   (recommended), or remain a separate data model? This changes migration complexity significantly.

2. **Legacy router removal timing**: Any external API consumers (bots, webhooks, scripts) using
   the unversioned paths (`/tasks`, `/team`, `/analytics`, `/activity`)?

3. **Real-time presence**: Is green-dot presence required now, or a future feature?

4. **Storage/Drive admin config**: Is Google Drive integration planned? If so, the Drive
   connection status, OAuth, and disconnect endpoints need backend implementation.

5. **Account deletion**: Should users be able to delete their own accounts?

6. **Chat message edit/delete**: Required, or out of scope for now?