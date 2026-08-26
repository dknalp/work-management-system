"""Chat message routes and WebSocket connection manager for /api/v1/chat.

Messages are persisted in the ``chat_messages`` Firestore collection.
The WebSocket endpoint allows real-time delivery; historical messages are
retrieved via the REST endpoint.
"""

import asyncio
import json
import logging
import time as _time
import uuid
from collections import defaultdict
from typing import Dict, List, Set

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from firebase_admin import firestore

from ...deps import Actor, get_current_actor, get_current_user
from ...firebase import get_db
from ...firebase_auth import verify_firebase_token
from ...models import BotAccount, User

router = APIRouter(prefix="/chat", tags=["v1-chat"])

_logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory WebSocket connection manager
# ---------------------------------------------------------------------------

class _ChatManager:
    """Manages WebSocket connections keyed by room ID."""

    def __init__(self):
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[room_id].add(ws)

    def disconnect(self, room_id: str, ws: WebSocket) -> None:
        self._rooms[room_id].discard(ws)

    async def broadcast(self, room_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(room_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._rooms[room_id].discard(ws)


_manager = _ChatManager()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/contacts")
def list_contacts(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
) -> list[dict]:
    """Return all active users the caller can open a DM conversation with.

    Returns every user record except the caller themselves, so the chat widget
    can populate its contacts list.  The caller's own UID is derived from the
    Actor dependency (works for both Firebase users and bot API keys).
    """
    caller_id = str(actor.id)
    docs = db.collection("users").where("is_active", "==", True).stream()
    contacts = []
    for doc in docs:
        if doc.id == caller_id:
            continue
        d = doc.to_dict() or {}
        contacts.append(
            {
                "id": doc.id,
                "name": d.get("name", ""),
                "email": d.get("email", ""),
                "avatar_url": d.get("avatar_url"),
                "role": d.get("role", "member"),
            }
        )
    return contacts


@router.get("/{room_id}/messages")
def get_messages(
    room_id: str,
    limit: int = Query(default=50, le=200),
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
) -> list[dict]:
    """Return recent chat messages for a room, oldest first."""
    docs = (
        db.collection("chat_messages")
        .where("room_id", "==", room_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    messages = []
    for doc in docs:
        d = doc.to_dict() or {}
        messages.append({
            "id": doc.id,
            "room_id": d.get("room_id", ""),
            "sender_id": d.get("sender_id", ""),
            "sender_name": d.get("sender_name", ""),
            "content": d.get("content", ""),
            "created_at": d.get("created_at", "").isoformat() if hasattr(d.get("created_at", ""), "isoformat") else str(d.get("created_at", "")),
        })
    # Reverse so oldest messages come first
    return list(reversed(messages))


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

async def _authenticate_ws(token: str, db: firestore.Client) -> User | None:
    """Authenticate a WebSocket connection from its query token.

    Returns the User or None if authentication fails.
    """
    try:
        uid = verify_firebase_token(token)
        doc = db.collection("users").document(uid).get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        from datetime import datetime, timezone
        created_raw = data.get("created_at")
        created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
        return User(
            id=uid,
            name=data.get("name", ""),
            email=data.get("email", ""),
            role=data.get("role", "member"),
            is_admin=data.get("is_admin", False),
            is_active=data.get("is_active", True),
            created_at=created_at,
        )
    except Exception as exc:
        _logger.warning(
            "WebSocket auth failure: %s",
            exc,
            extra={"token_prefix": token[:20] if token else "none"},
        )
        return None


@router.websocket("/{room_id}/ws")
async def chat_websocket(
    room_id: str,
    websocket: WebSocket,
    token: str = Query(...),
    db: firestore.Client = Depends(get_db),
):
    """WebSocket connection for real-time chat in a room.

    The client authenticates by passing a Firebase ID token as the ``token``
    query parameter.  Messages received from the client are persisted to
    Firestore and broadcast to all connected clients in the room.
    """
    user = await _authenticate_ws(token, db)
    if user is None:
        await websocket.close(code=4001)
        return

    await _manager.connect(room_id, websocket)

    # Token-bucket rate limiter: allows _MSG_BURST messages immediately, then
    # refills at _MSG_RATE_LIMIT messages per second to cap sustained throughput.
    _MSG_RATE_LIMIT = 5    # max sustained messages per second per connection
    _MSG_BURST = 20        # initial burst allowance (token count ceiling)
    _msg_tokens = float(_MSG_BURST)
    _last_refill = _time.monotonic()

    try:
        while True:
            raw = await websocket.receive_text()

            # Drop messages exceeding the size cap to prevent memory exhaustion.
            if len(raw) > 4096:
                continue

            # Refill tokens proportional to elapsed time, then consume one token.
            _now = _time.monotonic()
            _elapsed = _now - _last_refill
            _last_refill = _now
            _msg_tokens = min(_MSG_BURST, _msg_tokens + _elapsed * _MSG_RATE_LIMIT)
            if _msg_tokens < 1:
                # 4029 is a custom close code meaning Too Many Requests.
                await websocket.close(code=4029)
                return
            _msg_tokens -= 1

            try:
                payload = json.loads(raw)
            except Exception:
                continue

            content = (payload.get("content") or "").strip()
            if not content:
                continue

            from datetime import datetime, timezone
            msg_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            msg_data = {
                "room_id": room_id,
                "sender_id": user.id,
                "sender_name": user.name,
                "content": content,
                "created_at": now,
            }
            db.collection("chat_messages").document(msg_id).set(msg_data)

            broadcast_payload = {
                "id": msg_id,
                "room_id": room_id,
                "sender_id": user.id,
                "sender_name": user.name,
                "content": content,
                "created_at": now.isoformat(),
            }
            await _manager.broadcast(room_id, broadcast_payload)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        _manager.disconnect(room_id, websocket)