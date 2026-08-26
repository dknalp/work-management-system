"""Shared utilities, models, and helpers for the v1 files router.

All sub-modules (files_core, files_trash, files_bulk, files_share,
files_misc, files_drive) import from here — never from each other.

Firestore collection: ``file_records``
Physical storage:     Cloudflare R2 (when env vars are set) or local disk
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import HTTPException
from firebase_admin import firestore
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# TTL constants (used for R2 presigned URLs)
# ---------------------------------------------------------------------------

_PREVIEW_TTL = 300    # 5 min for inline preview
_DOWNLOAD_TTL = 3600  # 1 h for attachment download

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
    """Combine a parent directory path with a file/folder name."""
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
        is_starred=data.get("is_starred", False),
        color=data.get("color"),
        icon_emoji=data.get("icon_emoji"),
        created_at=created_at,
        updated_at=updated_at,
    )


def _assert_owner(data: dict, current_user_id: str) -> None:
    """Raise HTTP 403 if the file record does not belong to current_user_id.

    Admins bypass this check — pass current_user.id here and call this after
    _get_record_or_404.  The caller is responsible for passing the correct
    owner_id to avoid giving admins blanket access unintentionally; if admin
    bypass is needed, check is_admin before calling.
    """
    if data.get("owner_id") != current_user_id:
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