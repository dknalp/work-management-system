"""Trash, restore, and permanent-delete routes for /api/v1/files."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.r2 import r2_delete_object, r2_delete_objects
from app.routers.v1.files_utils import (
    TRASH_RETENTION_DAYS,
    FileRecordResponse,
    _assert_owner,
    _cascade_flag,
    _delete_file_metadata,
    _doc_to_response,
    _local_path,
    _now,
    _use_r2,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["v1-files"])

# NOTE: static routes (/empty-trash, /trash, /restore) MUST be registered
# before parameterized routes (/trash/{file_id}, /restore/{file_id}) so
# FastAPI does not treat the literal path segment as a file_id value.


# ---------------------------------------------------------------------------
# Empty trash
# ---------------------------------------------------------------------------

@router.delete("/empty-trash", status_code=204)
async def empty_trash(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Permanently delete all trashed files for the current user.

    Deletes storage objects (R2 or local disk), Firestore file_records
    documents, and associated file_access_logs / file_shares records.
    Storage and metadata cleanup failures are logged as warnings but do
    not abort the operation — Firestore records are always removed.
    """
    docs = (
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .where("is_deleted", "==", True)
        .stream()
    )

    r2_keys: list[str] = []
    doc_refs: list = []
    file_ids: list[str] = []

    for doc in docs:
        data = doc.to_dict() or {}
        if key := data.get("r2_key"):
            r2_keys.append(key)
        doc_refs.append(doc.reference)
        file_ids.append(doc.id)

    logger.info(
        "empty_trash: user=%s deleting %d files (%d with storage objects)",
        current_user.id, len(doc_refs), len(r2_keys),
    )

    # Delete storage objects — non-fatal on failure
    if r2_keys:
        try:
            if _use_r2():
                await r2_delete_objects(r2_keys)
            else:
                for key in r2_keys:
                    local = _local_path(key)
                    if local.exists():
                        local.unlink()
        except Exception as exc:
            logger.warning(
                "empty_trash: storage cleanup failed user=%s count=%d: %s",
                current_user.id, len(r2_keys), exc,
            )

    # Delete Firestore file_records in batches of 499
    batch = db.batch()
    count = 0
    for ref in doc_refs:
        batch.delete(ref)
        count += 1
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0
    if count > 0:
        batch.commit()

    # Clean up associated access logs and share records — non-fatal
    _delete_file_metadata(db, file_ids)

    logger.info(
        "empty_trash: done user=%s deleted=%d",
        current_user.id, len(doc_refs),
    )


# ---------------------------------------------------------------------------
# Trash (soft-delete)
# ---------------------------------------------------------------------------

@router.delete("/trash/{file_id}", response_model=FileRecordResponse)
def trash_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Move a file or folder to trash (soft-delete).

    Sets is_deleted=True and records deleted_at.  When the target is a
    folder, cascades the trash flag to all descendants.  Idempotent: if
    the file is already trashed, returns its current state without error.

    Order of checks:
      1. Fetch document — 404 if missing
      2. Assert ownership — 403 if wrong user
      3. Idempotent early-return if already trashed
      4. Apply trash update (+ cascade for folders)
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user)

    # Idempotent: already trashed — return current state without re-writing
    if data.get("is_deleted", False):
        logger.debug("trash_file: already trashed file_id=%s user=%s", file_id, current_user.id)
        return _doc_to_response(file_id, data)

    now = _now()
    db.collection("file_records").document(file_id).update({
        "is_deleted": True,
        "deleted_at": now,
        "updated_at": now,
    })
    logger.info(
        "trash_file: user=%s file_id=%s type=%s",
        current_user.id, file_id, data.get("type"),
    )

    # Cascade to all descendants when trashing a folder
    if data.get("type") == "folder":
        child_count = _cascade_flag(
            db,
            data["path"],
            {"is_deleted": True, "deleted_at": now, "updated_at": now},
            skip_if=lambda d: bool(d.get("is_deleted")),  # skip already-trashed children
        )
        logger.debug(
            "trash_file: cascaded to %d children folder_path=%s",
            child_count, data["path"],
        )

    updated = {**data, "is_deleted": True, "deleted_at": now, "updated_at": now}
    return _doc_to_response(file_id, updated)


# ---------------------------------------------------------------------------
# List trash
# ---------------------------------------------------------------------------

