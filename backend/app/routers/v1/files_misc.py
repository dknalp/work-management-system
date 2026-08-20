"""Misc routes: quota, zip, search, customize, star, starred, recent for /api/v1/files."""

import io
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, col, func, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileAccessLog, FileRecord, User
from app.r2 import r2_get_object_bytes
from app.routers.v1.files_utils import (
    FileRecordResponse,
    QuotaResponse,
    ZipBody,
    _build_path,
    _get_record_or_404,
    _local_path,
    _now,
    _to_response,
    _use_r2,
)

router = APIRouter()


@router.get("/quota", response_model=QuotaResponse)
def get_quota(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuotaResponse:
    """Return total used bytes and file count (all users, excluding trash)."""
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
    """Download multiple files as a ZIP archive."""
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
        while chunk := spool.read(1024 * 1024):
            yield chunk
        spool.close()

    return StreamingResponse(
        _generate(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


@router.get("/search", response_model=list[FileRecordResponse])
def search_files(
    q: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """Full-text search across file names."""
    if not q.strip():
        return []
    pattern = f"%{q.strip()}%"
    records = session.exec(
        select(FileRecord).where(
            col(FileRecord.name).ilike(pattern),
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).all()
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
    record = _get_record_or_404(file_id, current_user, session)
    if body.color is not None:
        record.color = body.color  # type: ignore[assignment]
    if body.icon_emoji is not None:
        record.icon_emoji = body.icon_emoji  # type: ignore[assignment]
    record.updated_at = _now()
    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_response(record)


@router.post("/star/{file_id}", response_model=FileRecordResponse)
def star_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
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
) -> list[FileRecordResponse]:
    records = session.exec(
        select(FileRecord).where(
            FileRecord.is_starred == True,  # noqa: E712
            FileRecord.is_deleted == False,  # noqa: E712
        )
    ).all()
    return [_to_response(r) for r in records]


@router.get("/recent", response_model=list[FileRecordResponse])
def list_recent(
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FileRecordResponse]:
    """Return recently accessed files for the current user."""
    logs = session.exec(
        select(FileAccessLog)
        .where(FileAccessLog.user_id == current_user.id)
        .order_by(FileAccessLog.accessed_at.desc())  # type: ignore[union-attr]
        .limit(limit * 3)
    ).all()
    seen: set[uuid.UUID] = set()
    records: list[FileRecord] = []
    for log in logs:
        if log.file_id in seen:
            continue
        seen.add(log.file_id)
        record = session.get(FileRecord, log.file_id)
        if record and not record.is_deleted:
            records.append(record)
        if len(records) >= limit:
            break
    return [_to_response(r) for r in records]