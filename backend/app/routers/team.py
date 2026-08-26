"""Team router — management of team member records.

Team members are separate from user accounts.  A team member is a person
listed in the team directory; they may or may not have a corresponding user
account.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore

from ..deps import require_permission
from ..firebase import get_db
from ..models import User
from ..schemas import TeamMemberCreate, TeamMemberResponse, TeamMemberUpdate

router = APIRouter(prefix="/team", tags=["team"])


def _doc_to_response(doc_id: str, data: dict) -> TeamMemberResponse:
    """Convert a Firestore team_members document dict to a ``TeamMemberResponse``."""
    return TeamMemberResponse(
        id=doc_id,
        name=data.get("name", ""),
        email=data.get("email", ""),
        role=data.get("role", "member"),
        status=data.get("status", "active"),
        avatar=data.get("avatar"),
        joined_at=data.get("joined_at"),
        phone=data.get("phone"),
    )


@router.get("", response_model=List[TeamMemberResponse])
def list_team(
    current_user: User = Depends(require_permission("team:view")),
    db: firestore.Client = Depends(get_db),
):
    """Return all team members, ordered by creation date."""
    docs = db.collection("team_members").order_by("created_at").stream()
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    body: TeamMemberCreate,
    current_user: User = Depends(require_permission("team:manage")),
    db: firestore.Client = Depends(get_db),
):
    """Create a new team member entry."""
    member_id = body.id or f"tm-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    data = {
        "id": member_id,
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "status": body.status,
        "avatar": body.avatar,
        "joined_at": body.joined_at or now.strftime("%Y-%m-%d"),
        "phone": body.phone,
        "created_at": now,
    }
    db.collection("team_members").document(member_id).set(data)
    return _doc_to_response(member_id, data)


@router.put("/{member_id}", response_model=TeamMemberResponse)
def update_member(
    member_id: str,
    body: TeamMemberUpdate,
    current_user: User = Depends(require_permission("team:manage")),
    db: firestore.Client = Depends(get_db),
):
    """Update a team member's fields."""
    doc_ref = db.collection("team_members").document(member_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    updates = body.model_dump(exclude_unset=True)
    if updates:
        doc_ref.update(updates)

    merged = {**(doc.to_dict() or {}), **updates}
    return _doc_to_response(member_id, merged)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    member_id: str,
    current_user: User = Depends(require_permission("team:manage")),
    db: firestore.Client = Depends(get_db),
):
    """Delete a team member entry."""
    doc = db.collection("team_members").document(member_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
    db.collection("team_members").document(member_id).delete()