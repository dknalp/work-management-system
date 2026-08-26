"""Bulk operation routes for /api/v1/files."""

import uuid

from fastapi import APIRouter, Depends
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
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
    db: firestore.Client = Depends(get_db),
) -> BulkResult:
    """Move a set of files/folders to a new parent directory."""
    succeeded, failed = [], []
    now = _now()
    for fid in body.ids:
        try:
            _, data = _get_record_or_404(fid, db)
            if not current_user.is_admin and data.get("owner_id") != current_user.id:
                failed.append(fid)
                continue
            new_path = _build_path(body.dest_parent, data["name"])
            db.collection("file_records").document(fid).update({
                "path": new_path,
                "parent_path": body.dest_parent,
                "updated_at": now,
            })
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    return BulkResult(succeeded=succeeded, failed=failed)


@router.post("/bulk-copy", response_model=BulkResult)
async def bulk_copy(
    body: BulkCopyBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> BulkResult:
    """Copy a set of files to a new parent directory."""
    succeeded, failed = [], []
    for fid in body.ids:
        try:
            _, data = _get_record_or_404(fid, db)
            if not current_user.is_admin and data.get("owner_id") != current_user.id:
                failed.append(fid)
                continue
            new_id = str(uuid.uuid4())
            new_r2_key: str | None = None

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
            db.collection("file_records").document(new_id).set({
                **data,
                "path": new_path,
                "parent_path": body.dest_parent,
                "r2_key": new_r2_key,
                "is_deleted": False,
                "deleted_at": None,
                "is_starred": False,
                "created_at": now,
                "updated_at": now,
            })
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    return BulkResult(succeeded=succeeded, failed=failed)


@router.delete("/bulk-trash", response_model=BulkResult)
def bulk_trash(
    body: BulkTrashBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> BulkResult:
    """Soft-delete (trash) a set of files/folders."""
    succeeded, failed = [], []
    now = _now()
    for fid in body.ids:
        try:
            _, data = _get_record_or_404(fid, db)
            if not current_user.is_admin and data.get("owner_id") != current_user.id:
                failed.append(fid)
                continue
            db.collection("file_records").document(fid).update({
                "is_deleted": True,
                "deleted_at": now,
                "updated_at": now,
            })
            succeeded.append(fid)
        except Exception:
            failed.append(fid)
    return BulkResult(succeeded=succeeded, failed=failed)