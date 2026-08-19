---
name: project-files-system
description: Complete architecture of the Files subsystem — backend, frontend, storage, components, actions, models
metadata:
  type: project
---

# Files Subsystem — Full Architecture (100% coverage)

## Database Models (`backend/app/models.py`)

### `FileRecord` (SQLModel table)
```python
id: str (UUID, PK)
owner_id: int (FK → User)
name: str
path: str           # full path e.g. "Documents/Reports/Q1.pdf"
parent_path: str    # parent dir e.g. "Documents/Reports"
type: str           # "file" | "folder"
size: int | None    # bytes
mime_type: str | None
r2_key: str | None  # storage key: "<owner_id>/<uuid>" for files; None for folders
is_deleted: bool    # soft-delete (trash)
deleted_at: datetime | None
is_starred: bool
color: str | None   # folder custom color
icon_emoji: str | None  # folder custom emoji
created_at: datetime
updated_at: datetime
```

### `FileShare` (SQLModel table)
```python
id: str (UUID, PK)
file_id: str (FK → FileRecord)
owner_id: int
shared_with_user_id: int | None  # None = public link
share_token: str | None          # random token for link sharing
permission_level: str            # "view" | "edit"
expires_at: datetime | None
created_at: datetime
```

### `FileAccessLog` (SQLModel table)
```python
id: int (PK autoincrement)
file_id: str (FK → FileRecord)
user_id: int
action: str    # e.g. "download", "view", "upload"
accessed_at: datetime
```

## Storage Layer

### R2 mode (Cloudflare) — `backend/app/r2.py`
- **Triggered when**: `CLOUDFLARE_ACCOUNT_ID` (or `R2_ACCOUNT_ID`) AND `R2_BUCKET_NAME` are set
- **Client**: boto3 S3-compatible, endpoint `https://<account_id>.r2.cloudflarestorage.com`
- **Key format**: `<owner_id>/<uuid>` (same field used as disk path in local mode)
- **All boto3 calls** run in `asyncio.run_in_executor(None, ...)` — non-blocking
- **Functions exported**:
  - `r2_upload_fileobj(file_obj, key, content_type)`
  - `r2_delete_object(key)`
  - `r2_delete_objects(keys)` — batch delete
  - `r2_copy_object(source_key, dest_key)`
  - `r2_get_object_bytes(key)` → bytes
  - `r2_generate_presigned_url(key, expires_in, disposition)` → URL

### Local disk mode (default)
- **Root**: `FILE_STORAGE_PATH` env var → fallback `<repo>/frontend/data/`
- **Path resolution**: `_local_path(r2_key)` = `_storage_root() / r2_key`
- **r2_key** is reused as the local relative path: `<owner_id>/<uuid>`

### `_use_r2()` — checked per-request (not at startup)

## Backend Router — `backend/app/routers/v1/files.py`
**Prefix**: `/api/v1/files` (registered in `main.py` as `app.include_router(v1_files.router, prefix="/api/v1")`)  
**Auth**: all routes require `get_current_user` dependency (JWT)

### Full Endpoint Map

