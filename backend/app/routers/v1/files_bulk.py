"""Bulk operation routes for /api/v1/files."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.deps import get_current_user
from app.models import FileRecord, User
from app.r2 import r2_copy_object
from app.routers.v1.files_utils import (
    BulkCopyBody,
    BulkMoveBody,
    BulkResult,
    BulkTrashBody,
    _build_path,
    _get_record_or_404,
    _local_path,
    _now,
    _use_r2,
)

router = APIRouter()


@router.post("/bulk-move", response_model=BulkResult)
def bulk_move(
    body: BulkMoveBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> BulkResult:
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
) -> BulkResult:
    succeeded, failed = [], []
    for fid in body.ids:
        try:
            record = _get_record_or_404(fid, current_user, session)
            new_path = _build_path(body.dest_parent, record.name)
            new_id = uuid.uuid4()
            new_r2_key: str | None = f"shared/{new_id}"
            if record.r2_key and record.type == "file":
                if _use_r2():
                    await r2_copy_object(record.r2_key, new_r2_key)
                else:
                    import shutil
                    src = _local_path(record.r2_key)
                    dst = _local_path(new_r2_key)
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
            else:
                new_r2_key = None
            new_record = FileRecord(
                id=new_id,
                owner_id=current_user.id,
                name=record.name,
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
) -> BulkResult:
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