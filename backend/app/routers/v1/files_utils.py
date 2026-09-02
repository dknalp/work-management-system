"""Shared utilities, models, and helpers for the v1 files router.

All sub-modules (files_core, files_trash, files_bulk, files_share,
files_misc, files_drive) import from here — never from each other.

Firestore collection: ``file_records``
Physical storage:     Cloudflare R2 (when env vars are set) or local disk
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Literal, Optional

# Semaphore that caps concurrent large-file uploads at 3 in-flight at once
# (matches MAX_CONCURRENT=3 in the frontend upload queue)
# per process.  Additional requests queue here rather than competing for RAM.
UPLOAD_SEMAPHORE = asyncio.Semaphore(3)

from fastapi import HTTPException
from firebase_admin import firestore
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# TTL constants (used for R2 presigned URLs)
# ---------------------------------------------------------------------------

_PREVIEW_TTL = 300    # 5 min for inline preview
_DOWNLOAD_TTL = 3600  # 1 h for attachment download

# Trash retention: items are eligible for auto-purge after this many days
TRASH_RETENTION_DAYS: int = 30

# ---------------------------------------------------------------------------
# Storage helpers — R2 vs local disk
# Unchanged from the PostgreSQL version: file bytes are not in Firestore.
# ---------------------------------------------------------------------------


def _use_r2() -> bool:
    """Return True when R2 env vars are fully configured."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID", "")
    bucket = os.environ.get("R2_BUCKET_NAME", "")
    return bool(account_id and bucket)


def _storage_root() -> Path:
    """Return the local disk storage root (used when R2 is not configured)."""
    custom = os.environ.get("FILE_STORAGE_PATH", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).parents[4] / "frontend" / "data"


def _local_path(r2_key: str) -> Path:
    """Convert an r2_key to an absolute local disk path."""
    return _storage_root() / r2_key


# ---------------------------------------------------------------------------
# Response schemas (kept in utils so all sub-modules import one place)
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
    expires_at: Optional[datetime] = None
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


class ShareCreateBody(BaseModel):
    shared_with_user_id: Optional[str] = None
    permission_level: Literal["view", "edit", "owner"] = "view"
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
    access_token: str
    parent_path: str = ""
    overwrite: bool = False
    is_folder: bool = False


class DriveImportFolderResult(BaseModel):
    """Response for a folder import (many files)."""
    folder_name: str
    imported: int
    skipped: int
    errors: list[str]


class DriveFolderImportBody(BaseModel):
    folder_id: str
    access_token: str
    parent_path: str = ""
    overwrite: bool = False


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------

def _now() -> datetime:
    """Return the current UTC datetime."""
    return datetime.now(timezone.utc)


def _build_path(parent: str, name: str) -> str:
    """Combine a parent directory path with a file/folder name.

    Rejects names that contain path separators or traversal sequences
    (``..`` / ``/``) to prevent malformed virtual paths in Firestore.
    The storage key is always UUID-based so there is no real filesystem
    traversal risk, but malformed paths break directory-listing queries.
    """
    if not name or "/" in name or name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid file name.")
    return f"{parent}/{name}" if parent else name


def _doc_to_response(doc_id: str, data: dict) -> FileRecordResponse:
    """Convert a Firestore file_records document dict to a ``FileRecordResponse``."""
    created_raw = data.get("created_at")
    updated_raw = data.get("updated_at")
    now = _now()
    created_at = created_raw if isinstance(created_raw, datetime) else now
    updated_at = updated_raw if isinstance(updated_raw, datetime) else now
    return FileRecordResponse(
        id=doc_id,
        name=data.get("name", ""),
        path=data.get("path", ""),
        parent_path=data.get("parent_path", ""),
        type=data.get("type", "file"),
        size=data.get("size"),
        mime_type=data.get("mime_type"),
        is_deleted=data.get("is_deleted", False),
        deleted_at=data.get("deleted_at"),
        expires_at=(
            (data["deleted_at"] + timedelta(days=TRASH_RETENTION_DAYS))
            if data.get("is_deleted") and isinstance(data.get("deleted_at"), datetime)
            else None
        ),
        is_starred=data.get("is_starred", False),
        color=data.get("color"),
        icon_emoji=data.get("icon_emoji"),
        created_at=created_at,
        updated_at=updated_at,
    )


