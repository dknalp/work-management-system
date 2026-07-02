import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import Pipeline, Project, User
from ..schemas import PipelineCreate, PipelineResponse, PipelineUpdate

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


def _user_project_ids(user_id, session: Session) -> set:
    """Return the set of project IDs owned by this user."""
    ids = session.exec(select(Project.id).where(Project.owner_id == user_id)).all()
    return set(ids)


@router.get("", response_model=List[PipelineResponse])
def list_pipelines(
    project_id: str = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    owned = _user_project_ids(current_user.id, session)
    query = select(Pipeline).where(Pipeline.project_id.in_(owned))
    if project_id:
        query = query.where(Pipeline.project_id == project_id)
    return session.exec(query.order_by(Pipeline.created_at.asc())).all()


@router.post("", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    body: PipelineCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    owned = _user_project_ids(current_user.id, session)
    if body.project_id not in owned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project not found")

    pipeline = Pipeline(
        id=f"pipe-{uuid.uuid4().hex[:8]}",
        project_id=body.project_id,
        name=body.name,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(pipeline)
    session.commit()
    session.refresh(pipeline)
    return pipeline


@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(
    pipeline_id: str,
    body: PipelineUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    pipeline = session.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    owned = _user_project_ids(current_user.id, session)
    if pipeline.project_id not in owned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pipeline not found")

    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(pipeline, key, value)
    pipeline.updated_at = datetime.now(timezone.utc)

    session.add(pipeline)
    session.commit()
    session.refresh(pipeline)
    return pipeline


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    pipeline = session.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    owned = _user_project_ids(current_user.id, session)
    if pipeline.project_id not in owned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pipeline not found")
    session.delete(pipeline)
    session.commit()