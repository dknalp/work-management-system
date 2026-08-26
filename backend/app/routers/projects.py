"""Projects router — user-owned project management.

Each project belongs to a single user (owner_id = Firebase UID).  Slugs are
unique per owner and auto-generated from the project name if not provided.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(tags=["projects"])


def _slugify(name: str) -> str:
    """Convert a project name to a URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _unique_slug(base: str, existing_slugs: set) -> str:
    """Append a numeric suffix to make a slug unique within the given set."""
    if base not in existing_slugs:
        return base
    i = 2
    while f"{base}-{i}" in existing_slugs:
        i += 1
    return f"{base}-{i}"


def _get_owner_slugs(owner_id: str, db: firestore.Client, exclude_id: str = "") -> set:
    """Return the set of all project slugs owned by the given user."""
    docs = db.collection("projects").where("owner_id", "==", owner_id).stream()
    return {
        (doc.to_dict() or {}).get("slug", "")
        for doc in docs
        if doc.id != exclude_id
    }


def _doc_to_response(doc_id: str, data: dict) -> ProjectResponse:
    """Convert a Firestore project document dict to a ``ProjectResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return ProjectResponse(
        id=doc_id,
        name=data.get("name", ""),
        slug=data.get("slug", ""),
        color=data.get("color", "#6366f1"),
        emoji=data.get("emoji", "📁"),
        is_pinned=data.get("is_pinned", False),
        is_expanded=data.get("is_expanded", True),
        created_at=created_at,
    )


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Return all projects owned by the current user, ordered by creation date."""
    docs = (
        db.collection("projects")
        .where("owner_id", "==", current_user.id)
        .order_by("created_at")
        .limit(500)
        .stream()
    )
    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Create a new project for the current user."""
    existing_slugs = _get_owner_slugs(current_user.id, db)

    if body.slug:
        slug = _unique_slug(body.slug, existing_slugs)
    else:
        base = _slugify(body.name) or "project"
        slug = _unique_slug(base, existing_slugs)

    # Always generate IDs server-side — never trust a client-supplied ID.
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    data = {
        "name": body.name,
        "slug": slug,
        "color": body.color,
        "emoji": body.emoji,
        "is_pinned": body.is_pinned,
        "is_expanded": body.is_expanded,
        "owner_id": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("projects").document(project_id).set(data)
    return _doc_to_response(project_id, data)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Update a project's metadata.  Only the owning user may update."""
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", project_id):
        raise HTTPException(status_code=422, detail="Invalid project ID format.")
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    updates = body.model_dump(exclude_unset=True)

    # Ensure new slug is unique among this user's projects
    if "slug" in updates:
        existing_slugs = _get_owner_slugs(current_user.id, db, exclude_id=project_id)
        updates["slug"] = _unique_slug(updates["slug"], existing_slugs)

    updates["updated_at"] = datetime.now(timezone.utc)
    doc_ref.update(updates)

    merged = {**(doc.to_dict() or {}), **updates}
    return _doc_to_response(project_id, merged)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Delete a project.  Only the owning user may delete."""
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", project_id):
        raise HTTPException(status_code=422, detail="Invalid project ID format.")
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists or (doc.to_dict() or {}).get("owner_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.collection("projects").document(project_id).delete()