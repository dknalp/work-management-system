"""Presence routes for /api/v1/presence and the WebSocket notification channel.

HTTP endpoints:
  POST /presence/heartbeat  — mark the current actor as online
  GET  /presence/online     — list currently online users

WebSocket endpoint:
  WS /ws/notifications      — persistent notification channel for the current user.
                              The client must pass ?token=<firebase_id_token> as a
                              query parameter.  The server verifies the token, then
                              keeps the connection alive, sending a ``ping`` JSON
                              frame every 30 seconds.  Real push notifications can
                              be appended here later without changing the client
                              protocol.

Online tracking is done via an in-memory heartbeat store.  Online users are those
whose last heartbeat was within ``_ONLINE_THRESHOLD`` seconds.
"""

import asyncio
import time
from typing import Dict

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from firebase_admin import firestore

from ...deps import Actor, get_current_actor
from ...firebase import get_db
from ...firebase_auth import verify_firebase_token

router = APIRouter(prefix="/presence", tags=["v1-presence"])

# actor_id (str) → last heartbeat Unix timestamp
_heartbeats: Dict[str, float] = {}
_ONLINE_THRESHOLD = 60.0  # seconds


@router.post("/heartbeat", status_code=204)
def heartbeat(actor: Actor = Depends(get_current_actor)):
    """Record a heartbeat for the current actor to mark them as online."""
    _heartbeats[str(actor.id)] = time.time()


@router.get("/online")
def get_online(
    actor: Actor = Depends(get_current_actor),
    db: firestore.Client = Depends(get_db),
) -> list[dict]:
    """Return the list of currently online users.

    A user is considered online if they sent a heartbeat within the last
    ``_ONLINE_THRESHOLD`` seconds.
    """
    cutoff = time.time() - _ONLINE_THRESHOLD
    online_ids = {uid for uid, ts in _heartbeats.items() if ts >= cutoff}

    result = []
    for doc in db.collection("users").where("is_active", "==", True).stream():
        if doc.id in online_ids:
            data = doc.to_dict() or {}
            result.append({
                "id": doc.id,
                "name": data.get("name", ""),
                "email": data.get("email", ""),
                "type": "user",
            })
    return result


# ── WebSocket notification channel ────────────────────────────────────────────

# Separate router for the /ws prefix so it mounts at /api/v1/ws/notifications
ws_router = APIRouter(prefix="/ws", tags=["v1-notifications"])

_PING_INTERVAL = 30  # seconds between keepalive pings


@ws_router.websocket("/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(default=""),
) -> None:
    """WebSocket endpoint for real-time notifications.

    Clients connect with:
        ws://<host>/api/v1/ws/notifications?token=<firebase_id_token>

    The server:
      1. Verifies the Firebase ID token.  Closes with 4401 if invalid.
      2. Accepts the connection and sends a ``{"type": "connected"}`` frame.
      3. Sends a ``{"type": "ping"}`` frame every 30 seconds to keep the
         connection alive through proxies and mobile radios.
      4. Closes cleanly when the client disconnects.

    Push notifications (e.g. task assignments, mentions) can be sent by
    storing the WebSocket in a shared registry and calling
    ``websocket.send_json(payload)`` from any request handler.
    """
    # Verify the token before accepting so invalid clients see a proper close code
    try:
        uid = verify_firebase_token(token) if token else None
    except Exception:
        uid = None

    if not uid:
        await websocket.close(code=4401)  # 4xxx codes are application-level
        return

    await websocket.accept()
    await websocket.send_json({"type": "connected", "uid": uid})

    try:
        while True:
            # Wait up to _PING_INTERVAL seconds for an incoming message.
            # If none arrives, send a keepalive ping and loop.
            try:
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=_PING_INTERVAL,
                )
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass  # Client closed the connection — nothing to clean up