| Method | Path | Description |
|--------|------|-------------|
| GET | `/list` | List files/folders. Query: `path`, `show_trash` |
| POST | `/upload` | Upload file. Form: `file`, `path`, `overwrite` |
| POST | `/folder` | Create folder. Body: `{name, parent_path}` |
| PATCH | `/rename/{id}` | Rename. Body: `{name}` |
| POST | `/move/{id}` | Move. Body: `{dest_parent}` |
| POST | `/copy/{id}` | Copy file (new UUID, new r2_key). Body: `{dest_parent}` |
| DELETE | `/trash/{id}` | Soft-delete (sets `is_deleted=True`, `deleted_at=now`) |
| POST | `/restore/{id}` | Restore from trash |
| DELETE | `/permanent/{id}` | Hard delete — removes from DB + storage |
| DELETE | `/empty-trash` | Hard-delete all soft-deleted items for current user |
| GET | `/download/{id}` | Download: R2 → redirect to presigned URL; local → FileResponse |
| GET | `/preview-url/{id}` | Returns presigned URL for inline preview (TTL 5 min) |
| GET | `/download-url/{id}` | Returns presigned URL for attachment download (TTL 1 h) |
| POST | `/zip` | Zip multiple files. Body: `{ids: string[]}` |
| PATCH | `/customize/{id}` | Set color/icon_emoji. Body: `{color?, icon_emoji?}` |
| GET | `/search` | Search. Query: `q`, `path`, `type`, `mime_category`, `min_size`, `max_size`, `date_from`, `date_to`, `is_starred` |
| GET | `/quota` | Storage usage for current user. Returns `{used_bytes, file_count}` |
| GET | `/starred` | List starred files for current user |
| GET | `/recent` | Recent files. Query: `limit` (default 20) |
| POST | `/star/{id}` | Toggle star |
| POST | `/share/{file_id}` | Create share. Body: `{shared_with_user_id?, permission_level, expires_at?}` |
| GET | `/share/{file_id}` | List shares for a file |
| DELETE | `/share/{share_id}` | Delete a share |
| POST | `/share/{file_id}/link` | Create public link (share_token) |
| POST | `/bulk-move` | Move multiple. Body: `{ids, dest_parent}` → `{succeeded, failed}` |
| POST | `/bulk-copy` | Copy multiple. Body: `{ids, dest_parent}` → `{succeeded, failed}` |
| DELETE | `/bulk-trash` | Trash multiple. Body: `{ids}` → `{succeeded, failed}` |

### Upload flow (detail)
1. `r2_key = f"{current_user.id}/{uuid4()}"`
2. If overwrite=True and name+path already exists → delete old storage, reuse record
3. If R2: `await r2_upload_fileobj(file.file, r2_key, mime)` → then `head_object` for real size
4. If local: `disk_path.parent.mkdir(parents=True)` → `disk_path.write_bytes(await file.read())`
5. Upsert `FileRecord` with new `r2_key`, `size`, `mime_type`, `updated_at`

### Download flow (detail)
- If R2: `RedirectResponse` to presigned URL (1h TTL, `Content-Disposition: attachment`)
- If local: `FileResponse(disk_path, media_type=mime, filename=record.name)`

## Frontend — `frontend/lib/actions/files.ts`
**NOT** a Next.js Server Action file — it's a plain client-side module exporting async functions that call the backend via `apiClient` (from `@/lib/api`) or raw `fetch`.

### TypeScript types
```ts
interface FileRecord {
  id: string; name: string; path: string; parent_path: string
  type: "file" | "folder"; size?: number; mime_type?: string
  is_deleted: boolean; deleted_at?: string
  created_at: string; updated_at: string
  color?: string | null; icon_emoji?: string | null; is_starred?: boolean
}

interface SearchFilters {
  type?, mimeCategory?, minSize?, maxSize?, dateFrom?, dateTo?, isStarred?
}

interface QuotaInfo { used_bytes: number; file_count: number }
```

### Upload uses raw `fetch` (NOT `apiClient`)
`apiClient` forces `Content-Type: application/json`; upload needs `multipart/form-data` — so `uploadFile()` uses raw `fetch` with `FormData`.

## Frontend Page — `frontend/app/files/[[...path]]/page.tsx`
- **Server Component** (no data-fetching at page level — auth tokens are in localStorage)
- Passes `currentPath` (joined params) and empty `initialItems=[]` to `<FileClientPage>`
- Data fetching happens client-side in `FileClientPage` via `useEffect → listFiles()`

## Frontend Components (`frontend/components/files/`)

### `file-client-page.tsx` — Main orchestrator
- Client Component that owns all state
- On mount: `useEffect → listFiles(currentPath)` → sets `items`
- Manages: `viewMode`, `showPreview`, `searchQuery`, `searchResults`, `isSearching`
- Composes: `FileLayout` → `FileBreadcrumbs` + `FileToolbar` + `FileDropZone` + `FileExplorer` + `FilePreviewPanel` + `UploadTray` + `TrashDialog`
- On `router.refresh()` → re-fetches from backend

