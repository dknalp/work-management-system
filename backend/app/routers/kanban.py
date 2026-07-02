from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from ..database import get_session
from ..deps import get_current_user
from ..models import KanbanBoard, User
from ..schemas import KanbanBoardState

router = APIRouter(prefix="/kanban", tags=["kanban"])


@router.get("/{pipeline_id}", response_model=KanbanBoardState)
def get_board(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    board = session.get(KanbanBoard, pipeline_id)
    if not board:
        return KanbanBoardState(pipeline_id=pipeline_id, state=None)
    return KanbanBoardState(pipeline_id=board.pipeline_id, state=board.state, updated_at=board.updated_at)


@router.put("/{pipeline_id}", response_model=KanbanBoardState, status_code=status.HTTP_200_OK)
def save_board(
    pipeline_id: str,
    body: KanbanBoardState,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    board = session.get(KanbanBoard, pipeline_id)
    if board:
        board.state = body.state
        board.updated_at = datetime.now(timezone.utc)
    else:
        board = KanbanBoard(
            pipeline_id=pipeline_id,
            state=body.state,
            updated_at=datetime.now(timezone.utc),
        )
    session.add(board)
    session.commit()
    session.refresh(board)
    return KanbanBoardState(pipeline_id=board.pipeline_id, state=board.state, updated_at=board.updated_at)
