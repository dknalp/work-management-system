import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import TeamMember
from ...schemas import TeamMemberCreate, TeamMemberResponse, TeamMemberUpdate

router = APIRouter(prefix="/team", tags=["v1-team"])


@router.get("/members", response_model=List[TeamMemberResponse])
def list_members(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    members = session.exec(select(TeamMember).order_by(TeamMember.created_at)).all()
    return members


@router.get("/members/{member_id}", response_model=TeamMemberResponse)
def get_member(
    member_id: str,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    member = session.get(TeamMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return member


@router.post("/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    body: TeamMemberCreate,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    member = TeamMember(
        id=body.id or f"member-{uuid.uuid4().hex[:8]}",
        name=body.name,
        email=body.email,
        role=body.role,
        department=body.department,
        status=body.status or "active",
        avatar=body.avatar,
        joined_at=body.joined_at or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        created_at=datetime.now(timezone.utc),
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.put("/members/{member_id}", response_model=TeamMemberResponse)
def update_member(
    member_id: str,
    body: TeamMemberUpdate,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    member = session.get(TeamMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(member, key, value)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    member_id: str,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    member = session.get(TeamMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    session.delete(member)
    session.commit()