@router.get("/trash", response_model=list[FileRecordResponse])
def list_trash(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[FileRecordResponse]:
    """Return only top-level trashed items for the current user.

    When a folder is trashed, all its descendants are cascade-trashed too.
    This endpoint returns only the root of each trashed subtree — the item
    the user directly sent to trash — so the trash view shows one row per
    user action rather than every cascaded descendant.

    Algorithm: fetch all trashed items, build a set of their paths, then
    exclude any item whose immediate parent path is also in that set.
    """
    # Query on owner_id only (single-field, always auto-indexed).
    # Filter is_deleted in Python to avoid requiring a composite index
    # while the (owner_id, is_deleted) composite index is being built.
    docs = (
        db.collection("file_records")
        .where("owner_id", "==", current_user.id)
        .stream()
    )
    all_trashed: dict[str, dict] = {}
    for doc in docs:
        d = doc.to_dict() or {}
        if d.get("is_deleted", False):
            all_trashed[doc.id] = d

    # Build a set of all trashed paths for fast ancestor lookup
    trashed_paths: set[str] = {d.get("path", "") for d in all_trashed.values()}

    result: list[FileRecordResponse] = []
    for file_id, data in all_trashed.items():
        path = data.get("path", "")
        # Keep only items whose parent is NOT itself trashed (i.e. top-level)
        parent_path = path.rsplit("/", 1)[0] if "/" in path else ""
        if parent_path and parent_path in trashed_paths:
            continue  # cascaded child — skip
        result.append(_doc_to_response(file_id, data))

    logger.debug("list_trash: user=%s returning %d top-level items", current_user.id, len(result))
    return result


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

@router.post("/restore/{file_id}", response_model=FileRecordResponse)
def restore_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Restore a trashed file or folder.

    Clears is_deleted and deleted_at.  When the target is a folder, also
    restores all descendants that were cascade-trashed with it.

    Raises 404 if the file does not exist, 403 if the caller does not own
    it, and 400 if the file is not currently in trash.
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user)

    if not data.get("is_deleted", False):
        raise HTTPException(status_code=400, detail="File is not in trash.")

    now = _now()
    db.collection("file_records").document(file_id).update({
        "is_deleted": False,
        "deleted_at": None,
        "updated_at": now,
    })
    logger.info("restore_file: user=%s file_id=%s type=%s", current_user.id, file_id, data.get("type"))

    # Cascade restore to all trashed descendants when restoring a folder
    if data.get("type") == "folder":
        child_count = _cascade_flag(
            db,
            data["path"],
            {"is_deleted": False, "deleted_at": None, "updated_at": now},
            skip_if=lambda d: not d.get("is_deleted"),  # skip already-active children
        )
        logger.debug(
            "restore_file: cascaded restore to %d children folder_path=%s",
            child_count, data["path"],
        )

    updated = {**data, "is_deleted": False, "deleted_at": None, "updated_at": now}
    return _doc_to_response(file_id, updated)


# ---------------------------------------------------------------------------
# Permanent delete
# ---------------------------------------------------------------------------

@router.delete("/permanent/{file_id}", status_code=204)
async def delete_permanently(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Permanently delete a single trashed item (file or folder).

    For files: deletes the R2/local storage object, the Firestore record,
    and associated access logs + share records.

    For folders: also cascades into all descendant file_records (files and
    subfolders whose path starts with the folder's path + "/"), collecting
    their R2 keys and deleting them in bulk before removing all Firestore
    records in a batch.

    Storage and metadata cleanup failures are logged as warnings but do
    not abort the operation — Firestore records are always removed.

    Raises 404 if the item does not exist, 403 if the caller does not own
    it, and 400 if the item is not currently in trash.
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found.")

    data = doc.to_dict() or {}
    _assert_owner(data, current_user)

    if not data.get("is_deleted", False):
        raise HTTPException(status_code=400, detail="File is not in trash.")

    is_folder = data.get("type") == "folder"
    folder_path: str = data.get("path", "")

    # Collect all items to delete: the item itself + all descendants (for folders)
    r2_keys: list[str] = []
    doc_refs: list = []
    all_file_ids: list[str] = [file_id]

    if root_key := data.get("r2_key"):
        r2_keys.append(root_key)
    doc_refs.append(db.collection("file_records").document(file_id))

    if is_folder and folder_path:
        # Fetch all descendants: records whose path starts with "<folder_path>/"
        prefix_end = folder_path + "/"
        child_docs = (
            db.collection("file_records")
            .where("owner_id", "==", current_user.id)
            .where("path", ">=", folder_path + "/")
            .where("path", "<=", prefix_end)
            .stream()
        )
        for child in child_docs:
            child_data = child.to_dict() or {}
            if key := child_data.get("r2_key"):
                r2_keys.append(key)
            doc_refs.append(child.reference)
            all_file_ids.append(child.id)

    logger.info(
        "delete_permanently: user=%s file_id=%s is_folder=%s "
        "total_records=%d r2_objects=%d",
        current_user.id, file_id, is_folder, len(doc_refs), len(r2_keys),
    )

    # Delete storage objects — non-fatal on failure
    if r2_keys:
        try:
            if _use_r2():
                if len(r2_keys) == 1:
                    await r2_delete_object(r2_keys[0])
                else:
                    await r2_delete_objects(r2_keys)
            else:
                for key in r2_keys:
                    local = _local_path(key)
                    if local.exists():
                        local.unlink()
        except Exception as exc:
            logger.warning(
                "delete_permanently: storage cleanup failed file_id=%s count=%d: %s",
                file_id, len(r2_keys), exc,
            )

    # Delete all Firestore records in batches of 499
    batch = db.batch()
    count = 0
    for ref in doc_refs:
        batch.delete(ref)
        count += 1
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0
    if count > 0:
        batch.commit()

    # Clean up associated access logs and share records — non-fatal
    _delete_file_metadata(db, all_file_ids)

    logger.info(
        "delete_permanently: done file_id=%s deleted_records=%d",
        file_id, len(doc_refs),
    )
