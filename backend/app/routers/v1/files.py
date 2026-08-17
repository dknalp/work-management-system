"""Cloudflare R2-backed file management API.

All routes live under /api/v1/files (prefix set in main.py).
Auth: every route requires a valid JWT via get_current_user.
Storage: file bytes in R2, metadata in PostgreSQL (FileRecord).
"""

import io
import mimetypes
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, col, func, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileRecord, User
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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuotaResponse(BaseModel):
    used_bytes: int
    file_count: int


class FolderCreateBody(BaseModel):
    parent_path: str = ""
    name: str


class RenameBody(BaseModel):
    new_name: str


class MoveBody(BaseModel):
    new_parent: str


class CopyBody(BaseModel):
    dest_parent: str


class ZipBody(BaseModel):
    ids: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_path(parent: str, name: str) -> str:
    """Combine parent_path and name into a full virtual path."""
    parent = parent.strip("/")
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
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _get_record_or_404(file_id: str, user: User, session: Session) -> FileRecord:
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record or record.owner_id != user.id:
        raise HTTPException(status_code=404, detail="File not found")
    return record


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
    """List files/folders at a given virtual path.

    - path="" returns root items
    - show_trash=true returns only deleted items (trash view)
    """
    path = path.strip("/")
    stmt = select(FileRecord).where(
        FileRecord.owner_id == current_user.id,
        FileRecord.parent_path == path,
        FileRecord.is_deleted == show_trash,
    )
    records = session.exec(stmt).all()
    # Sort: folders first, then alphabetical
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
    """Upload a file to R2 and record metadata in the DB.

    - path: destination parent path (e.g. "projects/2026")
    - overwrite: if False and a file with the same name exists, returns 409
    """
    parent = path.strip("/")
    full_path = _build_path(parent, file.filename or "untitled")

    # Conflict check
    existing = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == current_user.id,
            FileRecord.path == full_path,
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).first()

    if existing and not overwrite:
        raise HTTPException(status_code=409, detail="File already exists")

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    file_id = uuid.uuid4()
    r2_key = f"{current_user.id}/{file_id}"

    # Stream to R2
    await r2_upload_fileobj(file.file, r2_key, mime)

    # Read size (file.size may be None for streams)
    size: Optional[int] = file.size
    if size is None:
        # Size not provided; we can't re-read the stream, leave as None
        pass

    if existing and overwrite:
        # Delete old R2 object if key differs
        if existing.r2_key and existing.r2_key != r2_key:
            await r2_delete_object(existing.r2_key)
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
) -> RedirectResponse:
    """Redirect to a presigned R2 URL for downloading a file."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly; use /zip")

    disposition = "inline" if inline else f'attachment; filename="{record.name}"'
    url = await r2_generate_presigned_url(record.r2_key, expires_in=_DOWNLOAD_TTL, disposition=disposition)
    return RedirectResponse(url=url, status_code=302)


@router.get("/preview/{file_id}")
async def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Redirect to a short-lived presigned URL for in-browser preview."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Not a file")

    url = await r2_generate_presigned_url(record.r2_key, expires_in=_PREVIEW_TTL, disposition="inline")
    return RedirectResponse(url=url, status_code=302)


@router.post("/folder", response_model=FileRecordResponse)
def create_folder(
    body: FolderCreateBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Create a virtual folder (DB record only — R2 has no folder objects)."""
    parent = body.parent_path.strip("/")
    full_path = _build_path(parent, body.name)

    existing = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == current_user.id,
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
    """Rename a file or folder. Updates path in DB; R2 key is unchanged."""
    record = _get_record_or_404(file_id, current_user, session)
    new_path = _build_path(record.parent_path, body.new_name)

    # Conflict check
    conflict = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == current_user.id,
            FileRecord.path == new_path,
            FileRecord.id != record.id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Name already taken")

    old_path = record.path
    record.name = body.new_name
    record.path = new_path
    record.updated_at = _now()
    session.add(record)

    # If renaming a folder, cascade-update all children
    if record.type == "folder":
        _cascade_rename(session, current_user.id, old_path, new_path)

    session.commit()
    session.refresh(record)
    return _to_response(record)


def _cascade_rename(session: Session, owner_id: uuid.UUID, old_prefix: str, new_prefix: str) -> None:
    """Update path/parent_path for all descendants after a folder rename."""
    children = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == owner_id,
            col(FileRecord.path).startswith(old_prefix + "/"),
        )
    ).all()
    for child in children:
        child.path = new_prefix + child.path[len(old_prefix):]
        child.parent_path = new_prefix + child.parent_path[len(old_prefix):]
        child.updated_at = _now()
        session.add(child)


