"""Core CRUD routes for /api/v1/files.

Handles: list directory, upload file, create folder, download, rename,
move, copy, delete, star, patch metadata, quota, and recent files.
"""

import io
import logging
import secrets
import shutil
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from firebase_admin import firestore

from app.deps import Actor, get_current_actor, get_current_user
from app.firebase import get_db
from app.routers.v1.files_utils import UPLOAD_SEMAPHORE, MAX_SINGLE_REQUEST_BYTES
from app.models import User
from app.r2 import (
    r2_copy_object,
    r2_delete_object,
        r2_upload_fileobj,
)
logger = logging.getLogger(__name__)

# Simple upload size limit: files >= MAX_SINGLE_REQUEST_BYTES must use the chunked upload API.

# MIME types that must never be accepted because a browser may execute them
# when served back (e.g. via a share link or direct download).
BLOCKED_MIME_TYPES = frozenset({
    "text/html",
    "application/javascript",
    "application/x-javascript",
    "application/x-httpd-php",
    "application/x-sh",
    "application/x-perl",
})

from app.routers.v1.files_utils import (
    CopyBody,
    FileRecordResponse,
    FolderCreateBody,
    MoveBody,
    QuotaResponse,
    RenameBody,
        _assert_owner,
    _build_path,
    _cascade_rename,
    _doc_to_response,
    _get_record_or_404,
    _local_path,
    _now,
    _use_r2,
)

router = APIRouter(prefix="/files", tags=["v1-files"])


