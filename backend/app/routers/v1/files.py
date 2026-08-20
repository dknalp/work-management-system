"""File management API.

All routes live under /api/v1/files (prefix set in main.py).
Auth: every route requires a valid JWT via get_current_user.
Storage: file bytes in Cloudflare R2 (when env vars are set) OR local disk
  (fallback when R2 is not configured). Metadata always in PostgreSQL (FileRecord).
"""

import io
import mimetypes
import os
import secrets
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, col, func, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileAccessLog, FileRecord, FileShare, User
from app.r2 import (
    r2_copy_object,
    r2_delete_object,
    r2_delete_objects,
    r2_generate_presigned_url,
    r2_get_object_bytes,
    r2_upload_fileobj,
)

router = APIRouter(prefix="/files", tags=["files"])

_PREVIEW_TTL = 300    # 5 min for inline preview
_DOWNLOAD_TTL = 3600  # 1 h for attachment download


# ---------------------------------------------------------------------------
# Storage helpers — R2 vs local disk
# ---------------------------------------------------------------------------

def _use_r2() -> bool:
    """Return True when R2 env vars are fully configured."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID", "")
    bucket = os.environ.get("R2_BUCKET_NAME", "")
    return bool(account_id and bucket)


def _storage_root() -> Path:
    """Return the local disk storage root (used when R2 is not configured).

    Resolution order:
    1. FILE_STORAGE_PATH env var (absolute or relative to CWD)
    2. <repo_root>/frontend/data/ as documented in CLAUDE.md
    """
    custom = os.environ.get("FILE_STORAGE_PATH", "").strip()
    if custom:
        return Path(custom)
    # This file is at backend/app/routers/v1/files.py; go up 4 levels to repo root.
    return Path(__file__).parents[4] / "frontend" / "data"


def _local_path(r2_key: str) -> Path:
    """Convert an r2_key (e.g. '<owner_id>/<uuid>') to an absolute local disk path."""
    return _storage_root() / r2_key


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class FileRecordResponse(BaseModel):
    id: str
    name: str
    path: str
    parent_path: str
    type: str
    size: Optional[int]
    mime_type: Optional[str]
    is_deleted: bool
    deleted_at: Optional[datetime]
    is_starred: bool
    color: Optional[str] = None
    icon_emoji: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderCreateBody(BaseModel):
    name: str
    parent_path: str = ""


class RenameBody(BaseModel):
    name: str


class MoveBody(BaseModel):
    dest_parent: str


class CopyBody(BaseModel):
    dest_parent: str


class ZipBody(BaseModel):
    ids: list[str]


class QuotaResponse(BaseModel):
    used_bytes: int
    file_count: int


class PresignedUrlResponse(BaseModel):
    url: str


class ShareCreateBody(BaseModel):
    shared_with_user_id: Optional[str] = None
    permission_level: str = "view"
    expires_at: Optional[datetime] = None


class ShareResponse(BaseModel):
    id: str
    file_id: str
    owner_id: str
    shared_with_user_id: Optional[str]
    share_token: Optional[str]
    permission_level: str
    expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkMoveBody(BaseModel):
    ids: list[str]
    dest_parent: str


class BulkCopyBody(BaseModel):
    ids: list[str]
    dest_parent: str


class BulkTrashBody(BaseModel):
    ids: list[str]


class BulkResult(BaseModel):
    succeeded: list[str]
    failed: list[str]


class DriveImportBody(BaseModel):
    """Request body for POST /import-from-drive."""

    file_id: str
    """Google Drive file ID (from the Picker callback)."""

    access_token: str
    """Short-lived OAuth access token with drive.readonly scope."""

    parent_path: str = ""
    """Destination folder inside the virtual filesystem (empty = root)."""

    overwrite: bool = False
    """If True, replace an existing file with the same name at parent_path."""

    is_folder: bool = False
    """If True, file_id points to a Drive folder — recursively import all files inside."""


class DriveImportFolderResult(BaseModel):
    """Response for a folder import (many files)."""
    folder_name: str
    imported: int
    skipped: int
    errors: list[str]


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_path(parent: str, name: str) -> str:
    return f"{parent}/{name}" if parent else name


def _to_response(record: FileRecord) -> FileRecordResponse:
    return FileRecordResponse(
        id=str(record.id),
        name=record.name,
        path=record.path,
        parent_path=record.parent_path,
        type=record.type,
        size=record.size,
        mime_type=record.mime_type,
        is_deleted=record.is_deleted,
        deleted_at=record.deleted_at,
        is_starred=record.is_starred,
        created_at=record.created_at,
        updated_at=record.updated_at,
        color=getattr(record, "color", None),
        icon_emoji=getattr(record, "icon_emoji", None),
    )


def _get_record_or_404(file_id: str, current_user: User, session: Session) -> FileRecord:
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record or record.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return record


def _cascade_rename(
    session: Session,
    _owner_id: uuid.UUID,
    old_prefix: str,
    new_prefix: str,
) -> None:
    """Update path / parent_path for all descendants after a rename/move."""
    children = session.exec(
        select(FileRecord).where(
            col(FileRecord.path).startswith(old_prefix + "/"),
        )
    ).all()
    now = _now()
    for child in children:
        child.path = new_prefix + child.path[len(old_prefix):]
        child.parent_path = child.path.rsplit("/", 1)[0] if "/" in child.path else ""
        child.updated_at = now
        session.add(child)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/list", response_model=list[FileRecordResponse])
def list_files(
    path: str = Query(default=""),
    show_trash: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """List files/folders at the given path (non-recursive)."""
    parent = path.strip("/")
    stmt = select(FileRecord).where(
        FileRecord.parent_path == parent,
        FileRecord.is_deleted == show_trash,
    )
    records = session.exec(stmt).all()
    records = sorted(records, key=lambda r: (0 if r.type == "folder" else 1, r.name.lower()))
    return [_to_response(r) for r in records]


@router.post("/upload", response_model=FileRecordResponse)
async def upload_file(
    file: UploadFile,
    path: str = Form(default=""),
    overwrite: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Upload a file to storage and record metadata in the DB.

    - path: destination parent path (e.g. "projects/2026")
    - overwrite: if False and a file with the same name exists, returns 409
    """
    parent = path.strip("/")
    full_path = _build_path(parent, file.filename or "untitled")

    # Conflict check
    existing = session.exec(
        select(FileRecord).where(
            FileRecord.path == full_path,
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).first()

    if existing and not overwrite:
        raise HTTPException(status_code=409, detail="File already exists")

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    file_id = uuid.uuid4()
    r2_key = f"shared/{file_id}"

    # --- Upload to storage and determine real size ---
    size: Optional[int] = file.size  # may be None for streams

    if _use_r2():
        await r2_upload_fileobj(file.file, r2_key, mime)
        # If size was not provided by the client, query R2 for the real byte count.
        if size is None:
            try:
                import logging
                from app.r2 import get_r2_client, get_bucket
                bucket = get_bucket()
                def _head() -> int:
                    client = get_r2_client()
                    resp = client.head_object(Bucket=bucket, Key=r2_key)
                    return int(resp["ContentLength"])
                size = await asyncio.get_running_loop().run_in_executor(None, _head)
            except Exception:
                logging.getLogger(__name__).warning(
                    "Could not determine file size for r2_key=%s; defaulting to 0", r2_key
                )
                size = 0  # safe fallback — quota will be slightly off but not None
    else:
        # Local disk mode: write the stream and count bytes simultaneously.
        disk_path = _local_path(r2_key)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with disk_path.open("wb") as out_fh:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MiB chunks
                if not chunk:
                    break
                out_fh.write(chunk)
                written += len(chunk)
        size = written

    # --- Persist metadata ---
    if existing and overwrite:
        if _use_r2():
            if existing.r2_key and existing.r2_key != r2_key:
                await r2_delete_object(existing.r2_key)
        else:
            if existing.r2_key and existing.r2_key != r2_key:
                old_disk = _local_path(existing.r2_key)
                if old_disk.exists():
                    old_disk.unlink()
        existing.r2_key = r2_key
        existing.mime_type = mime
        existing.size = size
        existing.updated_at = _now()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _to_response(existing)

    record = FileRecord(
        id=file_id,
        owner_id=current_user.id,
        name=file.filename or "untitled",
        path=full_path,
        parent_path=parent,
        type="file",
        size=size,
        mime_type=mime,
        r2_key=r2_key,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    inline: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Download a file: redirect to presigned R2 URL, or stream from local disk."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly; use /zip")

    # Record access log entry
    session.add(FileAccessLog(file_id=record.id, user_id=current_user.id, action="download"))
    session.commit()

    if _use_r2():
        disposition = "inline" if inline else f'attachment; filename="{record.name}"'
        url = await r2_generate_presigned_url(record.r2_key, expires_in=_DOWNLOAD_TTL, disposition=disposition)
        return RedirectResponse(url=url, status_code=302)
    else:
        disk_path = _local_path(record.r2_key)
        if not disk_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        disposition = "inline" if inline else "attachment"
        return FileResponse(
            path=str(disk_path),
            filename=record.name,
            media_type=record.mime_type or "application/octet-stream",
            content_disposition_type=disposition,
        )


@router.get("/preview/{file_id}")
async def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Serve file for in-browser preview: redirect to presigned URL or stream from disk."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Not a file")

    # Log access
    session.add(FileAccessLog(file_id=record.id, user_id=current_user.id, action="view"))
    session.commit()

    if _use_r2():
        url = await r2_generate_presigned_url(record.r2_key, expires_in=_PREVIEW_TTL, disposition="inline")
        return RedirectResponse(url=url, status_code=302)
    else:
        disk_path = _local_path(record.r2_key)
        if not disk_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        return FileResponse(
            path=str(disk_path),
            filename=record.name,
            media_type=record.mime_type or "application/octet-stream",
            content_disposition_type="inline",
        )


