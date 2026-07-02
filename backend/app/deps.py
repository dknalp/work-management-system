from typing import Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .database import get_session
from .models import BotAccount, RolePermission, User
from .security import decode_token, hash_api_key

bearer_scheme = HTTPBearer()

# Role-based in-memory permission cache: role -> frozenset[permission]
# Invalidated when permissions are updated via PUT /admin/permissions
_permission_cache: dict[str, frozenset[str]] = {}


def invalidate_permission_cache(role: Optional[str] = None) -> None:
    """Call after any RolePermission write to keep cache coherent."""
    if role:
        _permission_cache.pop(role, None)
    else:
        _permission_cache.clear()


def _get_role_permissions(role: str, session: Session) -> frozenset[str]:
    if role not in _permission_cache:
        rows = session.exec(
            select(RolePermission).where(RolePermission.role == role)
        ).all()
        _permission_cache[role] = frozenset(r.permission for r in rows)
    return _permission_cache[role]


def is_admin(user: User) -> bool:
    return user.is_admin or user.role == "admin"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_permission(permission: str):
    def dependency(
        current_user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> User:
        if is_admin(current_user):
            return current_user
        perms = _get_role_permissions(current_user.role, session)
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu işlem için yetkiniz yok",
            )
        return current_user

    return dependency


# ── Bot / API-key auth ────────────────────────────────────────────────────────

Actor = Union[User, BotAccount]

_optional_bearer = HTTPBearer(auto_error=False)


def get_current_actor(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    session: Session = Depends(get_session),
) -> Actor:
    """Accept both JWT (user) and API key (bot) tokens.

    - JWT tokens start with the standard HS256 payload.
    - API keys start with 'wms_live_'.
    Returns either a User or a BotAccount.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    if token.startswith("wms_live_"):
        key_hash = hash_api_key(token)
        bot = session.exec(
            select(BotAccount).where(BotAccount.key_hash == key_hash)
        ).first()
        if not bot or not bot.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
            )
        from datetime import datetime, timezone
        bot.last_used_at = datetime.now(timezone.utc)
        session.add(bot)
        session.commit()
        return bot

    # Fall back to JWT user auth
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user