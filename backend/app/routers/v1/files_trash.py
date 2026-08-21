"""Trash, restore, and permanent delete routes for /api/v1/files."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileAccessLog, FileRecord, FileShare, User
from app.routers.v1.files_utils import (
    FileRecordResponse,
    _build_path,
    _cascade_rename,
    _get_record_or_404,
    _local_path,
    _now,
    _to_response,
    _use_r2,
)
from app.r2 import r2_delete_object, r2_delete_objects

router = APIRouter()


@router.delete("/trash/{file_id}", response_model=FileRecordResponse)
def trash_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """Move a file or folder to trash (soft-delete)."""
    record = _get_record_or_404(file_id, current_user, session)
    now = _now()
    record.is_deleted = True  # type: ignore[assignment]
    record.deleted_at = now  # type: ignore[assignment]
    record.updated_at = now
    session.add(record)

    # Cascade to children if folder
    if record.type == "folder":
        children = session.exec(
            select(FileRecord).where(
                FileRecord.parent_path.startswith(record.path),  # type: ignore[union-attr]
                FileRecord.is_deleted == False,  # noqa: E712
            )
        ).all()
        for child in children:
            child.is_deleted = True  # type: ignore[assignment]
            child.deleted_at = now  # type: ignore[assignment]
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
    """Restore a trashed file or folder."""
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    record.is_deleted = False  # type: ignore[assignment]
    record.deleted_at = None  # type: ignore[assignment]
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
    """Permanently delete a file (removes from storage + DB)."""
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if record.r2_key:
        if _use_r2():
            await r2_delete_object(record.r2_key)
        else:
            disk_path = _local_path(record.r2_key)
            if disk_path.exists():
                disk_path.unlink()

    # Remove FK-dependent rows before deleting the parent FileRecord to avoid
    # constraint violations (FileAccessLog and FileShare reference file_records.id).
    for log in session.exec(select(FileAccessLog).where(FileAccessLog.file_id == record.id)).all():
        session.delete(log)
    for share in session.exec(select(FileShare).where(FileShare.file_id == record.id)).all():
        session.delete(share)

    session.delete(record)
    session.commit()
    return {"ok": True}


@router.delete("/empty-trash")
async def empty_trash(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Permanently delete all trashed files."""
    records = session.exec(
        select(FileRecord).where(FileRecord.is_deleted == True)  # noqa: E712
    ).all()

    r2_keys = [r.r2_key for r in records if r.r2_key]
    if r2_keys:
        if _use_r2():
            await r2_delete_objects(r2_keys)
        else:
            for key in r2_keys:
                p = _local_path(key)
                if p.exists():
                    p.unlink()

    # Delete dependent rows first to avoid FK constraint violations.
    # FileAccessLog and FileShare both hold a foreign key to file_records.id
    # without ON DELETE CASCADE, so they must be removed before the parent row.
    record_ids = [r.id for r in records]
    for file_id in record_ids:
        for log in session.exec(select(FileAccessLog).where(FileAccessLog.file_id == file_id)).all():
            session.delete(log)
        for share in session.exec(select(FileShare).where(FileShare.file_id == file_id)).all():
            session.delete(share)

    for record in records:
        session.delete(record)
    session.commit()
    return {"deleted": len(records)}