"""Core file CRUD routes: list, upload, download, preview, folder, rename, move, copy."""

import asyncio
import io
import logging
import mimetypes
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileAccessLog, FileRecord, User
from app.r2 import r2_copy_object, r2_generate_presigned_url, r2_upload_fileobj
from app.routers.v1.files_utils import (
    CopyBody,
    FileRecordResponse,
    FolderCreateBody,
    MoveBody,
    RenameBody,
    _build_path,
    _cascade_rename,
    _get_record_or_404,
    _local_path,
    _now,
    _to_response,
    _use_r2,
)

router = APIRouter()
_log = logging.getLogger(__name__)

_PREVIEW_TTL = 300
_DOWNLOAD_TTL = 3600


@router.get("/list", response_model=list[FileRecordResponse])
def list_files(
    path: str = Query(default=""),
    show_trash: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """List files/folders at the given path (non-recursive)."""
    parent = path.strip("/")
    records = session.exec(
        select(FileRecord).where(
            FileRecord.parent_path == parent,
            FileRecord.is_deleted == show_trash,
        )
    ).all()
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
    """Upload a file to storage and record metadata in the DB."""
    parent = path.strip("/")
    full_path = _build_path(parent, file.filename or "untitled")

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
    size: Optional[int] = file.size

    if _use_r2():
        await r2_upload_fileobj(file.file, r2_key, mime)
        if size is None:
            try:
                from app.r2 import get_bucket, get_r2_client
                bucket = get_bucket()
                def _head() -> int:
                    client = get_r2_client()
                    resp = client.head_object(Bucket=bucket, Key=r2_key)
                    return int(resp["ContentLength"])
                size = await asyncio.get_running_loop().run_in_executor(None, _head)
            except Exception:
                _log.warning("Could not determine file size for r2_key=%s", r2_key)
                size = 0
    else:
        disk_path = _local_path(r2_key)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with disk_path.open("wb") as out_fh:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out_fh.write(chunk)
                written += len(chunk)
        if size is None:
            size = written

    if existing and overwrite:
        if _use_r2():
            from app.r2 import r2_delete_object
            if existing.r2_key and existing.r2_key != r2_key:
                await r2_delete_object(existing.r2_key)
        else:
            if existing.r2_key and existing.r2_key != r2_key:
                old_disk = _local_path(existing.r2_key)
                if old_disk.exists():
                    old_disk.unlink()
        existing.r2_key = r2_key
        existing.size = size
        existing.mime_type = mime
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


@router.get("/download/{file_id}", response_model=None)
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse | FileResponse:
    """Download a file by streaming it through the backend.

    R2 mode: fetches bytes from R2 and streams them to the client so the
    browser never contacts R2 directly (avoids CORS issues).

    Local-disk mode: serves directly via FastAPI FileResponse.
    """
    from app.r2 import r2_get_object_bytes

    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly; use /zip")
    session.add(FileAccessLog(file_id=record.id, user_id=current_user.id, action="download"))
    session.commit()
    if _use_r2():
        data = await r2_get_object_bytes(record.r2_key)
        mime = record.mime_type or "application/octet-stream"
        return StreamingResponse(
            io.BytesIO(data),
            media_type=mime,
            headers={
                "Content-Disposition": f'attachment; filename="{record.name}"',
                "Content-Length": str(len(data)),
            },
        )
    disk_path = _local_path(record.r2_key)
    return FileResponse(str(disk_path), filename=record.name, media_type=record.mime_type or "application/octet-stream")


@router.get("/preview/{file_id}", response_model=None)
async def preview_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse | FileResponse:
    """Stream a file inline for preview.

    R2 mode: downloads from R2 and proxies the bytes through the backend so
    the browser never needs to contact R2 directly. This avoids CORS issues
    when the R2 bucket does not allow the frontend origin.

    Local-disk mode: serves directly via FastAPI FileResponse.
    """
    from app.r2 import r2_get_object_bytes

    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot preview a folder")
    session.add(FileAccessLog(file_id=record.id, user_id=current_user.id, action="view"))
    session.commit()
    if _use_r2():
        data = await r2_get_object_bytes(record.r2_key)
        mime = record.mime_type or "application/octet-stream"
        return StreamingResponse(
            io.BytesIO(data),
            media_type=mime,
            headers={"Content-Disposition": "inline", "Content-Length": str(len(data))},
        )
    disk_path = _local_path(record.r2_key)
    return FileResponse(str(disk_path), media_type=record.mime_type or "application/octet-stream")


@router.get("/preview-url/{file_id}")
async def preview_url(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Return a JSON object with a backend-proxied URL for previewing a file.

    Always routes through the backend (/api/v1/files/preview/{id}) rather than
    returning a raw R2 presigned URL. This avoids browser CORS blocks when the
    R2 bucket does not have a CORS policy configured for the frontend origin.
    """
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot preview a folder")
    return {"url": f"/api/v1/files/preview/{file_id}"}


@router.get("/download-url/{file_id}")
async def download_url(
    file_id: str,
    inline: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Return a JSON object with a backend-proxied download URL for a file.

    Always routes through the backend (/api/v1/files/download/{id}) rather than
    returning a raw R2 presigned URL, to avoid CORS issues on the frontend.
    """
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder" or not record.r2_key:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly; use /zip")
    qs = "?inline=true" if inline else ""
    return {"url": f"/api/v1/files/download/{file_id}{qs}"}


@router.get("/raw/{file_id}", response_model=None)
async def raw_file(
    file_id: str,
    session: Session = Depends(get_session),
) -> RedirectResponse | FileResponse:
    """Unauthenticated raw file access (for public embeds)."""
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record or record.is_deleted or record.type == "folder":
        raise HTTPException(status_code=404, detail="File not found")
    if not record.r2_key:
        raise HTTPException(status_code=404, detail="File not found")
    if _use_r2():
        url = await r2_generate_presigned_url(record.r2_key, expires_in=_PREVIEW_TTL, disposition="inline")
        return RedirectResponse(url)
    disk_path = _local_path(record.r2_key)
    return FileResponse(str(disk_path), media_type=record.mime_type or "application/octet-stream")


@router.post("/folder", response_model=FileRecordResponse)
def create_folder(
    body: FolderCreateBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Create a virtual folder (DB record only)."""
    parent = body.parent_path.strip("/")
    full_path = _build_path(parent, body.name)
    existing = session.exec(
        select(FileRecord).where(FileRecord.path == full_path, FileRecord.is_deleted == False)  # noqa: E712
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Folder already exists")
    record = FileRecord(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=body.name,
        path=full_path,
        parent_path=parent,
        type="folder",
        size=0,
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
    existing = session.exec(
        select(FileRecord).where(FileRecord.path == new_path, FileRecord.is_deleted == False)  # noqa: E712
    ).first()
    if existing and existing.id != record.id:
        raise HTTPException(status_code=409, detail="A file with this name already exists")
    record.name = body.name
    record.path = new_path
    record.updated_at = _now()
    session.add(record)
    if record.type == "folder":
        _cascade_rename(session, current_user.id, old_prefix, new_path)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.patch("/move/{file_id}", response_model=FileRecordResponse)
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
    existing = session.exec(
        select(FileRecord).where(FileRecord.path == new_path, FileRecord.is_deleted == False)  # noqa: E712
    ).first()
    if existing and existing.id != record.id:
        raise HTTPException(status_code=409, detail="A file with this name already exists at the destination")
    record.path = new_path
    record.parent_path = dest_parent
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
    """Copy a file to a new location."""
    record = _get_record_or_404(file_id, current_user, session)
    if record.type == "folder":
        raise HTTPException(status_code=400, detail="Folder copy not supported yet")
    dest_parent = body.dest_parent.strip("/")
    name_parts = record.name.rsplit(".", 1)
    if dest_parent == record.parent_path:
        copy_name = f"{name_parts[0]} (copy).{name_parts[1]}" if len(name_parts) == 2 else f"{record.name} (copy)"
        dest_path = _build_path(dest_parent, copy_name)
    else:
        dest_path = _build_path(dest_parent, record.name)

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