### `file-explorer.tsx` — List/Grid view + all file interactions
- Receives `items: FileItem[]`, manages selection state (`selectedPaths: Set<string>`)
- **Two view modes**: Grid (FileGrid) and List (table with DndTableRow)
- **dnd-kit**: `DndContext` wraps everything; `useDraggable`/`useDroppable` on each row/card; drag-to-folder moves file via `moveFile(id, folderPath)`
- **Selection**: click (single), Ctrl/Meta+click (multi-add), Shift+click (range), lasso drag
- **Clipboard**: cut/copy/paste with `Clipboard = {paths, mode: "copy"|"cut"}`; paste calls `copyFile` or `moveFile` batch
- **Dialogs**: inline rename dialog, move-to dialog (shows folder list), AlertDialog for delete
- **Context menus**: radix ContextMenu on each item (Open, Download, Star, Pin, Copy, Cut, Rename, Move, Delete)
- **Sorting**: Name, Size, Modified — ascending/descending, stored in `useLocalStorage`
- **Sort preferences**: `useLocalStorage("wms:files-sort", {key: "name", dir: "asc"})`

### `file-grid.tsx` — Grid card view
- `DndGridCard` wrapper (draggable + droppable on folders)
- Image files: lazy-load thumbnail via `getPreviewUrl(item.id)` → presigned URL → `<img>`
- Folder drops: `useDroppable` on folder cards → triggers move
- ContextMenu per card

### `file-toolbar.tsx` — Top toolbar
- Upload button → hidden `<input type="file" multiple>` → `addFiles()` from `useUploadQueue`
- Folder upload → `<input webkitdirectory>` → maps `webkitRelativePath` to reconstruct subfolder paths
- New Folder → Dialog → `createFolder(path, name)` → `router.refresh()`
- RBAC: `usePermission("files:upload")`, `usePermission("files:create_folder")`

### `file-drop-zone.tsx` — Drag-from-OS overlay
- Wraps entire page area in HTML5 drag events (not dnd-kit — this is OS file drag)
- `dragCounter` ref prevents flicker on child element transitions
- Also handles **Ctrl+V paste** (`onPaste` → reads `clipboardData.items` for files)
- On drop/paste: `addFiles(files, currentPath)` from `useUploadQueue`
- Shows animated overlay with bounce icon while dragging

### `upload-queue.tsx` — Upload queue context + hook
- `UploadQueueProvider` — Context provider, wraps FileExplorer
- `useUploadQueue()` hook: `{ items, addFiles, removeItem, clearCompleted }`
- Each `addFiles(files[], path)` call: creates `UploadItem[]` with status "pending"
- Upload via **XHR** (not fetch) for progress tracking: `xhr.upload.onprogress → item.progress`
- URL: `POST ${API_BASE_URL}/api/v1/files/upload`
- Concurrent: uploads run in parallel (no queue throttle)
- Items: `{ id, file, path, status: "pending"|"uploading"|"done"|"error", progress: 0-100 }`
- Also has a duplicate context at `frontend/contexts/upload-queue-context.tsx` (older version)

### `upload-tray.tsx` — Floating upload progress tray
- Fixed bottom-right floating panel showing active uploads
- Shows file name, progress bar, status icons (spinner/check/error)
- "Clear completed" button

### `file-preview-panel.tsx` — Right-side preview panel
- Slide-in panel (not vaul Drawer — custom CSS slide)
- Fetches preview URL via `getPreviewUrl(item.id)` → presigned URL
- Renders:
  - Images: `<img src={presignedUrl}>`
  - Video: `<video controls>`
  - Audio: `<audio controls>`
  - PDF: `<iframe src={presignedUrl}>`
  - Text/code: fetch raw content → `<pre>` or syntax highlighting
  - Others: download button only
- Shows metadata: name, size, type, created/modified dates, path

### `file-breadcrumbs.tsx` — Path breadcrumb navigation
- Splits `currentPath` by `/` → array of segments
- Each segment is a `<Link>` to `/files/<cumulative-path>`
- "Files" root always shown as first item

### `file-layout.tsx` — Layout wrapper
- Provides two-column layout: sidebar (pinned folders, starred, recent) + main content area
- Pinned folders: `usePinnedFolders()` → shows in left panel
- Quick-access: Starred, Recent sections (calls `getStarredFiles()`, `getRecentFiles()`)

### `selection-lasso.tsx` — Rubber-band multi-select
- Mouse-down → drag → draws translucent lasso rectangle
- On mouse-up: calculates which file cards are inside the lasso rect → selects them
- Uses `getBoundingClientRect()` intersection logic

