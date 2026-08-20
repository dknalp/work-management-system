"""Shared utilities, models, and helpers for the files router.

All sub-modules (files_core, files_trash, files_bulk, files_share,
files_misc, files_drive) import from here — never from each other.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.models import FileRecord, User

# ---------------------------------------------------------------------------
# TTL constants
# ---------------------------------------------------------------------------

_PREVIEW_TTL = 300    # 5 min for inline preview
_DOWNLOAD_TTL = 3600  # 1 h for attachment download

# ---------------------------------------------------------------------------
# Storage helpers — R2 vs local disk
# ---------------------------------------------------------------------------


def _use_r2() -> bool:
    """Return True when R2 env vars are fully configured."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID", "")
    bucket = os.environ.get("R2_BUCKET_NAME", "")
    return bool(account_id and bucket)


def _storage_root() -> Path:
    """Return the local disk storage root (used when R2 is not configured).

    Resolution order:
    1. FILE_STORAGE_PATH env var (absolute or relative to CWD)
    2. <repo_root>/frontend/data/ as documented in CLAUDE.md
    """
    custom = os.environ.get("FILE_STORAGE_PATH", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).parents[4] / "frontend" / "data"


def _local_path(r2_key: str) -> Path:
    """Convert an r2_key to an absolute local disk path."""
    return _storage_root() / r2_key


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
    permission_level: str = "view"
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
    return datetime.now(timezone.utc)


def _build_path(parent: str, name: str) -> str:
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
        is_starred=record.is_starred,
        created_at=record.created_at,
        updated_at=record.updated_at,
        color=getattr(record, "color", None),
        icon_emoji=getattr(record, "icon_emoji", None),
    )


def _get_record_or_404(file_id: str, current_user: User, session: Session) -> FileRecord:
    try:
        uid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    record = session.get(FileRecord, uid)
    if not record or record.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return record


def _cascade_rename(
    session: Session,
    _owner_id: uuid.UUID,
    old_prefix: str,
    new_prefix: str,
) -> None:
    """Update path / parent_path for all descendants after a rename/move."""
    children = session.exec(
        select(FileRecord).where(
            col(FileRecord.path).startswith(old_prefix + "/"),
        )
    ).all()
    now = _now()
    for child in children:
        child.path = new_prefix + child.path[len(old_prefix):]
        child.parent_path = child.path.rsplit("/", 1)[0] if "/" in child.path else ""
        child.updated_at = now
        session.add(child)