@router.get("", response_model=list[FileRecordResponse])
def list_files(
    path: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[FileRecordResponse]:
    """List non-deleted files/folders at the given directory path."""
    docs = (
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .where("parent_path", "==", path)
        .where("is_deleted", "==", False)
        .stream()
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("/upload", response_model=FileRecordResponse, status_code=201)
async def upload_file(
    file: UploadFile,
    # The frontend sends "path" (the parent directory) as a FormData field.
    # We read it via Form() rather than Query() so multipart requests work correctly.
    path: str = Form(default=""),
    overwrite: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Upload a file to the given parent directory path.

    The upload is queued behind UPLOAD_SEMAPHORE so at most 3 large uploads
    buffer in memory at once per process (matching MAX_CONCURRENT=3 in the
    frontend); additional requests wait rather than competing for RAM.
    """
    # Reject oversized uploads before buffering any bytes.
    content_length = file.size  # set by FastAPI from Content-Length header when present
    if content_length is not None and content_length > MAX_SINGLE_REQUEST_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {MAX_SINGLE_REQUEST_BYTES // (1024 * 1024)} MiB limit for simple upload. Use the chunked upload API (/files/upload/init).",
        )

    file_id = str(uuid.uuid4())
    r2_key = f"shared/{file_id}"

    # Strip directory components from client-supplied filename to prevent traversal.
    raw_name = file.filename or f"upload-{file_id}"
    filename = Path(raw_name).name or f"upload-{file_id}"
    if not filename or filename in (".", ".."):
        filename = f"upload-{file_id}"

    # parent_path is the "path" field from the frontend FormData.
    parent_path = path
    virtual_path = _build_path(parent_path, filename)

    # ── Deduplication check ─────────────────────────────────────────────────
    # Look for an existing, non-deleted file record with the same virtual path
    # owned by this user.  A file with the same name in the same folder counts
    # as a collision regardless of whether it was uploaded in this session.
    # The query is wrapped in a try/except so that a missing Firestore
    # composite index (while the index is being built) degrades gracefully to
    # "no dedup" rather than crashing the upload with a 500.
    try:
        existing_docs = (
            db.collection("file_records")
            .where("owner_id", "==", current_user.id)
            .where("path", "==", virtual_path)
            .where("is_deleted", "==", False)
            .limit(1)
            .get()
        )
    except Exception:
        existing_docs = []
    existing_id: str | None = None
    existing_r2_key: str | None = None
    if existing_docs:
        existing_doc = existing_docs[0]
        existing_data = existing_doc.to_dict() or {}
        if not overwrite:
            raise HTTPException(
                status_code=409,
                detail=f"A file named '{filename}' already exists at this location. "
                       "Set overwrite=true to replace it.",
            )
        # overwrite=True: remember the old record so we can delete it after
        # the new file is safely written.
        existing_id = existing_doc.id
        existing_r2_key = existing_data.get("r2_key")

    async with UPLOAD_SEMAPHORE:
        if _use_r2():
            # Stream UploadFile into a temp file first (avoids loading entire
            # file into RAM), then hand the file handle to boto3's upload_fileobj
            # which does S3 multipart internally.
            from app.routers.v1.files_utils import _storage_root as _sr
            tmp_dir = _sr() / "tmp"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp_r2 = tmp_dir / f".tmp-r2-{file_id}"
            try:
                size = 0
                with open(tmp_r2, "wb") as _tmp:
                    while True:
                        chunk = await file.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > MAX_SINGLE_REQUEST_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail=f"File exceeds {MAX_SINGLE_REQUEST_BYTES // (1024 * 1024)} MiB limit for simple upload. Use the chunked upload API (/files/upload/init).",
                            )
                        _tmp.write(chunk)
                with open(tmp_r2, "rb") as _tmp:
                    await r2_upload_fileobj(
                        _tmp,
                        r2_key,
                        file.content_type or "application/octet-stream",
                    )
            finally:
                tmp_r2.unlink(missing_ok=True)
        else:
            local = _local_path(r2_key)
            local.parent.mkdir(parents=True, exist_ok=True)
            # Write to a temp file first, then rename atomically (os.replace is
            # POSIX rename(2) — atomic even across a crash mid-write, so the
            # final path never contains a partial file).
            tmp_local = local.parent / f".tmp-{file_id}"
            try:
                size = 0
                with open(tmp_local, "wb") as dest:
                    while True:
                        chunk = await file.read(1024 * 1024)
                        if not chunk:
                            break
                        if size + len(chunk) > MAX_SINGLE_REQUEST_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail=f"File exceeds {MAX_SINGLE_REQUEST_BYTES // (1024 * 1024)} MiB limit for simple upload. Use the chunked upload API (/files/upload/init).",
                            )
                        dest.write(chunk)
                        size += len(chunk)
                os.replace(tmp_local, local)  # atomic rename
            finally:
                if tmp_local.exists():
                    tmp_local.unlink(missing_ok=True)

    now = _now()
    data = {
        "owner_id": current_user.id,
        "name": filename,
        "path": virtual_path,
        "parent_path": parent_path,
        "type": "file",
        "size": size,
        "mime_type": file.content_type,
        "r2_key": r2_key,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("file_records").document(file_id).set(data)

    # ── Overwrite cleanup ────────────────────────────────────────────────────
    # Now that the new file is safely written, remove the old Firestore record
    # and its backing storage so we don't accumulate orphaned records/bytes.
    if existing_id:
        db.collection("file_records").document(existing_id).delete()
        if existing_r2_key:
            try:
                if _use_r2():
                    await r2_delete_object(existing_r2_key)
                else:
                    old_local = _local_path(existing_r2_key)
                    if old_local.exists():
                        old_local.unlink(missing_ok=True)
            except Exception:
                # Swallow storage errors — the new record is already the source
                # of truth; the old bytes are merely orphaned, not dangerous.
                pass

    return _doc_to_response(file_id, data)


@router.post("/folder", response_model=FileRecordResponse, status_code=201)
def create_folder(
    body: FolderCreateBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Create a new (empty) folder."""
    folder_id = str(uuid.uuid4())
    path = _build_path(body.parent_path, body.name)
    now = _now()
    data = {
        "owner_id": current_user.id,
        "name": body.name,
        "path": path,
        "parent_path": body.parent_path,
        "type": "folder",
        "size": None,
        "mime_type": None,
        "r2_key": None,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "color": None,
        "icon_emoji": None,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("file_records").document(folder_id).set(data)
    return _doc_to_response(folder_id, data)


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Download a file (attachment disposition)."""
    fid, data = _get_record_or_404(file_id, db)
    _assert_owner(data, current_user)
    if data.get("type") == "folder":
        raise HTTPException(status_code=400, detail="Cannot download a folder directly.")
    r2_key = data.get("r2_key")
    if not r2_key:
        raise HTTPException(status_code=404, detail="File content not found.")

    filename = data.get("name", "download")

    mime = data.get("mime_type") or "application/octet-stream"
    disposition = f'attachment; filename="{filename}"'

    if _use_r2():
        # Stream through the backend so the browser never hits R2 directly.
        # A direct redirect to a presigned R2 URL fails with CORS errors on
        # private Cloudflare R2 buckets.
        from app.r2 import r2_iter_object
        _log_access(file_id, current_user.id, "download", db)
        return StreamingResponse(
            r2_iter_object(r2_key),
            media_type=mime,
            headers={"Content-Disposition": disposition},
        )

    local = _local_path(r2_key)
    if not local.exists():
        raise HTTPException(status_code=404, detail="File not found on disk.")

    _log_access(file_id, current_user.id, "download", db)
    return FileResponse(str(local), filename=filename, media_type=mime)


@router.get("/preview/{file_id}")
async def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Serve a file inline (preview disposition)."""
    fid, data = _get_record_or_404(file_id, db)
    r2_key = data.get("r2_key")
    if not r2_key:
        raise HTTPException(status_code=404, detail="File content not found.")

    mime = data.get("mime_type") or "application/octet-stream"

    if _use_r2():
        # Stream through the backend — direct R2 redirects cause CORS errors
        # on private Cloudflare R2 buckets.
        from app.r2 import r2_iter_object
        _log_access(file_id, current_user.id, "preview", db)
        return StreamingResponse(
            r2_iter_object(r2_key),
            media_type=mime,
            headers={"Content-Disposition": "inline"},
        )

    local = _local_path(r2_key)
    if not local.exists():
        raise HTTPException(status_code=404, detail="File not found on disk.")

    _log_access(file_id, current_user.id, "preview", db)
    return FileResponse(str(local), media_type=mime)


@router.put("/rename/{file_id}", response_model=FileRecordResponse)
def rename_file(
    file_id: str,
    body: RenameBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Rename a file or folder (updates paths of descendants for folders)."""
    fid, data = _get_record_or_404(file_id, db)
    _assert_owner(data, current_user)
    old_path = data["path"]
    parent_path = data["parent_path"]
    new_path = _build_path(parent_path, body.name)
    now = _now()

    updates = {"name": body.name, "path": new_path, "updated_at": now}
    db.collection("file_records").document(fid).update(updates)

    if data.get("type") == "folder":
        _cascade_rename(db, old_path, new_path)

    return _doc_to_response(fid, {**data, **updates})


@router.put("/move/{file_id}", response_model=FileRecordResponse)
def move_file(
    file_id: str,
    body: MoveBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Move a file or folder to a new parent directory."""
    fid, data = _get_record_or_404(file_id, db)
    old_path = data["path"]
    new_path = _build_path(body.dest_parent, data["name"])
    now = _now()

    updates = {"path": new_path, "parent_path": body.dest_parent, "updated_at": now}
    db.collection("file_records").document(fid).update(updates)

    if data.get("type") == "folder":
        _cascade_rename(db, old_path, new_path)

    return _doc_to_response(fid, {**data, **updates})


@router.post("/copy/{file_id}", response_model=FileRecordResponse, status_code=201)
async def copy_file(
    file_id: str,
    body: CopyBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Copy a file to a new parent directory."""
    fid, data = _get_record_or_404(file_id, db)
    new_id = str(uuid.uuid4())
    new_r2_key: Optional[str] = None

    if data.get("r2_key") and data.get("type") == "file":
        new_r2_key = f"shared/{new_id}"
        if _use_r2():
            await r2_copy_object(data["r2_key"], new_r2_key)
        else:
            import shutil
            src = _local_path(data["r2_key"])
            dst = _local_path(new_r2_key)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    now = _now()
    new_path = _build_path(body.dest_parent, data["name"])
    new_data = {
        **data,
        "path": new_path,
        "parent_path": body.dest_parent,
        "r2_key": new_r2_key,
        "is_deleted": False,
        "deleted_at": None,
        "is_starred": False,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("file_records").document(new_id).set(new_data)
    return _doc_to_response(new_id, new_data)


@router.delete("/{file_id}", status_code=204)
async def delete_file_permanently(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Permanently delete a file and its storage object."""
    fid, data = _get_record_or_404(file_id, db)
    _assert_owner(data, current_user)
    r2_key = data.get("r2_key")

    # Delete the Firestore record first — this is the authoritative signal
    # that the file is gone.  Storage cleanup is best-effort: an orphaned
    # object (bytes wasted) is always preferable to a missing record
    # (user sees a broken file they can never remove).
    db.collection("file_records").document(fid).delete()

    if r2_key:
        try:
            if _use_r2():
                await r2_delete_object(r2_key)
            else:
                local = _local_path(r2_key)
                if local.exists():
                    local.unlink()
        except Exception as err:
            logger.warning(
                "[files] delete_file: storage cleanup failed for %s: %s", fid, err
            )


@router.post("/star/{file_id}", response_model=FileRecordResponse)
def toggle_star(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Toggle the starred flag on a file or folder."""
    fid, data = _get_record_or_404(file_id, db)
    new_starred = not data.get("is_starred", False)
    now = _now()
    db.collection("file_records").document(fid).update({"is_starred": new_starred, "updated_at": now})
    return _doc_to_response(fid, {**data, "is_starred": new_starred, "updated_at": now})


@router.get("/starred", response_model=list[FileRecordResponse])
def list_starred(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[FileRecordResponse]:
    """Return all non-deleted starred files for the current user."""
    docs = (
        db.collection("file_records")
        .where("is_starred", "==", True)
        .where("is_deleted", "==", False)
        .stream()
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.get("/recent", response_model=list[FileRecordResponse])
def list_recent(
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[FileRecordResponse]:
    """Return recently accessed files for the current user."""
    logs = sorted(
        db.collection("file_access_logs")
        .where("user_id", "==", current_user.id)
        .limit(limit * 10)
        .stream(),
        key=lambda d: (d.to_dict() or {}).get("accessed_at") or "",
        reverse=True,
    )

    seen: set[str] = set()
    result: list[FileRecordResponse] = []
    for log_doc in logs:
        log_data = log_doc.to_dict() or {}
        fid = log_data.get("file_id", "")
        if fid in seen:
            continue
        seen.add(fid)
        doc = db.collection("file_records").document(fid).get()
        if doc.exists and not (doc.to_dict() or {}).get("is_deleted", False):
            result.append(_doc_to_response(doc.id, doc.to_dict() or {}))
        if len(result) >= limit:
            break

    return result


@router.get("/quota", response_model=QuotaResponse)
def get_quota(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> QuotaResponse:
    """Return the total used bytes and file count for the current user."""
    docs = (
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .where("is_deleted", "==", False)
        .where("type", "==", "file")
        .stream()
    )
    used_bytes = 0
    file_count = 0
    for doc in docs:
        d = doc.to_dict() or {}
        used_bytes += d.get("size") or 0
        file_count += 1

    return QuotaResponse(used_bytes=used_bytes, file_count=file_count)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _log_access(file_id: str, user_id: str, action: str, db: firestore.Client) -> None:
    """Append a file access log entry (best-effort, never raises)."""
    try:
        log_id = str(uuid.uuid4())
        db.collection("file_access_logs").document(log_id).set({
            "file_id": file_id,
            "user_id": user_id,
            "action": action,
            "accessed_at": _now(),
        })
    except Exception as err:
        logger.warning("[files] _log_access failed for file %s user %s: %s", file_id, user_id, err)