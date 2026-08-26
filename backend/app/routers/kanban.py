"""Kanban board router — persists and retrieves kanban board state per pipeline.

The board state is an opaque JSON blob (columns, cards, order, etc.) stored as
a single Firestore document keyed by pipeline_id.  There is no schema
validation of the state blob — the frontend is the authority on its shape.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import KanbanBoardState

router = APIRouter(tags=["kanban"])


@router.get("/{pipeline_id}", response_model=KanbanBoardState)
def get_board(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Return the saved kanban board state for the given pipeline.

    Returns an empty state (``state=None``) when no board has been saved yet.
    """
    doc = db.collection("kanban_boards").document(pipeline_id).get()
    if not doc.exists:
        return KanbanBoardState(pipeline_id=pipeline_id, state=None)

    data = doc.to_dict() or {}
    return KanbanBoardState(
        pipeline_id=pipeline_id,
        state=data.get("state"),
        updated_at=data.get("updated_at"),
    )


@router.put("/{pipeline_id}", response_model=KanbanBoardState, status_code=status.HTTP_200_OK)
def save_board(
    pipeline_id: str,
    body: KanbanBoardState,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Persist (upsert) the kanban board state for the given pipeline."""
    now = datetime.now(timezone.utc)
    board_data = {
        "pipeline_id": pipeline_id,
        "state": body.state,
        "updated_at": now,
    }
    db.collection("kanban_boards").document(pipeline_id).set(board_data)
    return KanbanBoardState(pipeline_id=pipeline_id, state=body.state, updated_at=now)