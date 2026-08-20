"""File sharing routes for /api/v1/files."""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_current_user
from app.models import FileRecord, FileShare, User
from app.routers.v1.files_utils import (
    FileRecordResponse,
    ShareCreateBody,
    ShareResponse,
    _get_record_or_404,
    _now,
    _to_response,
)

router = APIRouter()


def _share_to_response(share: FileShare) -> ShareResponse:
    return ShareResponse(
        id=str(share.id),
        file_id=str(share.file_id),
        owner_id=str(share.owner_id),
        shared_with_user_id=str(share.shared_with_user_id) if share.shared_with_user_id else None,
        share_token=share.share_token,
        permission_level=share.permission_level,
        expires_at=share.expires_at,
        created_at=share.created_at,
    )


@router.post("/share/{file_id}", response_model=ShareResponse)
def create_share(
    file_id: str,
    body: ShareCreateBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ShareResponse:
    record = _get_record_or_404(file_id, current_user, session)
    share = FileShare(
        file_id=record.id,
        owner_id=current_user.id,
        shared_with_user_id=body.shared_with_user_id,
        permission_level=body.permission_level,
        expires_at=body.expires_at,
    )
    session.add(share)
    session.commit()
    session.refresh(share)
    return _share_to_response(share)


@router.get("/share/{file_id}", response_model=list[ShareResponse])
def list_shares(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ShareResponse]:
    record = _get_record_or_404(file_id, current_user, session)
    shares = session.exec(select(FileShare).where(FileShare.file_id == record.id)).all()
    return [_share_to_response(s) for s in shares]


@router.delete("/share/{share_id}", status_code=204)
def delete_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    share = session.exec(select(FileShare).where(FileShare.id == share_id)).first()
    if not share or share.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")
    session.delete(share)
    session.commit()


@router.post("/share/{file_id}/link", response_model=dict)
def create_share_link(
    file_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    record = _get_record_or_404(file_id, current_user, session)
    token = secrets.token_urlsafe(32)
    share = FileShare(
        file_id=record.id,
        owner_id=current_user.id,
        share_token=token,
        permission_level="view",
    )
    session.add(share)
    session.commit()
    return {"token": token, "url": f"/files/public/{token}"}


@router.get("/public/{token}", response_model=FileRecordResponse)
def get_public_file(
    token: str,
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    share = session.exec(select(FileShare).where(FileShare.share_token == token)).first()
    if not share:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    if share.expires_at and share.expires_at < _now():
        raise HTTPException(status_code=410, detail="Link expired")
    record = session.get(FileRecord, share.file_id)
    if not record or record.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return _to_response(record)