"""FastAPI dependency functions for authentication and authorization.

Two actor types are supported:
  - ``User``       — a human user authenticated via Firebase ID token
  - ``BotAccount`` — a programmatic actor authenticated via ``wms_live_*`` API key

The ``get_current_actor`` dependency resolves either type from the inbound
``Authorization`` header and returns a typed union (``Actor``).

The ``get_current_user`` dependency is a strict subset — it raises 403 if the
actor is a bot, for endpoints that require a human user.

The ``require_permission`` factory returns a dependency that additionally
checks RBAC permissions against the ``role_permissions`` Firestore collection.

Performance notes
-----------------
- ``_user_cache``       — TTL-based in-memory cache for Firestore user docs (60 s).
                          Eliminates one gRPC round-trip per authenticated request.
- ``_permission_cache`` — Lifetime cache for role→permissions mapping.
                          Populated at startup via ``_prewarm_permission_cache()``.
"""

import time
from typing import Dict, List, Tuple, Union

from fastapi import Depends, HTTPException, Request, status
from firebase_admin import firestore as fb_firestore

from .firebase import get_db
from .firebase_auth import verify_firebase_token
from .models import BotAccount, User
from .security import hash_api_key

# Union type for all valid actors
Actor = Union[User, BotAccount]

# In-memory permission cache: role → list[str]
# Invalidated on every process restart.  Acceptable for a low-churn permission
# table; a TTL-based cache could be added if hot-reload is ever required.
# ---------------------------------------------------------------------------
# User cache (TTL = 60 s per uid)
# ---------------------------------------------------------------------------
# Eliminates the Firestore user-doc GET on every authenticated request.
# Each entry is (User, timestamp).  After _USER_TTL seconds the entry is
# considered stale and the doc is re-fetched.
_user_cache: Dict[str, Tuple[User, float]] = {}
_USER_TTL: float = 60.0  # seconds

# ---------------------------------------------------------------------------
# Permission cache (process-lifetime)
# ---------------------------------------------------------------------------
# Populated at startup by prewarm_permission_cache() in main.py.
# Invalidated by calling _permission_cache.clear() after any permission write.
_permission_cache: Dict[str, List[str]] = {}


def _extract_bearer_token(request: Request) -> str:
    """Extract the raw token from the Authorization header or ?token= query param.

    Accepts both ``Bearer <token>`` and bare ``<token>`` forms so that the
    API key path (``wms_live_*``) can be passed without a scheme prefix.

    Also accepts a ``?token=`` query parameter as a fallback.  This allows
    browser-native elements (``<img>``, ``<video>``) that cannot set request
    headers to load authenticated resources by appending the Firebase ID token
    to the URL:  ``/api/v1/files/raw/{id}?token=<firebase-id-token>``
    """
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    if header:
        return header.strip()
    # Fallback: token passed as a query parameter (for <img src="...?token=...">)
    token_param = request.query_params.get("token", "").strip()
    if token_param:
        return token_param
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authorization header missing.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _user_from_doc(doc_data: dict, uid: str) -> User:
    """Build a ``User`` instance from a Firestore document dict."""
    from datetime import datetime, timezone

    created_raw = doc_data.get("created_at")
    if isinstance(created_raw, datetime):
        created_at = created_raw
    else:
        created_at = datetime.now(timezone.utc)

    return User(
        id=uid,
        name=doc_data.get("name", ""),
        email=doc_data.get("email", ""),
        role=doc_data.get("role", "member"),
        is_admin=doc_data.get("is_admin", False),
        is_active=doc_data.get("is_active", True),
        bio=doc_data.get("bio"),
        avatar_url=doc_data.get("avatar_url"),
        created_at=created_at,
        updated_at=doc_data.get("updated_at"),
    )


def _bot_from_doc(doc_data: dict, doc_id: str) -> BotAccount:
    """Build a ``BotAccount`` instance from a Firestore document dict."""
    from datetime import datetime, timezone

    created_raw = doc_data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)

    return BotAccount(
        id=doc_id,
        name=doc_data.get("name", ""),
        description=doc_data.get("description"),
        key_prefix=doc_data.get("key_prefix", ""),
        key_hash=doc_data.get("key_hash", ""),
        is_active=doc_data.get("is_active", True),
        owner_id=doc_data.get("owner_id", ""),
        created_at=created_at,
        last_used_at=doc_data.get("last_used_at"),
    )


