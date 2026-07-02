import asyncio
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, HTTPException, Query,
    WebSocket, WebSocketDisconnect, status,
)
from sqlmodel import Session, desc, select

from ...database import engine, get_session
from ...deps import Actor, get_current_actor
from ...models import BotAccount, ChatMessage, User
from ...schemas import ChatContact, ChatLastMessage, ChatMessageCreate, ChatMessageResponse

router = APIRouter(tags=["v1-messages"])


# ── In-memory managers ────────────────────────────────────────────────────────

class _RoomManager:
    """Manages WebSocket connections per chat room."""

    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self._rooms.setdefault(room_id, []).append(ws)

    def disconnect(self, room_id: str, ws: WebSocket):
        try:
            self._rooms.get(room_id, []).remove(ws)
        except ValueError:
            pass

    async def broadcast(self, room_id: str, payload: dict):
        for ws in list(self._rooms.get(room_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                pass


class _NotifyManager:
    """Manages per-user notification WebSocket connections."""

    def __init__(self):
        self._users: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self._users.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        try:
            self._users.get(user_id, []).remove(ws)
        except ValueError:
            pass

    async def notify(self, user_id: str, event: dict):
        for ws in list(self._users.get(user_id, [])):
            try:
                await ws.send_json(event)
            except Exception:
                pass


_room_manager = _RoomManager()
_notify_manager = _NotifyManager()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _actor_id(actor: Actor) -> str:
    return str(actor.id)


def _actor_name(actor: Actor) -> str:
    return actor.name


def _actor_type(actor: Actor) -> str:
    return "bot" if isinstance(actor, BotAccount) else "user"


def _validate_room(room_id: str, actor_id: str) -> None:
    parts = room_id.split("_", 1)
    if len(parts) != 2 or actor_id not in parts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant of this room",
        )


def _other_id(room_id: str, actor_id: str) -> str:
    parts = room_id.split("_", 1)
    return parts[1] if parts[0] == actor_id else parts[0]


def _msg_to_dict(msg: ChatMessage) -> dict:
    return {
        "id": str(msg.id),
        "room_id": msg.room_id,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender_name,
        "sender_type": msg.sender_type,
        "text": msg.text,
        "created_at": msg.created_at.isoformat(),
    }


def _fire_dm_webhook_sync(
    room_id: str, sender_id: str, sender_name: str, sender_type: str, text: str,
) -> None:
    from ...webhooks import fire_webhooks
    with Session(engine) as session:
        fire_webhooks(
            "message.received",
            {"room_id": room_id, "sender": {"id": sender_id, "name": sender_name, "type": sender_type}, "text": text},
            session,
        )


async def _get_actor_from_token(token: str, session: Session) -> Actor:
    from ...security import decode_token, hash_api_key

    if token.startswith("wms_live_"):
        key_hash = hash_api_key(token)
        bot = session.exec(select(BotAccount).where(BotAccount.key_hash == key_hash)).first()
        if not bot or not bot.is_active:
            raise ValueError("Invalid API key")
        return bot

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise ValueError("Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid token")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise ValueError("User not found")
    return user


async def _deliver_message(
    msg: ChatMessage,
    actor_id: str,
    session: Session,
    bg: Optional[BackgroundTasks] = None,
) -> None:
    """Broadcast to room + notify recipient + fire bot webhook."""
    payload = {"type": "message", "data": _msg_to_dict(msg)}
    await _room_manager.broadcast(msg.room_id, payload)

    recipient_id = _other_id(msg.room_id, actor_id)

    # Notify recipient user via notification WS
    try:
        recipient_user = session.get(User, uuid.UUID(recipient_id))
        if recipient_user:
            notify_event = {
                "type": "new_message",
                "room_id": msg.room_id,
                "contact_id": actor_id,
                "sender_name": msg.sender_name,
                "text": msg.text,
            }
            await _notify_manager.notify(recipient_id, notify_event)
    except (ValueError, AttributeError):
        pass

    # Fire webhook if recipient is a bot
    try:
        recipient_bot = session.exec(
            select(BotAccount).where(BotAccount.id == uuid.UUID(recipient_id))
        ).first()
        if recipient_bot:
            fire_fn = lambda: _fire_dm_webhook_sync(
                msg.room_id, actor_id, msg.sender_name, msg.sender_type, msg.text,
            )
            if bg is not None:
                bg.add_task(fire_fn)
            else:
                asyncio.create_task(asyncio.to_thread(fire_fn))
    except (ValueError, AttributeError):
        pass


# ── REST Endpoints ────────────────────────────────────────────────────────────

def _last_message(room_id: str, session: Session) -> Optional[ChatLastMessage]:
    msg = session.exec(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(1)
    ).first()
    if msg:
        return ChatLastMessage(text=msg.text, created_at=msg.created_at)
    return None


@router.get("/messages/contacts", response_model=List[ChatContact])
def get_contacts(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    actor_id = _actor_id(actor)
    contacts: List[ChatContact] = []
    for u in session.exec(select(User).where(User.is_active == True)).all():
        if str(u.id) == actor_id:
            continue
        room_id = "_".join(sorted([actor_id, str(u.id)]))
        contacts.append(ChatContact(
            id=str(u.id), name=u.name, type="user", is_active=u.is_active,
            last_message=_last_message(room_id, session),
        ))
    for b in session.exec(select(BotAccount).where(BotAccount.is_active == True)).all():
        if isinstance(actor, BotAccount) and str(b.id) == actor_id:
            continue
        room_id = "_".join(sorted([actor_id, str(b.id)]))
        contacts.append(ChatContact(
            id=str(b.id), name=b.name, type="bot", is_active=b.is_active,
            last_message=_last_message(room_id, session),
        ))
    # Sort by last message time desc; strip tz so naive/aware comparison never raises
    def _sort_key(c: ChatContact):
        if c.last_message:
            dt = c.last_message.created_at
            return dt.replace(tzinfo=None) if dt.tzinfo else dt
        return datetime.min

    contacts.sort(key=_sort_key, reverse=True)
    return contacts


@router.get("/messages/{room_id}", response_model=List[ChatMessageResponse])
def get_messages(
    room_id: str,
    limit: int = Query(default=50, le=200),
    before: Optional[str] = Query(default=None),
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    _validate_room(room_id, _actor_id(actor))
    q = select(ChatMessage).where(ChatMessage.room_id == room_id)
    if before:
        try:
            ref = session.get(ChatMessage, uuid.UUID(before))
            if ref:
                q = q.where(ChatMessage.created_at < ref.created_at)
        except (ValueError, AttributeError):
            pass
    msgs = session.exec(q.order_by(desc(ChatMessage.created_at)).limit(limit)).all()
    return list(reversed(msgs))


@router.post("/messages/{room_id}", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: str,
    body: ChatMessageCreate,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    actor_id = _actor_id(actor)
    _validate_room(room_id, actor_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(text) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 chars)")

    msg = ChatMessage(
        room_id=room_id,
        sender_id=actor_id,
        sender_name=_actor_name(actor),
        sender_type=_actor_type(actor),
        text=text,
        created_at=datetime.now(timezone.utc),
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)

    await _deliver_message(msg, actor_id, session, background_tasks)
    return msg


# ── WebSocket: Chat Room ──────────────────────────────────────────────────────

@router.websocket("/ws/chat/{room_id}")
async def websocket_chat(
    room_id: str,
    websocket: WebSocket,
    token: str = Query(...),
):
    with Session(engine) as session:
        try:
            actor = await _get_actor_from_token(token, session)
        except Exception:
            await websocket.close(code=4001)
            return

        actor_id = _actor_id(actor)
        try:
            _validate_room(room_id, actor_id)
        except HTTPException:
            await websocket.close(code=4003)
            return

        actor_name = _actor_name(actor)
        actor_type = _actor_type(actor)

    await _room_manager.connect(room_id, websocket)

    with Session(engine) as session:
        msgs = session.exec(
            select(ChatMessage)
            .where(ChatMessage.room_id == room_id)
            .order_by(desc(ChatMessage.created_at))
            .limit(50)
        ).all()
        await websocket.send_json({"type": "history", "data": [_msg_to_dict(m) for m in reversed(msgs)]})

    try:
        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text or len(text) > 4000:
                continue

            with Session(engine) as session:
                msg = ChatMessage(
                    room_id=room_id,
                    sender_id=actor_id,
                    sender_name=actor_name,
                    sender_type=actor_type,
                    text=text,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(msg)
                session.commit()
                session.refresh(msg)
                await _deliver_message(msg, actor_id, session)

    except WebSocketDisconnect:
        pass
    finally:
        _room_manager.disconnect(room_id, websocket)


# ── WebSocket: Notifications ──────────────────────────────────────────────────

@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: str = Query(...),
):
    with Session(engine) as session:
        try:
            actor = await _get_actor_from_token(token, session)
        except Exception:
            await websocket.close(code=4001)
            return
        if isinstance(actor, BotAccount):
            await websocket.close(code=4003)
            return
        user_id = str(actor.id)

    await _notify_manager.connect(user_id, websocket)
    try:
        # Keep alive — client just listens; send pings to detect disconnect
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        _notify_manager.disconnect(user_id, websocket)