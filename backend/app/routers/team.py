import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import TeamMember
from ..schemas import TeamMemberCreate, TeamMemberResponse, TeamMemberUpdate

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=List[TeamMemberResponse])
def list_team(session: Session = Depends(get_session)):
    members = session.exec(select(TeamMember).order_by(TeamMember.created_at)).all()
    return members


@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(body: TeamMemberCreate, session: Session = Depends(get_session)):
    member = TeamMember(
        id=body.id or f"tm-{uuid.uuid4().hex[:8]}",
        name=body.name,
        email=body.email,
        role=body.role,
        status=body.status,
        avatar=body.avatar,
        joined_at=body.joined_at or datetime.utcnow().strftime("%Y-%m-%d"),
        phone=body.phone,
        created_at=datetime.utcnow(),
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.put("/{member_id}", response_model=TeamMemberResponse)
def update_member(member_id: str, body: TeamMemberUpdate, session: Session = Depends(get_session)):
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


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: str, session: Session = Depends(get_session)):
    member = session.get(TeamMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    session.delete(member)
    session.commit()