### `search-filter-panel.tsx` — Advanced search filters
- Type filter (file/folder), MIME category, size range, date range, starred toggle
- Emits `SearchFilters` object upward

### `search-results-view.tsx` — Search results display
- Flat list of search results (bypasses folder hierarchy)
- Each result shows path for context
- Reuses FileGrid/list item components

### `trash-dialog.tsx` — Trash management dialog
- Lists all soft-deleted files for current user (`listFiles("", showTrash=true)`)
- Per-item: Restore (`restoreFile(id)`) or Permanently Delete (`permanentDelete(id)`)
- "Empty Trash" button → `emptyTrash()` → `DELETE /api/v1/files/empty-trash`

### `share-dialog.tsx` — File sharing dialog
- Lists existing shares (`getShares(fileId)`)
- Share with specific user (select from team) or create public link
- Copy public link to clipboard
- Delete individual shares
- Calls: `createShare()`, `deleteShare()`, `createPublicLink()`

### `folder-customize-dialog.tsx` — Folder color/emoji picker
- Color palette (oklch swatches) + emoji grid
- Calls `customizeFile(id, {color, icon_emoji})`

## `file-utils.tsx` — Shared utility functions
```ts
interface FileItem {
  id: string; name: string; path: string; parent_path: string
  type: "file" | "folder"; size?: number; mime_type?: string
  is_starred?: boolean; color?: string; icon_emoji?: string
  isDriveFile?: boolean  // Google Drive files (read-only, no drag)
}

interface SearchResult extends FileItem { score?: number }

getFileIcon(item): string          // icon name based on mime type
isImageFile(item): boolean
formatSize(bytes): string          // "1.2 MB"
getFileOpenUrl(item): string       // presigned preview URL or download
downloadFile(item): void           // triggers browser download
getPreviewUrl(id): Promise<string> // calls /api/v1/files/preview-url/{id}
```

## RBAC Permissions
Used via `usePermission(permission)` hook:
- `"files:upload"` — can upload files
- `"files:create_folder"` — can create folders

## Data Flow Summary

```
URL: /files/Documents/Reports
    ↓
FilesPage (Server Component)
    ↓ currentPath = "Documents/Reports"
FileClientPage (Client, useEffect)
    ↓ listFiles("Documents/Reports")
    ↓ GET /api/v1/files/list?path=Documents/Reports
FastAPI → queries FileRecord WHERE parent_path="Documents/Reports" AND owner_id=me AND is_deleted=False
    ↓ returns FileRecord[]
FileClientPage → setItems(records)
    ↓
FileLayout → FileExplorer (list) + FileGrid (grid)
    ↓
User: drops file from OS
    ↓ FileDropZone.onDrop → addFiles(files, "Documents/Reports")
UploadQueueProvider → XHR POST /api/v1/files/upload (form: file, path, overwrite)
    ↓ FastAPI: r2_key = "{user_id}/{uuid}", upload to R2 or disk, upsert FileRecord
    ↓ router.refresh() → FileClientPage re-fetches listFiles()
```

## Key Design Facts
1. **Metadata always in PostgreSQL** — even in R2 mode. `FileRecord` is always the source of truth for listing/search.
2. **r2_key is dual-purpose** — used as both the R2 object key AND the local disk relative path.
3. **Folders have no r2_key** — type="folder" records exist only in DB with no associated bytes.
4. **Soft delete first** — `trashFile()` sets `is_deleted=True`; `permanentDelete()` removes bytes + DB row.
5. **Upload uses XHR (not fetch)** in the queue provider for real-time `onprogress` events.
6. **`uploadFile()` in actions/files.ts uses raw fetch** (not apiClient) because FormData must not have Content-Type forced to application/json.
7. **Preview TTL = 5 min, Download TTL = 1 h** for presigned URLs.
8. **`isDriveFile` flag** — items from Google Drive integration are read-only; no drag, no delete, no rename in UI.
9. **Folder upload** uses `webkitdirectory` attribute + `webkitRelativePath` to reconstruct subfolder paths client-side before uploading each file individually.
10. **`useLocalStorage("wms:files-sort")`** — sort preference persists across sessions.
11. **Two upload queue implementations exist**: `components/files/upload-queue.tsx` (active) and `contexts/upload-queue-context.tsx` (older, may be unused).