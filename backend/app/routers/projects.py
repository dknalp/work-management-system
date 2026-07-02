import re
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import Project, User
from ..schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _unique_slug(base: str, existing_slugs: set) -> str:
    if base not in existing_slugs:
        return base
    i = 2
    while f"{base}-{i}" in existing_slugs:
        i += 1
    return f"{base}-{i}"


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    projects = session.exec(
        select(Project)
        .where(Project.owner_id == current_user.id)
        .order_by(Project.created_at.asc())
    ).all()
    return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    existing_slugs = set(
        session.exec(select(Project.slug).where(Project.owner_id == current_user.id)).all()
    )

    if body.slug:
        slug = body.slug
        if slug in existing_slugs:
            slug = _unique_slug(slug, existing_slugs)
    else:
        base = _slugify(body.name) or "proje"
        slug = _unique_slug(base, existing_slugs)

    project = Project(
        id=body.id or f"proj-{uuid.uuid4().hex[:8]}",
        name=body.name,
        slug=slug,
        color=body.color,
        emoji=body.emoji,
        is_pinned=body.is_pinned,
        is_expanded=body.is_expanded,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    data = body.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"] != project.slug:
        existing_slugs = set(
            session.exec(
                select(Project.slug).where(
                    Project.owner_id == current_user.id,
                    Project.id != project_id,
                )
            ).all()
        )
        data["slug"] = _unique_slug(data["slug"], existing_slugs)

    for key, value in data.items():
        setattr(project, key, value)
    project.updated_at = datetime.now(timezone.utc)

    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    session.delete(project)
    session.commit()