def _lookup_user(uid: str, db: fb_firestore.Client) -> User:
    """Return the User for the given Firebase UID, using a 60-second TTL cache.

    The cache avoids a Firestore round-trip on every authenticated request.
    A stale or absent cache entry triggers a single Firestore GET; the result
    is stored for the next _USER_TTL seconds.

    Raises HTTP 401 if the document does not exist or the user is inactive.
    """
    now = time.time()
    cached = _user_cache.get(uid)
    if cached is not None:
        user, ts = cached
        if now - ts < _USER_TTL:
            return user

    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        # Remove any stale cache entry so the next request retries cleanly
        _user_cache.pop(uid, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    data = doc.to_dict() or {}
    user = _user_from_doc(data, uid)
    if not user.is_active:
        _user_cache.pop(uid, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive.",
        )
    _user_cache[uid] = (user, now)
    return user


def _lookup_bot(api_key: str, db: fb_firestore.Client) -> BotAccount:
    """Find a bot account by matching the SHA-256 hash of the inbound key."""
    key_hash = hash_api_key(api_key)
    docs = (
        db.collection("bot_accounts")
        .where("key_hash", "==", key_hash)
        .where("is_active", "==", True)
        .limit(1)
        .stream()
    )
    doc = next(docs, None)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )
    return _bot_from_doc(doc.to_dict() or {}, doc.id)


def evict_user_cache(uid: str) -> None:
    """Remove a single user from the in-memory TTL cache.

    Call this after any write that changes a user's Firestore profile so that
    the next request for that user reflects the updated state immediately
    rather than waiting for the 60-second TTL to expire.
    """
    _user_cache.pop(uid, None)


def clear_permission_cache() -> None:
    """Invalidate the entire role-permission cache.

    Call this whenever a user's role changes so that role-based permission
    lookups are re-fetched from Firestore on the next request.
    """
    _permission_cache.clear()


def get_current_actor(
    request: Request,
    db: fb_firestore.Client = Depends(get_db),
) -> Actor:
    """Resolve the inbound request to a ``User`` or ``BotAccount``.

    Resolution order:
      1. If the token starts with ``wms_live_``, treat it as an API key and
         look up the matching ``BotAccount`` in Firestore.
      2. Otherwise, verify it as a Firebase ID token and look up the ``User``.
    """
    token = _extract_bearer_token(request)
    if token.startswith("wms_live_"):
        return _lookup_bot(token, db)
    uid = verify_firebase_token(token)
    return _lookup_user(uid, db)


def get_current_user(
    actor: Actor = Depends(get_current_actor),
) -> User:
    """Require the actor to be a human ``User`` (not a bot).

    Raises HTTP 403 if a bot account is used on an endpoint that only
    accepts human users.
    """
    if not isinstance(actor, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires a user account, not a bot.",
        )
    return actor


def _get_role_permissions(role: str, db: fb_firestore.Client) -> List[str]:
    """Return the list of permission strings granted to the given role.

    Results are cached in the module-level ``_permission_cache`` dict for the
    lifetime of the process.  Call ``_permission_cache.clear()`` to invalidate
    (e.g. after a permission change).
    """
    if role in _permission_cache:
        return _permission_cache[role]

    docs = db.collection("role_permissions").where("role", "==", role).stream()
    permissions = [doc.to_dict().get("permission", "") for doc in docs]
    _permission_cache[role] = permissions
    return permissions


def prewarm_permission_cache(db: fb_firestore.Client) -> None:
    """Pre-populate _permission_cache for all known roles at startup.

    Called once from main.py during the lifespan startup event so that the
    first real request never pays the cold-start cost of fetching permissions
    from Firestore.
    """
    # Fetch every role from custom_roles and prime the cache
    role_docs = db.collection("custom_roles").stream()
    roles = [doc.id for doc in role_docs]

    for role in roles:
        if role not in _permission_cache:
            _get_role_permissions(role, db)


def require_permission(permission: str):
    """Factory that returns a FastAPI dependency enforcing a specific RBAC permission.

    Usage::

        @router.get("/something")
        def endpoint(user: User = Depends(require_permission("tasks:view"))):
            ...
    """
    def _check(
        actor: Actor = Depends(get_current_actor),
        db: fb_firestore.Client = Depends(get_db),
    ) -> User:
        if not isinstance(actor, User):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint requires a user account.",
            )
        # Admins bypass all permission checks
        if actor.is_admin or actor.role == "admin":
            return actor
        perms = _get_role_permissions(actor.role, db)
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission}' required.",
            )
        return actor

    return _check