@router.get("/preview-url/{file_id}", response_model=PresignedUrlResponse)
async def get_preview_url(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PresignedUrlResponse:
    """Return a JSON object with the preview URL (presigned R2 or local /preview endpoint).

    Clients that cannot handle opaque redirect responses (e.g. next.js server actions
    using redirect:'manual') should call this endpoint instead of /preview/{id}.
    """
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Not a file")

    if _use_r2():
        url = await r2_generate_presigned_url(record.r2_key, expires_in=_PREVIEW_TTL, disposition="inline")
    else:
        # Point the client at the /preview/{id} streaming endpoint.
        base = os.environ.get("BACKEND_URL", "http://localhost:3052")
        url = f"{base}/api/v1/files/preview/{file_id}"
    return PresignedUrlResponse(url=url)


@router.get("/download-url/{file_id}", response_model=PresignedUrlResponse)
async def get_download_url(
    file_id: str,
    inline: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PresignedUrlResponse:
    """Return a JSON object with the download URL (presigned R2 or local /download endpoint).

    Clients that cannot handle opaque redirect responses should call this endpoint
    instead of /download/{id}.
    """
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly; use /zip")

    if _use_r2():
        disposition = "inline" if inline else f'attachment; filename="{record.name}"'
        url = await r2_generate_presigned_url(record.r2_key, expires_in=_DOWNLOAD_TTL, disposition=disposition)
    else:
        base = os.environ.get("BACKEND_URL", "http://localhost:3052")
        url = f"{base}/api/v1/files/download/{file_id}{'?inline=true' if inline else ''}"
    return PresignedUrlResponse(url=url)


@router.post("/folder", response_model=FileRecordResponse)
def create_folder(
    body: FolderCreateBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Create a virtual folder (DB record only — storage has no folder objects)."""
    parent = body.parent_path.strip("/")
    full_path = _build_path(parent, body.name)

    existing = session.exec(
        select(FileRecord).where(
            FileRecord.path == full_path,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Folder already exists")

    record = FileRecord(
        owner_id=current_user.id,
        name=body.name,
        path=full_path,
        parent_path=parent,
        type="folder",
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.patch("/rename/{file_id}", response_model=FileRecordResponse)
def rename_file(
    file_id: str,
    body: RenameBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Rename a file or folder."""
    record = _get_record_or_404(file_id, current_user, session)
    old_prefix = record.path
    new_path = _build_path(record.parent_path, body.name)

    conflict = session.exec(
        select(FileRecord).where(
            FileRecord.path == new_path,
            FileRecord.id != record.id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="A file with that name already exists")

    record.name = body.name
    record.path = new_path
    record.updated_at = _now()
    session.add(record)

    if record.type == "folder":
        _cascade_rename(session, current_user.id, old_prefix, new_path)

    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.post("/move/{file_id}", response_model=FileRecordResponse)
def move_file(
    file_id: str,
    body: MoveBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Move a file or folder to a new parent path."""
    record = _get_record_or_404(file_id, current_user, session)
    old_prefix = record.path
    dest_parent = body.dest_parent.strip("/")
    new_path = _build_path(dest_parent, record.name)

    conflict = session.exec(
        select(FileRecord).where(
            FileRecord.path == new_path,
            FileRecord.id != record.id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="A file with that name already exists in the destination")

    record.path = new_path
    record.parent_path = dest_parent
    now = _now()
    record.updated_at = now
    session.add(record)

    if record.type == "folder":
        _cascade_rename(session, current_user.id, old_prefix, new_path)
        children = session.exec(
            select(FileRecord).where(
                col(FileRecord.path).startswith(new_path + "/"),
            )
        ).all()
        for child in children:
            child.updated_at = now
            session.add(child)

    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.post("/copy/{file_id}", response_model=FileRecordResponse)
async def copy_file(
    file_id: str,
    body: CopyBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Copy a file to a new location (folders not supported for now)."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder":
        raise HTTPException(status_code=400, detail="Folder copy not supported yet; copy files individually")

    dest_parent = body.dest_parent.strip("/")
    dest_path = _build_path(dest_parent, record.name)

    conflict = session.exec(
        select(FileRecord).where(
            FileRecord.path == dest_path,
        )
    ).first()
    if conflict:
        name_parts = record.name.rsplit(".", 1)
        if len(name_parts) == 2:
            copy_name = f"{name_parts[0]} (copy).{name_parts[1]}"
        else:
            copy_name = f"{record.name} (copy)"
        dest_path = _build_path(dest_parent, copy_name)

    new_id = uuid.uuid4()
    new_r2_key = f"shared/{new_id}"

    if _use_r2():
        if record.r2_key:
            await r2_copy_object(record.r2_key, new_r2_key)
    else:
        if record.r2_key:
            src = _local_path(record.r2_key)
            dst = _local_path(new_r2_key)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    new_record = FileRecord(
        id=new_id,
        owner_id=current_user.id,
        name=dest_path.rsplit("/", 1)[-1],
        path=dest_path,
        parent_path=dest_parent,
        type=record.type,
        size=record.size,
        mime_type=record.mime_type,
        r2_key=new_r2_key if record.r2_key else None,
    )
    session.add(new_record)
    session.commit()
    session.refresh(new_record)
    return _to_response(new_record)


@router.delete("/trash/{file_id}", response_model=FileRecordResponse)
def trash_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Soft-delete a file/folder (move to trash)."""
    record = _get_record_or_404(file_id, current_user, session)
    now = _now()
    record.is_deleted = True
    record.deleted_at = now
    record.updated_at = now

    if record.type == "folder":
        children = session.exec(
            select(FileRecord).where(
                col(FileRecord.path).startswith(record.path + "/"),
            )
        ).all()
        for child in children:
            child.is_deleted = True
            child.deleted_at = now
            child.updated_at = now
            session.add(child)

    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.post("/restore/{file_id}", response_model=FileRecordResponse)
def restore_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Restore a file/folder from trash."""
    record = _get_record_or_404(file_id, current_user, session)
    record.is_deleted = False
    record.deleted_at = None
    record.updated_at = _now()
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.delete("/permanent/{file_id}")
async def delete_permanent(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Permanently delete a file: removes from storage and DB."""
    record = _get_record_or_404(file_id, current_user, session)

    r2_keys: list[str] = []
    disk_paths: list[Path] = []

    if record.r2_key:
        r2_keys.append(record.r2_key)
        disk_paths.append(_local_path(record.r2_key))

    if record.type == "folder":
        children = session.exec(
            select(FileRecord).where(
                col(FileRecord.path).startswith(record.path + "/"),
            )
        ).all()
        for child in children:
            if child.r2_key:
                r2_keys.append(child.r2_key)
                disk_paths.append(_local_path(child.r2_key))
            session.delete(child)

    session.delete(record)
    session.commit()

    if _use_r2():
        await r2_delete_objects(r2_keys)
    else:
        for p in disk_paths:
            if p.exists():
                p.unlink()

    return {"deleted": True}


@router.delete("/empty-trash")
async def empty_trash(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Permanently delete all trashed files for the current user."""
    trashed = session.exec(
        select(FileRecord).where(
            FileRecord.is_deleted == True,  # noqa: E712
        )
    ).all()

    r2_keys = [r.r2_key for r in trashed if r.r2_key]
    disk_paths = [_local_path(k) for k in r2_keys]

    for record in trashed:
        session.delete(record)
    session.commit()

    if _use_r2():
        await r2_delete_objects(r2_keys)
    else:
        for p in disk_paths:
            if p.exists():
                p.unlink()

    return {"deleted_count": len(trashed)}


@router.get("/quota", response_model=QuotaResponse)
def get_quota(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuotaResponse:
    """Return total used bytes and file count for the current user (excluding trash)."""
    result = session.exec(
        select(
            func.coalesce(func.sum(FileRecord.size), 0),
            func.count(FileRecord.id),
        ).where(
            FileRecord.is_deleted == False,  # noqa: E712
            FileRecord.type == "file",
        )
    ).one()
    used_bytes, file_count = result
    return QuotaResponse(used_bytes=int(used_bytes), file_count=int(file_count))


@router.post("/zip")
async def download_zip(
    body: ZipBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Download multiple files as a ZIP archive.

    Uses a SpooledTemporaryFile (spills to disk beyond 64 MiB) to avoid
    holding the entire ZIP in memory at once. Files are added one at a time
    so peak memory stays close to the size of the largest single file.
    """
    records: list[FileRecord] = []
    for fid in body.ids:
        try:
            uid = uuid.UUID(fid)
        except ValueError:
            continue
        record = session.get(FileRecord, uid)
        if record and not record.is_deleted:
            records.append(record)

    if not records:
        raise HTTPException(status_code=400, detail="No valid files selected")

    async def _generate():
        # SpooledTemporaryFile spills to disk once the in-memory buffer exceeds
        # max_size, capping RAM usage regardless of the number of selected files.
        spool = tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024)
        with zipfile.ZipFile(spool, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for record in records:
                if record.type == "folder" or not record.r2_key:
                    continue
                if _use_r2():
                    data = await r2_get_object_bytes(record.r2_key)
                else:
                    disk_path = _local_path(record.r2_key)
                    if not disk_path.exists():
                        continue
                    data = disk_path.read_bytes()
                zf.writestr(record.path, data)
        spool.seek(0)
        while True:
            chunk = spool.read(1024 * 1024)
            if not chunk:
                break
            yield chunk
        spool.close()

    return StreamingResponse(
        _generate(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


_MIME_CATEGORIES: dict[str, list[str]] = {
    "image": ["image/"],
    "video": ["video/"],
    "audio": ["audio/"],
    "document": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml",
        "text/plain",
    ],
    "spreadsheet": [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml",
        "text/csv",
    ],
    "code": [
        "text/javascript",
        "text/typescript",
        "text/html",
        "text/css",
        "application/json",
        "text/x-python",
    ],
    "archive": [
        "application/zip",
        "application/x-rar",
        "application/x-7z",
        "application/gzip",
        "application/x-tar",
    ],
}


@router.get("/search", response_model=list[FileRecordResponse])
def search_files(
    q: str = Query(default=""),
    path: str = Query(default=""),
    type: Optional[str] = Query(default=None),
    mime_category: Optional[str] = Query(default=None),
    min_size: Optional[int] = Query(default=None),
    max_size: Optional[int] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    is_starred: Optional[bool] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """Search files by name (case-insensitive) within an optional path prefix, with optional filters."""
    from sqlalchemy import or_

    stmt = select(FileRecord).where(
        FileRecord.is_deleted == False,  # noqa: E712
    )

    if q:
        stmt = stmt.where(col(FileRecord.name).ilike(f"%{q}%"))

    if path:
        clean_path = path.strip("/")
        stmt = stmt.where(
            col(FileRecord.path).startswith(clean_path + "/")
            | (FileRecord.path == clean_path)
        )

    if type == "file":
        stmt = stmt.where(FileRecord.type == "file")
    elif type == "folder":
        stmt = stmt.where(FileRecord.type == "folder")

    if mime_category and mime_category in _MIME_CATEGORIES:
        prefixes = _MIME_CATEGORIES[mime_category]
        mime_conditions = [col(FileRecord.mime_type).startswith(p) for p in prefixes]
        stmt = stmt.where(or_(*mime_conditions))

    if min_size is not None:
        stmt = stmt.where(FileRecord.size >= min_size)

    if max_size is not None:
        stmt = stmt.where(FileRecord.size <= max_size)

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            stmt = stmt.where(FileRecord.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            stmt = stmt.where(FileRecord.created_at <= dt_to)
        except ValueError:
            pass

    if is_starred is not None:
        stmt = stmt.where(FileRecord.is_starred == is_starred)

    records = session.exec(stmt).all()
    records = sorted(records, key=lambda r: (0 if r.type == "folder" else 1, r.name.lower()))
    return [_to_response(r) for r in records]


class CustomizeBody(BaseModel):
    color: Optional[str] = None
    icon_emoji: Optional[str] = None


@router.patch("/customize/{file_id}", response_model=FileRecordResponse)
def customize_file(
    file_id: str,
    body: CustomizeBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Set color and/or icon_emoji on any file or folder."""
    record = _get_record_or_404(file_id, current_user, session)
    if body.color is not None:
        record.color = body.color if body.color != "" else None  # type: ignore[assignment]
    if body.icon_emoji is not None:
        record.icon_emoji = body.icon_emoji if body.icon_emoji != "" else None  # type: ignore[assignment]
    record.updated_at = _now()
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)

# ── Starred ────────────────────────────────────────────────────────────────

@router.post("/star/{file_id}", response_model=FileRecordResponse)
def toggle_star(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Toggle is_starred on a file or folder."""
    record = _get_record_or_404(file_id, current_user, session)
    record.is_starred = not record.is_starred  # type: ignore[assignment]
    record.updated_at = _now()
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.get("/starred", response_model=list[FileRecordResponse])
def list_starred(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return all starred (non-deleted) files."""
    records = session.exec(
        select(FileRecord).where(
            FileRecord.is_starred == True,  # noqa: E712
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).all()
    return [_to_response(r) for r in records]


# ── Recent ─────────────────────────────────────────────────────────────────

@router.get("/recent", response_model=list[FileRecordResponse])
def list_recent(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return recently accessed files, most recent first."""
    subq = (
        select(FileAccessLog.file_id, func.max(FileAccessLog.accessed_at).label("last_access"))
        .where(FileAccessLog.user_id == current_user.id)
        .group_by(FileAccessLog.file_id)
        .subquery()
    )
    records = session.exec(
        select(FileRecord)
        .join(subq, FileRecord.id == subq.c.file_id)
        .where(
            FileRecord.is_deleted == False,  # noqa: E712
        )
        .order_by(col(subq.c.last_access).desc())
        .limit(limit)
    ).all()
    return [_to_response(r) for r in records]


# ── Sharing ────────────────────────────────────────────────────────────────

def _share_to_response(share: FileShare) -> ShareResponse:
    return ShareResponse(
        id=str(share.id),
        file_id=str(share.file_id),
        owner_id=str(share.owner_id),
        shared_with_user_id=str(share.shared_with_user_id) if share.shared_with_user_id else None,
        share_token=share.share_token,
        permission_level=share.permission_level,
        expires_at=share.expires_at,
        created_at=share.created_at,
    )


@router.post("/share/{file_id}", response_model=ShareResponse)
def create_share(
    file_id: str,
    body: ShareCreateBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    record = _get_record_or_404(file_id, current_user, session)
    share = FileShare(
        file_id=record.id,
        owner_id=current_user.id,
        shared_with_user_id=uuid.UUID(body.shared_with_user_id) if body.shared_with_user_id else None,
        permission_level=body.permission_level,
        expires_at=body.expires_at,
    )
    session.add(share)
    session.commit()
    session.refresh(share)
    return _share_to_response(share)


@router.get("/share/{file_id}", response_model=list[ShareResponse])
def list_shares(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    record = _get_record_or_404(file_id, current_user, session)
    shares = session.exec(select(FileShare).where(FileShare.file_id == record.id)).all()
    return [_share_to_response(s) for s in shares]


@router.delete("/share/{share_id}", status_code=204)
def delete_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    share = session.get(FileShare, uuid.UUID(share_id))
    if not share or share.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")
    session.delete(share)
    session.commit()


@router.post("/share/{file_id}/link", response_model=dict)
def create_share_link(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    record = _get_record_or_404(file_id, current_user, session)
    token = secrets.token_urlsafe(32)
    share = FileShare(
        file_id=record.id,
        owner_id=current_user.id,
        share_token=token,
        permission_level="view",
    )
    session.add(share)
    session.commit()
    return {"token": token, "url": f"/files/public/{token}"}


@router.get("/public/{token}", response_model=FileRecordResponse)
def get_public_file(
    token: str,
    session: Session = Depends(get_session),
):
    share = session.exec(select(FileShare).where(FileShare.share_token == token)).first()
    if not share:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    if share.expires_at and share.expires_at < _now():
        raise HTTPException(status_code=410, detail="Link expired")
    record = session.get(FileRecord, share.file_id)
    if not record or record.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return _to_response(record)


# ── Bulk Operations ────────────────────────────────────────────────────────

@router.post("/bulk-move", response_model=BulkResult)
def bulk_move(
    body: BulkMoveBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    succeeded, failed = [], []
    for fid in body.ids:
        try:
            record = _get_record_or_404(fid, current_user, session)
            new_path = _build_path(body.dest_parent, record.name)
            record.path = new_path  # type: ignore[assignment]
            record.parent_path = body.dest_parent  # type: ignore[assignment]
            record.updated_at = _now()
            session.add(record)
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


@router.post("/bulk-copy", response_model=BulkResult)
async def bulk_copy(
    body: BulkCopyBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    succeeded, failed = [], []
    for fid in body.ids:
        try:
            record = _get_record_or_404(fid, current_user, session)
            new_name = record.name
            new_path = _build_path(body.dest_parent, new_name)
            new_id = uuid.uuid4()
            new_r2_key = f"shared/{new_id}"
            if record.r2_key and record.type == "file":
                if _use_r2():
                    await r2_copy_object(record.r2_key, new_r2_key)
                else:
                    src = _local_path(record.r2_key)
                    dst = _local_path(new_r2_key)
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    import shutil as _shutil
                    _shutil.copy2(src, dst)
            else:
                new_r2_key = None
            new_record = FileRecord(
                id=new_id,
                owner_id=current_user.id,
                name=new_name,
                path=new_path,
                parent_path=body.dest_parent,
                type=record.type,
                size=record.size,
                mime_type=record.mime_type,
                r2_key=new_r2_key,
            )
            session.add(new_record)
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


@router.delete("/bulk-trash", response_model=BulkResult)
def bulk_trash(
    body: BulkTrashBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    succeeded, failed = [], []
    now = _now()
    for fid in body.ids:
        try:
            record = _get_record_or_404(fid, current_user, session)
            record.is_deleted = True  # type: ignore[assignment]
            record.deleted_at = now  # type: ignore[assignment]
            record.updated_at = now
            session.add(record)
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    session.commit()
    return BulkResult(succeeded=succeeded, failed=failed)


# ---------------------------------------------------------------------------
# Google Drive import
# ---------------------------------------------------------------------------

@router.post("/import-from-drive")
async def import_from_drive(
    body: DriveImportBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse | DriveImportFolderResult:
    """Import a file or folder from Google Drive into R2 (or local disk) storage.

    Single file flow:
    1. Resolve Drive file metadata (name, MIME type, size).
    2. Conflict check — return 409 unless overwrite=True.
    3. Stream file bytes (Workspace docs exported to Office format).
    4. Upload to R2 / local disk.
    5. Persist FileRecord.

    Folder flow (is_folder=True):
    1. Recursively list all files inside the Drive folder.
    2. For each file: download + upload + persist (same as single file).
    3. Return DriveImportFolderResult with counts.

    The access_token is used only during this request and is never stored.
    """
    import logging
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    _log = logging.getLogger(__name__)

    # ── FOLDER BRANCH ────────────────────────────────────────────────────────
    if body.is_folder:
        # Get folder name first
        try:
            folder_info = await get_drive_file_info(body.access_token, body.file_id)
        except Exception as exc:
            _log.error("Drive folder metadata failed: %s", exc)
            raise HTTPException(status_code=502, detail="Failed to fetch folder metadata from Google Drive")

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)

        # Ensure folder record exists in DB
        existing_folder = session.exec(
            select(FileRecord).where(FileRecord.path == folder_dest, FileRecord.is_deleted == False)  # noqa: E712
        ).first()
        if not existing_folder:
            folder_record = FileRecord(
                id=uuid.uuid4(),
                owner_id=current_user.id,
                name=folder_info.name,
                path=folder_dest,
                parent_path=parent,
                type="folder",
                size=0,
            )
            session.add(folder_record)
            session.commit()

        # Recursively list all files
        try:
            drive_files = await list_drive_folder(body.access_token, body.file_id)
        except Exception as exc:
            _log.error("Drive folder listing failed: %s", exc)
            raise HTTPException(status_code=502, detail="Failed to list Google Drive folder contents")

        imported = 0
        skipped = 0
        errors: list[str] = []

        for file_info, rel_path in drive_files:
            dest_path = _build_path(folder_dest, rel_path)
            dest_parent = str(Path(dest_path).parent) if "/" in dest_path else folder_dest

            # Ensure intermediate folders exist
            parts = rel_path.split("/")
            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    existing_sub = session.exec(
                        select(FileRecord).where(FileRecord.path == cumulative, FileRecord.is_deleted == False)  # noqa: E712
                    ).first()
                    if not existing_sub:
                        sub_folder = FileRecord(
                            id=uuid.uuid4(),
                            owner_id=current_user.id,
                            name=part,
                            path=cumulative,
                            parent_path=str(Path(cumulative).parent) if "/" in cumulative else folder_dest,
                            type="folder",
                            size=0,
                        )
                        session.add(sub_folder)
                        session.commit()

            # Skip if already exists and not overwriting
            existing_file = session.exec(
                select(FileRecord).where(FileRecord.path == dest_path, FileRecord.is_deleted == False)  # noqa: E712
            ).first()
            if existing_file and not body.overwrite:
                skipped += 1
                continue

            try:
                buf, actual_size = await download_drive_file(body.access_token, file_info.file_id, file_info.original_mime)
            except Exception as exc:
                _log.warning("Drive file download failed: %s %s", file_info.name, exc)
                errors.append(file_info.name)
                continue

            new_id = uuid.uuid4()
            r2_key = f"shared/{new_id}"
            try:
                if _use_r2():
                    await r2_upload_fileobj(buf, r2_key, file_info.mime_type)
                else:
                    disk_path = _local_path(r2_key)
                    disk_path.parent.mkdir(parents=True, exist_ok=True)
                    disk_path.write_bytes(buf.read())
            except Exception as exc:
                _log.warning("Drive file upload failed: %s %s", file_info.name, exc)
                errors.append(file_info.name)
                continue

            if existing_file and body.overwrite:
                existing_file.r2_key = r2_key
                existing_file.mime_type = file_info.mime_type
                existing_file.size = actual_size
                existing_file.updated_at = _now()
                session.add(existing_file)
            else:
                file_name = parts[-1]
                record = FileRecord(
                    id=new_id,
                    owner_id=current_user.id,
                    name=file_name,
                    path=dest_path,
                    parent_path=dest_parent,
                    type="file",
                    size=actual_size,
                    mime_type=file_info.mime_type,
                    r2_key=r2_key,
                )
                session.add(record)
            session.commit()
            imported += 1

        _log.info(
            "Drive folder import complete: user=%s folder=%r imported=%d skipped=%d errors=%d",
            current_user.id, folder_info.name, imported, skipped, len(errors),
        )
        return DriveImportFolderResult(
            folder_name=folder_info.name,
            imported=imported,
            skipped=skipped,
            errors=errors,
        )

    # ── SINGLE FILE BRANCH ───────────────────────────────────────────────────
    # ── 1. Resolve metadata ──────────────────────────────────────────────────
    try:
        info = await get_drive_file_info(body.access_token, body.file_id)
    except Exception as exc:
        _log.error("Drive metadata fetch failed for file_id=%s: %s", body.file_id, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch file metadata from Google Drive")

    parent = body.parent_path.strip("/")
    full_path = _build_path(parent, info.name)

    # ── 2. Conflict check ────────────────────────────────────────────────────
    existing = session.exec(
        select(FileRecord).where(
            FileRecord.path == full_path,
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).first()

    if existing and not body.overwrite:
        raise HTTPException(
            status_code=409,
            detail=f"A file named '{info.name}' already exists at this location. "
                   "Set overwrite=true to replace it.",
        )

    # ── 3. Download from Drive ───────────────────────────────────────────────
    # Pass the *original* Drive mimeType so the helper branches correctly
    # between get_media (binary) and export_media (Google Workspace docs).
    try:
        buf, actual_size = await download_drive_file(
            body.access_token, body.file_id, info.original_mime
        )
    except Exception as exc:
        _log.error("Drive download failed for file_id=%s: %s", body.file_id, exc)
        raise HTTPException(status_code=502, detail="Failed to download file from Google Drive")

    # ── 4. Upload to storage ─────────────────────────────────────────────────
    new_id = uuid.uuid4()
    r2_key = f"shared/{new_id}"

    if _use_r2():
        await r2_upload_fileobj(buf, r2_key, info.mime_type)
    else:
        disk_path = _local_path(r2_key)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        disk_path.write_bytes(buf.read())

    # ── 5. Persist metadata ──────────────────────────────────────────────────
    if existing and body.overwrite:
        # Remove old bytes from storage before replacing the record
        if existing.r2_key and existing.r2_key != r2_key:
            if _use_r2():
                await r2_delete_object(existing.r2_key)
            else:
                old_disk = _local_path(existing.r2_key)
                if old_disk.exists():
                    old_disk.unlink()
        existing.r2_key = r2_key
        existing.mime_type = info.mime_type
        existing.size = actual_size
        existing.updated_at = _now()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _to_response(existing)

    record = FileRecord(
        id=new_id,
        owner_id=current_user.id,
        name=info.name,
        path=full_path,
        parent_path=parent,
        type="file",
        size=actual_size,
        mime_type=info.mime_type,
        r2_key=r2_key,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    _log.info(
        "Drive import complete: user=%s drive_file_id=%s name=%r size=%d",
        current_user.id, body.file_id, info.name, actual_size,
    )
    return _to_response(record)


# ---------------------------------------------------------------------------
# SSE folder import — streams progress events to the client
# ---------------------------------------------------------------------------

class DriveFolderImportBody(BaseModel):
    folder_id: str
    access_token: str
    parent_path: str = ""
    overwrite: bool = False


@router.post("/import-folder-stream")
async def import_folder_stream(
    body: DriveFolderImportBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Stream Server-Sent Events while importing a Drive folder.

    Each event is a JSON line:
      data: {"type": "start",    "total": N, "folder": "name"}
      data: {"type": "progress", "done": N, "total": M, "name": "file.txt"}
      data: {"type": "done",     "imported": N, "skipped": S, "errors": [...]}
      data: {"type": "error",    "message": "..."}
    """
    import json as _json
    from app.google_drive import download_drive_file, get_drive_file_info, list_drive_folder

    _log = logging.getLogger(__name__)

    async def event_stream():
        # 1. Folder metadata
        try:
            folder_info = await get_drive_file_info(body.access_token, body.folder_id)
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        parent = body.parent_path.strip("/")
        folder_dest = _build_path(parent, folder_info.name)

        # Ensure top-level folder record exists
        existing_folder = session.exec(
            select(FileRecord).where(FileRecord.path == folder_dest, FileRecord.is_deleted == False)  # noqa: E712
        ).first()
        if not existing_folder:
            folder_record = FileRecord(
                id=uuid.uuid4(),
                owner_id=current_user.id,
                name=folder_info.name,
                path=folder_dest,
                parent_path=parent,
                type="folder",
                size=0,
            )
            session.add(folder_record)
            session.commit()

        # 2. List all files recursively
        try:
            drive_files = await list_drive_folder(body.access_token, body.folder_id)
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        total = len(drive_files)
        yield f"data: {_json.dumps({'type': 'start', 'total': total, 'folder': folder_info.name})}\n\n"

        imported = 0
        skipped = 0
        errors: list[str] = []

        for idx, (file_info, rel_path) in enumerate(drive_files):
            dest_path = _build_path(folder_dest, rel_path)
            parts = rel_path.split("/")
            dest_parent = _build_path(folder_dest, "/".join(parts[:-1])) if len(parts) > 1 else folder_dest

            # Ensure intermediate sub-folders
            if len(parts) > 1:
                cumulative = folder_dest
                for part in parts[:-1]:
                    cumulative = _build_path(cumulative, part)
                    existing_sub = session.exec(
                        select(FileRecord).where(FileRecord.path == cumulative, FileRecord.is_deleted == False)  # noqa: E712
                    ).first()
                    if not existing_sub:
                        sub_folder = FileRecord(
                            id=uuid.uuid4(),
                            owner_id=current_user.id,
                            name=part,
                            path=cumulative,
                            parent_path=str(Path(cumulative).parent) if "/" in cumulative else folder_dest,
                            type="folder",
                            size=0,
                        )
                        session.add(sub_folder)
                        session.commit()

            # Conflict check
            existing_file = session.exec(
                select(FileRecord).where(FileRecord.path == dest_path, FileRecord.is_deleted == False)  # noqa: E712
            ).first()
            if existing_file and not body.overwrite:
                skipped += 1
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx + 1, 'total': total, 'name': file_info.name, 'skipped': True})}\n\n"
                continue

            # Download from Drive
            try:
                buf, actual_size = await download_drive_file(body.access_token, file_info.file_id, file_info.original_mime)
            except Exception as exc:
                _log.warning("Drive file download failed: %s %s", file_info.name, exc)
                errors.append(file_info.name)
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx + 1, 'total': total, 'name': file_info.name, 'error': True})}\n\n"
                continue

            # Upload to storage
            new_id = uuid.uuid4()
            r2_key = f"shared/{new_id}"
            try:
                if _use_r2():
                    await r2_upload_fileobj(buf, r2_key, file_info.mime_type)
                else:
                    disk_path = _local_path(r2_key)
                    disk_path.parent.mkdir(parents=True, exist_ok=True)
                    disk_path.write_bytes(buf.read())
            except Exception as exc:
                _log.warning("Drive file upload failed: %s %s", file_info.name, exc)
                errors.append(file_info.name)
                yield f"data: {_json.dumps({'type': 'progress', 'done': idx + 1, 'total': total, 'name': file_info.name, 'error': True})}\n\n"
                continue

            # Persist DB record
            if existing_file and body.overwrite:
                existing_file.r2_key = r2_key
                existing_file.mime_type = file_info.mime_type
                existing_file.size = actual_size
                existing_file.updated_at = _now()
                session.add(existing_file)
            else:
                session.add(FileRecord(
                    id=new_id,
                    owner_id=current_user.id,
                    name=parts[-1],
                    path=dest_path,
                    parent_path=dest_parent,
                    type="file",
                    size=actual_size,
                    mime_type=file_info.mime_type,
                    r2_key=r2_key,
                ))
            session.commit()
            imported += 1

            yield f"data: {_json.dumps({'type': 'progress', 'done': idx + 1, 'total': total, 'name': file_info.name})}\n\n"

        yield f"data: {_json.dumps({'type': 'done', 'imported': imported, 'skipped': skipped, 'errors': errors})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
