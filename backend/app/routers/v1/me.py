from fastapi import APIRouter, Depends

from ...deps import Actor, get_current_actor
from ...models import BotAccount, User

router = APIRouter(prefix="/me", tags=["v1-me"])


@router.get("")
def get_me(actor: Actor = Depends(get_current_actor)):
    if isinstance(actor, BotAccount):
        return {
            "type": "bot",
            "id": str(actor.id),
            "name": actor.name,
            "description": actor.description,
            "key_prefix": actor.key_prefix,
            "is_active": actor.is_active,
            "created_at": actor.created_at.isoformat(),
            "last_used_at": actor.last_used_at.isoformat() if actor.last_used_at else None,
        }
    return {
        "type": "user",
        "id": str(actor.id),
        "name": actor.name,
        "email": actor.email,
        "role": actor.role,
        "is_admin": actor.is_admin,
        "is_active": actor.is_active,
        "created_at": actor.created_at.isoformat(),
    }
