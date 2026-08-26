"""Pipelines router — management of pipelines belonging to user-owned projects.

A pipeline belongs to exactly one project.  Users may only access pipelines
whose parent project they own.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import PipelineCreate, PipelineResponse, PipelineUpdate

router = APIRouter(tags=["pipelines"])


def _get_owner_project_ids(owner_id: str, db: firestore.Client) -> set:
    """Return the set of project IDs owned by the given user."""
    docs = db.collection("projects").where("owner_id", "==", owner_id).stream()
    return {doc.id for doc in docs}


def _doc_to_response(doc_id: str, data: dict) -> PipelineResponse:
    """Convert a Firestore pipeline document dict to a ``PipelineResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return PipelineResponse(
        id=doc_id,
        project_id=data.get("project_id", ""),
        name=data.get("name", ""),
        created_at=created_at,
    )


@router.get("", response_model=List[PipelineResponse])
def list_pipelines(
    project_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Return pipelines owned by the current user, optionally filtered by project."""
    owned_ids = _get_owner_project_ids(current_user.id, db)

    if project_id:
        if project_id not in owned_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        docs = (
            db.collection("pipelines")
            .where("project_id", "==", project_id)
            .order_by("created_at")
            .stream()
        )
    else:
        # Return all pipelines across owned projects
        if not owned_ids:
            return []
        docs = (
            db.collection("pipelines")
            .where("project_id", "in", list(owned_ids))
            .order_by("created_at")
            .stream()
        )

    return [_doc_to_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    body: PipelineCreate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Create a new pipeline inside a project owned by the current user."""
    owned_ids = _get_owner_project_ids(current_user.id, db)
    if body.project_id not in owned_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project not found.")

    pipeline_id = body.id or f"pipe-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    data = {
        "project_id": body.project_id,
        "name": body.name,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("pipelines").document(pipeline_id).set(data)
    return _doc_to_response(pipeline_id, data)


@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(
    pipeline_id: str,
    body: PipelineUpdate,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Update a pipeline's name.  User must own the parent project."""
    doc_ref = db.collection("pipelines").document(pipeline_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found.")

    data = doc.to_dict() or {}
    owned_ids = _get_owner_project_ids(current_user.id, db)
    if data.get("project_id") not in owned_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pipeline not found.")

    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc_ref.update(updates)

    merged = {**data, **updates}
    return _doc_to_response(pipeline_id, merged)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Delete a pipeline.  User must own the parent project."""
    doc = db.collection("pipelines").document(pipeline_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found.")

    data = doc.to_dict() or {}
    owned_ids = _get_owner_project_ids(current_user.id, db)
    if data.get("project_id") not in owned_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pipeline not found.")

    db.collection("pipelines").document(pipeline_id).delete()