def _assert_owner(data: dict, current_user: "User") -> None:
    """Raise HTTP 403 if the file record does not belong to current_user.

    Admin users bypass this check so they can access and manage any file
    (e.g. for moderation or support).  All other users must be the owner.
    """
    from app.models import User  # local import to avoid circular dependency
    if isinstance(current_user, User) and current_user.is_admin:
        return
    if data.get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")


def _get_record_or_404(file_id: str, db: firestore.Client) -> tuple[str, dict]:
    """Fetch a non-deleted file_records document or raise HTTP 404.

    Returns
    -------
    tuple[str, dict]
        The document ID and its data dict.
    """
    doc = db.collection("file_records").document(file_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found")
    data = doc.to_dict() or {}
    if data.get("is_deleted", False):
        raise HTTPException(status_code=404, detail="File not found")
    return file_id, data


def _cascade_rename(
    db: firestore.Client,
    old_prefix: str,
    new_prefix: str,
) -> None:
    """Update path / parent_path for all descendants after a rename or move.

    Firestore has no native prefix query, so we retrieve all file_records
    where ``parent_path`` starts with the old path and rewrite both fields.
    This is acceptable because nested paths are shallow in practice.
    """
    # Query records whose path starts with old_prefix + "/"
    # Firestore range query: field >= "prefix/" AND field < "prefix0" (next char)
    lower = old_prefix + "/"
    upper = old_prefix + "0"  # "0" is one code-point above "/" (ASCII 48 vs 47)

    docs = (
        db.collection("file_records")
        .where("path", ">=", lower)
        .where("path", "<", upper)
        .stream()
    )

    now = _now()
    batch = db.batch()
    count = 0
    for doc in docs:
        data = doc.to_dict() or {}
        old_path = data.get("path", "")
        new_path = new_prefix + old_path[len(old_prefix):]
        new_parent = new_path.rsplit("/", 1)[0] if "/" in new_path else ""
        batch.update(doc.reference, {
            "path": new_path,
            "parent_path": new_parent,
            "updated_at": now,
        })
        count += 1
        # Firestore batch writes are limited to 500 operations
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0

    if count > 0:
        batch.commit()

# ---------------------------------------------------------------------------
# Shared trash helpers
# ---------------------------------------------------------------------------

def _cascade_flag(
    db: "firestore.Client",
    folder_path: str,
    updates: dict,
    skip_if: "Callable[[dict], bool] | None" = None,
) -> int:
    """Apply `updates` to all descendants of `folder_path` in batched writes.

    Uses a path-range query (path >= folder/ and path < folder0) to avoid
    needing a composite Firestore index.  Commits in chunks of 499 to stay
    within Firestore's 500-operation batch limit.

    Args:
        db: Firestore client.
        folder_path: The parent folder path (without trailing slash).
        updates: Field dict to apply to each matched document.
        skip_if: Optional predicate; documents for which this returns True
                 are skipped without being updated.

    Returns:
        Number of documents actually updated.
    """
    prefix = folder_path + "/"
    suffix = folder_path + "0"  # '0' > '/' in ASCII — safe upper bound
    docs = (
        db.collection("file_records")
        .where("path", ">=", prefix)
        .where("path", "<", suffix)
        .stream()
    )
    batch = db.batch()
    count = 0
    total = 0
    for doc in docs:
        data = doc.to_dict() or {}
        if skip_if and skip_if(data):
            continue
        batch.update(doc.reference, updates)
        count += 1
        total += 1
        if count >= 499:
            batch.commit()
            batch = db.batch()
            count = 0
    if count > 0:
        batch.commit()
    return total


def _delete_file_metadata(db: "firestore.Client", file_ids: list[str]) -> None:
    """Delete file_access_logs and file_shares records for the given file IDs.

    Non-fatal: errors (e.g. missing Firestore index) are caught and logged
    rather than propagated, so the primary deletion always completes.
    """
    import logging
    logger = logging.getLogger(__name__)
    for collection in ("file_access_logs", "file_shares"):
        for file_id in file_ids:
            try:
                for mdoc in db.collection(collection).where("file_id", "==", file_id).stream():
                    mdoc.reference.delete()
            except Exception as exc:
                logger.warning(
                    "_delete_file_metadata: cleanup failed collection=%s file_id=%s: %s",
                    collection, file_id, exc,
                )
