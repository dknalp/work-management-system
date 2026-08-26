"""File sharing routes for /api/v1/files."""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User
from app.routers.v1.files_utils import (
    FileRecordResponse,
    ShareCreateBody,
    ShareResponse,
    _doc_to_response,
    _now,
)

router = APIRouter()


def _share_doc_to_response(doc_id: str, data: dict) -> ShareResponse:
    """Convert a Firestore file_shares document dict to a ``ShareResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else _now()
    return ShareResponse(
        id=doc_id,
        file_id=data.get("file_id", ""),
        owner_id=data.get("owner_id", ""),
        shared_with_user_id=data.get("shared_with_user_id"),
        share_token=data.get("share_token"),
        permission_level=data.get("permission_level", "view"),
        expires_at=data.get("expires_at"),
        created_at=created_at,
    )


@router.post("/share", response_model=ShareResponse, status_code=201)
def create_share(
    body: ShareCreateBody,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> ShareResponse:
    """Create a share record for a file.

    If ``shared_with_user_id`` is omitted, a random token is generated so the
    file can be shared via a public link.
    """
    # Verify the file exists and belongs to the current user
    doc = db.collection("file_records").document(body.file_id).get()
    if not doc.exists or (doc.to_dict() or {}).get("is_deleted", False):
        raise HTTPException(status_code=404, detail="File not found.")
    if (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this file.")

    share_id = str(uuid.uuid4())
    token = None if body.shared_with_user_id else secrets.token_urlsafe(24)
    now = _now()

    share_data = {
        "file_id": body.file_id,
        "owner_id": current_user.id,
        "shared_with_user_id": body.shared_with_user_id,
        "share_token": token,
        "permission_level": body.permission_level,
        "expires_at": body.expires_at,
        "created_at": now,
    }
    db.collection("file_shares").document(share_id).set(share_data)
    return _share_doc_to_response(share_id, share_data)


@router.get("/share", response_model=list[ShareResponse])
def list_shares(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> list[ShareResponse]:
    """Return all share records created by the current user."""
    docs = (
        db.collection("file_shares")
        .where("owner_id", "==", current_user.id)
        .stream()
    )
    return [_share_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.delete("/share/{share_id}", status_code=204)
def revoke_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> None:
    """Revoke a share link.  Only the owner of the share may revoke it."""
    doc = db.collection("file_shares").document(share_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Share not found.")
    if (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this share.")
    db.collection("file_shares").document(share_id).delete()


@router.get("/share/access/{token}", response_model=FileRecordResponse)
def access_by_token(
    token: str,
    db: firestore.Client = Depends(get_db),
) -> FileRecordResponse:
    """Access a file using a public share token (no auth required)."""
    docs = list(
        db.collection("file_shares")
        .where("share_token", "==", token)
        .limit(1)
        .stream()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="Share link not found or expired.")

    share_data = docs[0].to_dict() or {}

    # Check expiry
    expires_at = share_data.get("expires_at")
    if expires_at and isinstance(expires_at, datetime) and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share link has expired.")

    file_id = share_data.get("file_id", "")
    file_doc = db.collection("file_records").document(file_id).get()
    if not file_doc.exists or (file_doc.to_dict() or {}).get("is_deleted", False):
        raise HTTPException(status_code=404, detail="File not found.")

    return _doc_to_response(file_id, file_doc.to_dict() or {})