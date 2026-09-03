# Upload System Rewrite: Direct Browser → R2

## What We're Building

Instead of routing file bytes through the backend, the browser uploads
directly to Cloudflare R2 using presigned URLs. The backend only handles
authentication, metadata, and signing — it never touches file bytes.

```
BEFORE:  Browser ──► Backend (streams bytes) ──► R2
AFTER:   Browser ──► Backend (metadata only, ~50ms)
         Browser ──────────────────────────────► R2 (direct, full speed)
```

---

## Step 1 — R2 CORS Setup (Cloudflare Dashboard)

Must be done once before any code changes work in production.

- [ ] Open Cloudflare Dashboard → R2 → `esaytech` bucket → Settings → CORS
- [ ] Add the following rule and save:

```json
[{
  "AllowedOrigins": ["https://workin.kiwimi.co"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["Content-Type", "Content-Length", "Content-Range"],
  "MaxAgeSeconds": 3600
}]
```

---

## Step 2 — Backend: Presign Helpers in `r2.py`

Add functions that generate presigned URLs using boto3 without touching file bytes.

- [x] Add `r2_presign_put(key, content_type, size, expires=3600) -> str`
      Returns a presigned PUT URL for a single file upload
- [x] Add `r2_presign_multipart_part(key, upload_id, part_number, expires=3600) -> str`
      Returns a presigned PUT URL for one multipart chunk
- [x] Add `r2_create_multipart_upload(key, content_type) -> str` (already exists — verify)
- [x] Add `r2_complete_multipart_upload(key, upload_id, parts) -> None` (already exists — verify)

---

## Step 3 — Backend: Deterministic File ID

Replace random UUIDs with a deterministic ID so retries and cron re-uploads
are always idempotent.

- [x] Add helper in `files_utils.py`:
      `make_file_id(owner_id: str, virtual_path: str) -> str`
      Uses `sha256(f"{owner_id}:{virtual_path}").hexdigest()[:32]`
- [x] Add Pydantic schemas to `files_utils.py`:
      `PresignBatchItem`, `PresignBatchResult`, `ConfirmUploadResponse`,
      `MultipartInitRequest`, `MultipartInitResponse`,
      `MultipartCompleteRequest`, `MultipartCompleteResponse`

---

## Step 4 — Backend: New Router `files_presign.py`

New file: `backend/app/routers/v1/files_presign.py`

- [x] `POST /presign/batch` — batch presign for small files
      - Accepts up to 50 files per request
      - Verifies auth once for the whole batch
      - For each file: compute `file_id`, check for conflict, write Firestore `status="pending"` via `set(merge=True)` (idempotent)
      - Returns list of `{ file_id, upload_url, expires_at, conflict }` 
- [x] `POST /confirm/{file_id}` — mark upload complete
      - Verifies ownership
      - Sets `status="active"`, `updated_at=now` in Firestore
      - Returns `FileRecordResponse`
- [x] `POST /presign/multipart/init` — start large file upload
      - Computes `file_id`, creates R2 multipart upload, presigns all part URLs at once
      - Writes Firestore `status="pending"`
      - Returns `{ file_id, upload_id, part_urls: [...] }`
- [x] `POST /presign/multipart/complete` — finish large file upload
      - Calls R2 `complete_multipart_upload` with ETags
      - Sets Firestore `status="active"`
      - Returns `FileRecordResponse`

---

## Step 5 — Backend: Register Router & Update `list_files`

- [x] Register `files_presign` router in `main.py` before `files_core`
- [x] Update `list_files` query to only return records where `status="active"` (or `status` field missing for legacy records)
- [x] Remove (or keep for local-dev fallback) `POST /api/v1/files/upload` streaming endpoint

---

## Step 6 — Frontend: Upload Queue Context Rewrite

File: `frontend/contexts/upload-queue-context.tsx`

- [x] Add `presignBatch(entries) -> PresignResult[]` — calls `POST /api/v1/files/presign/batch`
- [x] Add `confirmUpload(file_id)` — calls `POST /api/v1/files/confirm/{file_id}`
- [x] Replace `uploadWithXHR` with `uploadWithPresign(item)`:
      - XHR `PUT item.upload_url` directly to R2
      - On 200 → call `confirmUpload(item.file_id)`
      - Progress events work identically (XHR to R2 fires `upload.onprogress`)
- [x] Replace `runChunkedUpload` with `runMultipartPresign(item)`:
      - Call `POST /presign/multipart/init` → get all part URLs
      - XHR PUT each part to its presigned URL, collect ETags
      - Call `POST /presign/multipart/complete` with ETags
- [x] Update `addFilesWithPaths(entries)`:
      - Split entries into batches of 20
      - Call `presignBatch` for each batch (background, before upload starts)
      - Attach `upload_url` and `file_id` to each queue item
- [x] Add presign URL expiry guard:
      - If item has been queued for > 55 min, re-presign before uploading
- [x] Handle `conflict: true` response from presign:
      - Show item as "already exists — skip or replace?"
      - Skip button: remove from queue
      - Replace button: re-presign with `overwrite=true` and re-queue

---

## Step 7 — Tests

- [x] `backend/tests/test_presign.py` — new test file:
      - `test_batch_presign_returns_urls` — 3 files → 3 signed URLs returned
      - `test_batch_presign_conflict_no_overwrite` — existing active file → `conflict=true`
      - `test_batch_presign_conflict_with_overwrite` — existing active file + `overwrite=true` → new URL
      - `test_batch_presign_idempotent` — same path twice in one batch → same `file_id`
      - `test_confirm_marks_active` — confirm flips status to active
      - `test_confirm_wrong_owner_403` — cannot confirm another user's file
      - `test_multipart_init_returns_part_urls` — correct number of part URLs
      - `test_multipart_complete_marks_active` — complete flips status to active
      - `test_list_files_excludes_pending` — pending records not shown in file list
- [x] Run full test suite — all 50+ existing tests still pass

---

## Step 8 — Deploy & Verify

- [ ] `docker compose up -d --build`
- [ ] Upload a single small file → appears in file list ✓
- [ ] Upload a single large file (> 100 MB) → multipart flow works ✓
- [ ] Upload a folder with 20+ files → batch presign works, all appear ✓
- [ ] Upload the same file twice → second shows "already exists" ✓
- [ ] Retry a failed upload → no duplicate created ✓
- [ ] Trash a file → permanent delete removes from R2 ✓

---

## What Changes, What Stays

| | Before | After |
|---|---|---|
| File bytes | Stream through backend RAM | Never touch backend |
| Backend role | File I/O + metadata | Metadata only |
| 502 Bad Gateway | Happens under load | Impossible (no file I/O) |
| 1500 file folder | Crashes backend | Batch presign, steady |
| Retry safety | May duplicate | Idempotent by design |
| Cron re-upload | 409 error | Silent upsert |
| Local dev (no R2) | Works via local disk | Falls back to old upload endpoint |