@router.post("/move/{file_id}", response_model=FileRecordResponse)
def move_file(
    file_id: str,
    body: MoveBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Move a file/folder to a new parent path. R2 key is unchanged."""
    record = _get_record_or_404(file_id, current_user, session)
    new_parent = body.new_parent.strip("/")
    new_path = _build_path(new_parent, record.name)

    conflict = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == current_user.id,
            FileRecord.path == new_path,
            FileRecord.id != record.id,
        )
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="A file with that name already exists at the destination")

    old_path = record.path
    old_prefix = old_path  # used for folder cascade

    record.parent_path = new_parent
    record.path = new_path
    record.updated_at = _now()
    session.add(record)

    if record.type == "folder":
        _cascade_rename(session, current_user.id, old_prefix, new_path)

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
            FileRecord.owner_id == current_user.id,
            FileRecord.path == dest_path,
        )
    ).first()
    if conflict:
        # Append " (copy)" to name
        name_parts = record.name.rsplit(".", 1)
        if len(name_parts) == 2:
            copy_name = f"{name_parts[0]} (copy).{name_parts[1]}"
        else:
            copy_name = f"{record.name} (copy)"
        dest_path = _build_path(dest_parent, copy_name)

    new_id = uuid.uuid4()
    new_r2_key = f"{current_user.id}/{new_id}"

    if record.r2_key:
        await r2_copy_object(record.r2_key, new_r2_key)

    new_record = FileRecord(
        id=new_id,
        owner_id=current_user.id,
        name=dest_path.rsplit("/", 1)[-1],
        path=dest_path,
        parent_path=dest_parent,
        type="file",
        size=record.size,
        mime_type=record.mime_type,
        r2_key=new_r2_key,
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
    """Soft-delete: move to trash (is_deleted=True)."""
    record = _get_record_or_404(file_id, current_user, session)
    now = _now()
    record.is_deleted = True
    record.deleted_at = now
    record.updated_at = now
    session.add(record)

    # Also trash all descendants if it's a folder
    if record.type == "folder":
        children = session.exec(
            select(FileRecord).where(
                FileRecord.owner_id == current_user.id,
                col(FileRecord.path).startswith(record.path + "/"),
                FileRecord.is_deleted == False,  # noqa: E712
            )
        ).all()
        for child in children:
            child.is_deleted = True
            child.deleted_at = now
            child.updated_at = now
            session.add(child)

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
    """Permanently delete a file: removes from R2 and DB."""
    record = _get_record_or_404(file_id, current_user, session)

    r2_keys: list[str] = []
    if record.r2_key:
        r2_keys.append(record.r2_key)

    # Gather children if folder
    if record.type == "folder":
        children = session.exec(
            select(FileRecord).where(
                FileRecord.owner_id == current_user.id,
                col(FileRecord.path).startswith(record.path + "/"),
            )
        ).all()
        for child in children:
            if child.r2_key:
                r2_keys.append(child.r2_key)
            session.delete(child)

    session.delete(record)
    session.commit()

    # Delete from R2 after DB commit
    await r2_delete_objects(r2_keys)

    return {"deleted": True}


@router.delete("/empty-trash")
async def empty_trash(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Permanently delete all trashed files for the current user."""
    trashed = session.exec(
        select(FileRecord).where(
            FileRecord.owner_id == current_user.id,
            FileRecord.is_deleted == True,  # noqa: E712
        )
    ).all()

    r2_keys = [r.r2_key for r in trashed if r.r2_key]
    for record in trashed:
        session.delete(record)
    session.commit()

    await r2_delete_objects(r2_keys)

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
            FileRecord.owner_id == current_user.id,
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
    """Download multiple files as a ZIP archive streamed from R2."""
    records: list[FileRecord] = []
    for fid in body.ids:
        try:
            uid = uuid.UUID(fid)
        except ValueError:
            continue
        record = session.get(FileRecord, uid)
        if record and record.owner_id == current_user.id and not record.is_deleted:
            records.append(record)

    if not records:
        raise HTTPException(status_code=400, detail="No valid files selected")

    async def _generate():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for record in records:
                if record.type == "folder" or not record.r2_key:
                    continue
                data = await r2_get_object_bytes(record.r2_key)
                zf.writestr(record.path, data)
        buf.seek(0)
        yield buf.read()

    return StreamingResponse(
        _generate(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


@router.get("/search", response_model=list[FileRecordResponse])
def search_files(
    q: str = Query(min_length=1),
    path: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """Search files by name (case-insensitive) within an optional path prefix."""
    stmt = select(FileRecord).where(
        FileRecord.owner_id == current_user.id,
        FileRecord.is_deleted == False,  # noqa: E712
        col(FileRecord.name).ilike(f"%{q}%"),
    )
    if path:
        clean_path = path.strip("/")
        stmt = stmt.where(
            col(FileRecord.path).startswith(clean_path + "/")
            | (FileRecord.path == clean_path)
        )
    records = session.exec(stmt).all()
    records = sorted(records, key=lambda r: (0 if r.type == "folder" else 1, r.name.lower()))
    return [_to_response(r) for r in records]