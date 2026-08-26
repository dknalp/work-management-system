"""Trash, restore, and permanent-delete routes for /api/v1/files."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.r2 import r2_delete_object, r2_delete_objects
from app.routers.v1.files_utils import (
    FileRecordResponse,
    _assert_owner,
    _doc_to_response,
    _local_path,
    _now,
    _use_r2,
)

router = APIRouter()


@router.delete("/trash/{file_id}", response_model=FileRecordResponse)
def trash_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Move a file or folder to trash (soft-delete).

    Also cascades the trash flag to all descendants when the target is a folder.
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists or (doc.to_dict() or {}).get("is_deleted", False):
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user.id)
    now = _now()

    db.collection("file_records").document(file_id).update({
        "is_deleted": True,
        "deleted_at": now,
        "updated_at": now,
    })

    # Cascade to children when trashing a folder
    if data.get("type") == "folder":
        prefix = data["path"] + "/"
        suffix = data["path"] + "0"  # range upper bound
        children = (
            db.collection("file_records")
            .where("path", ">=", prefix)
            .where("path", "<", suffix)
            .where("is_deleted", "==", False)
            .stream()
        )
        batch = db.batch()
        count = 0
        for child in children:
            batch.update(child.reference, {"is_deleted": True, "deleted_at": now, "updated_at": now})
            count += 1
            if count >= 499:
                batch.commit()
                batch = db.batch()
                count = 0
        if count > 0:
            batch.commit()

    updated = {**data, "is_deleted": True, "deleted_at": now, "updated_at": now}
    return _doc_to_response(file_id, updated)


@router.get("/trash", response_model=list[FileRecordResponse])
def list_trash(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[FileRecordResponse]:
    """Return all trashed files for the current user."""
    docs = (
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .where("is_deleted", "==", True)
        .stream()
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("/restore/{file_id}", response_model=FileRecordResponse)
def restore_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Restore a trashed file or folder."""
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user.id)
    if not data.get("is_deleted", False):
        raise HTTPException(status_code=400, detail="File is not in trash.")

    now = _now()
    db.collection("file_records").document(file_id).update({
        "is_deleted": False,
        "deleted_at": None,
        "updated_at": now,
    })

    updated = {**data, "is_deleted": False, "deleted_at": None, "updated_at": now}
    return _doc_to_response(file_id, updated)


@router.delete("/empty-trash", status_code=204)
async def empty_trash(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Permanently delete all trashed files for the current user.

    Deletes storage objects from R2 (or local disk) then removes the
    Firestore documents in batches.
    """
    docs = list(
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .where("is_deleted", "==", True)
        .stream()
    )

    # Collect R2 keys for storage cleanup
    r2_keys = [
        (doc.to_dict() or {}).get("r2_key")
        for doc in docs
        if (doc.to_dict() or {}).get("r2_key")
    ]

    if r2_keys:
        try:
            if _use_r2():
                await r2_delete_objects(r2_keys)
            else:
                for key in r2_keys:
                    local = _local_path(key)
                    if local.exists():
                        local.unlink()
        except Exception:
            pass  # Best-effort; delete Firestore records regardless

    # Delete Firestore documents in batches of 500
    batch = db.batch()
    count = 0
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0
    if count > 0:
        batch.commit()


@router.delete("/permanent/{file_id}", status_code=204)
async def delete_permanently(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Permanently delete a single trashed file and its storage object."""
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user.id)
    r2_key = data.get("r2_key")

    if r2_key:
        try:
            if _use_r2():
                await r2_delete_object(r2_key)
            else:
                local = _local_path(r2_key)
                if local.exists():
                    local.unlink()
        except Exception:
            pass

    db.collection("file_records").document(file_id).delete()

    # Also delete associated access logs and share records
    for log_doc in db.collection("file_access_logs").where("file_id", "==", file_id).stream():
        log_doc.reference.delete()
    for share_doc in db.collection("file_shares").where("file_id", "==", file_id).stream():
        share_doc.reference.delete()