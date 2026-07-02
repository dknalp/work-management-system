import time
from typing import Dict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ...database import get_session
from ...deps import Actor, get_current_actor
from ...models import User

router = APIRouter(prefix="/presence", tags=["v1-presence"])

# actor_id (str) -> last heartbeat timestamp
_heartbeats: Dict[str, float] = {}
_ONLINE_THRESHOLD = 60.0  # seconds


@router.post("/heartbeat", status_code=204)
def heartbeat(actor: Actor = Depends(get_current_actor)):
    _heartbeats[str(actor.id)] = time.time()


@router.get("/online")
def get_online(
    actor: Actor = Depends(get_current_actor),
    session: Session = Depends(get_session),
):
    cutoff = time.time() - _ONLINE_THRESHOLD
    online_ids = {uid for uid, ts in _heartbeats.items() if ts >= cutoff}

    result = []
    for u in session.exec(select(User).where(User.is_active == True)).all():
        if str(u.id) in online_ids:
            result.append({
                "id": str(u.id),
                "name": u.name,
                "email": u.email,
                "type": "user",
            })
    return result
