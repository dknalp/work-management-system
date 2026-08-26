"""Agent configuration CRUD router — ``/api/v1/agents``.

Owns the ``agent_configs`` Firestore collection.  Each document stores the
full visual-builder state for one AI agent as an opaque ``config`` blob — the
backend does not inspect the config internals, it only persists and returns them.

Top-level indexed fields (``name``, ``status``, ``owner_id``) are stored as
first-class document fields so they can be queried without loading the blob.
All other builder state lives inside ``config``.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.firebase import get_db
from app.models import User

router = APIRouter(prefix="/agents", tags=["agents"])

_COLLECTION = "agent_configs"


# ── Schemas ───────────────────────────────────────────────────────────────────


class AgentConfigCreate(BaseModel):
    """Request body for creating a new agent configuration.

    ``config`` carries the full AIAgent payload from the frontend builder.
    The backend stores it verbatim and returns it unchanged.
    """

    name: str = Field(..., max_length=256)
    status: str = Field("draft", pattern="^(draft|active|inactive)$")
    config: dict[str, Any] = Field(
        default_factory=dict,
        description="Full AIAgent payload from the frontend builder.",
    )


class AgentConfigUpdate(BaseModel):
    """Request body for patching an agent configuration.

    All fields are optional — only provided fields are updated.
    """

    name: Optional[str] = Field(None, max_length=256)
    status: Optional[str] = Field(None, pattern="^(draft|active|inactive)$")
    config: Optional[dict[str, Any]] = None


class AgentConfigResponse(BaseModel):
    """Full agent configuration document returned by all endpoints."""

    id: str
    owner_id: str
    name: str
    status: str
    config: dict[str, Any]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _doc_to_response(doc_id: str, data: dict[str, Any]) -> AgentConfigResponse:
    """Convert a raw Firestore document dict to an AgentConfigResponse."""
    return AgentConfigResponse(
        id=doc_id,
        owner_id=data.get("owner_id", ""),
        name=data.get("name", ""),
        status=data.get("status", "draft"),
        config=data.get("config", {}),
        created_at=str(data.get("created_at", _now_iso())),
        updated_at=str(data.get("updated_at", _now_iso())),
    )


def _require_owner(data: dict[str, Any], user: User) -> None:
    """Raise 403 if the calling user does not own this agent config."""
    if data.get("owner_id") != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this agent configuration.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[AgentConfigResponse])
async def list_agent_configs(
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> list[AgentConfigResponse]:
    """Return all agent configurations owned by the current user."""
    docs = (
        db.collection(_COLLECTION)
        .where("owner_id", "==", current_user.id)
        .stream()
    )
    results = [_doc_to_response(doc.id, doc.to_dict()) for doc in docs]
    # Sort in Python to avoid requiring a Firestore composite index on
    # (owner_id, created_at).
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


@router.post("", response_model=AgentConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_config(
    body: AgentConfigCreate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> AgentConfigResponse:
    """Create a new agent configuration document in Firestore."""
    now = _now_iso()
    doc_data: dict[str, Any] = {
        "name": body.name,
        "status": body.status,
        "config": body.config,
        "owner_id": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    ref = db.collection(_COLLECTION).document()
    ref.set(doc_data)
    return _doc_to_response(ref.id, doc_data)


@router.get("/{agent_id}", response_model=AgentConfigResponse)
async def get_agent_config(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> AgentConfigResponse:
    """Return a single agent configuration by ID."""
    doc = db.collection(_COLLECTION).document(agent_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Agent configuration not found.")
    data = doc.to_dict()
    _require_owner(data, current_user)
    return _doc_to_response(doc.id, data)


@router.patch("/{agent_id}", response_model=AgentConfigResponse)
async def update_agent_config(
    agent_id: str,
    body: AgentConfigUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> AgentConfigResponse:
    """Patch an existing agent configuration — only provided fields are updated."""
    ref = db.collection(_COLLECTION).document(agent_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Agent configuration not found.")
    data = doc.to_dict()
    _require_owner(data, current_user)

    updates: dict[str, Any] = {
        k: v
        for k, v in body.model_dump(exclude_unset=True).items()
        if v is not None
    }
    updates["updated_at"] = _now_iso()
    ref.update(updates)

    return _doc_to_response(agent_id, {**data, **updates})


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent_config(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> None:
    """Permanently delete an agent configuration."""
    ref = db.collection(_COLLECTION).document(agent_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Agent configuration not found.")
    _require_owner(doc.to_dict(), current_user)
    ref.delete()