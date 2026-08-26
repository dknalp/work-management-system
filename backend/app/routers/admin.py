import logging
"""Admin router — user management for admin actors.

Only users with ``is_admin=True`` or ``role='admin'`` may call these endpoints.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as fb_auth
from firebase_admin import firestore

from ..deps import get_current_user, evict_user_cache, clear_permission_cache
from ..firebase import get_db
from ..models import User
from ..schemas import AdminUserUpdate, RegisterRequest, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that enforces admin-only access."""
    if not current_user.is_admin and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def _doc_to_user_response(uid: str, data: dict) -> UserResponse:
    """Convert a Firestore user document dict into a ``UserResponse``."""
    created_raw = data.get("created_at")
    created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
    return UserResponse(
        id=uid,
        email=data.get("email", ""),
        name=data.get("name", ""),
        bio=data.get("bio"),
        avatar_url=data.get("avatar_url"),
        is_active=data.get("is_active", True),
        is_admin=data.get("is_admin", False),
        role=data.get("role", "member"),
        created_at=created_at,
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    admin: User = Depends(get_current_admin),
    db: firestore.Client = Depends(get_db),
):
    """Return all user accounts, most recently created first."""
    docs = db.collection("users").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    return [_doc_to_user_response(doc.id, doc.to_dict() or {}) for doc in docs]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: RegisterRequest,
    admin: User = Depends(get_current_admin),
    db: firestore.Client = Depends(get_db),
):
    """Create a new user account (admin-side creation)."""
    try:
        fb_user = fb_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.name,
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create account. The email may already be in use.",
        )

    now = datetime.now(timezone.utc)
    user_data = {
        "name": body.name,
        "email": body.email,
        "role": "member",
        "is_admin": False,
        "is_active": True,
        "bio": None,
        "avatar_url": None,
        "created_at": now,
        "updated_at": None,
    }
    db.collection("users").document(fb_user.uid).set(user_data)

    # Also create a team member record so the user appears in the team view
    db.collection("team_members").document(fb_user.uid).set({
        "id": fb_user.uid,
        "name": body.name,
        "email": body.email,
        "role": "member",
        "status": "active",
        "joined_at": now.strftime("%Y-%m-%d"),
        "created_at": now,
    })

    return UserResponse(
        id=fb_user.uid,
        email=body.email,
        name=body.name,
        is_active=True,
        is_admin=False,
        role="member",
        created_at=now,
    )


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
def toggle_active(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: firestore.Client = Depends(get_db),
):
    """Activate or deactivate a user account."""
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    data = doc.to_dict() or {}
    new_active = not data.get("is_active", True)
    doc_ref.update({"is_active": new_active, "updated_at": datetime.now(timezone.utc)})

    # Sync the Firebase Auth account's disabled flag so that existing tokens
    # belonging to a deactivated user are rejected at the Auth layer before
    # they reach our Firestore is_active check.  Best-effort: Firestore is
    # already updated above, so a failure here only means the Firebase Auth
    # token keeps working until it expires (~1 h), after which the Firestore
    # check will still block the user.
    try:
        fb_auth.update_user(user_id, disabled=not new_active)
    except Exception as err:
        logger.warning(
            "[admin] toggle_active: Firebase Auth sync failed for user %s: %s",
            user_id,
            err,
        )

    data["is_active"] = new_active
    return _doc_to_user_response(user_id, data)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: AdminUserUpdate,
    admin: User = Depends(get_current_admin),
    db: firestore.Client = Depends(get_db),
):
    """Update a user's role, admin flag, name, or active status."""
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Prevent admins from demoting themselves
    if user_id == admin.id and body.role is not None and body.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself from admin.",
        )

    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    patch = body.model_dump(exclude_unset=True)
    updates.update(patch)

    # Keep is_admin in sync with role
    if body.role == "admin":
        updates["is_admin"] = True
    elif body.role is not None:
        updates["is_admin"] = False

    doc_ref.update(updates)

    # Evict cached user data so subsequent requests see the updated profile.
    evict_user_cache(user_id)
    if "role" in updates:
        # Role change affects permission lookups — invalidate the entire cache.
        clear_permission_cache()

    data = {**(doc.to_dict() or {}), **updates}
    return _doc_to_user_response(user_id, data)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: firestore.Client = Depends(get_db),
):
    """Permanently delete a user account.

    Removes the Firebase Auth record and the Firestore user document.
    Also removes the corresponding team_member document if one exists.
    Admins cannot delete their own account.

    Args:
        user_id: The UID of the user to delete.
        admin: The currently authenticated admin user (injected dependency).
        db: Firestore client (injected dependency).

    Raises:
        400 if the admin attempts to delete their own account.
        404 if no user with the given UID exists in Firestore.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )

    doc_ref = db.collection("users").document(user_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Delete Firebase Auth record; ignore the error if the auth record is already gone.
    try:
        fb_auth.delete_user(user_id)
    except fb_auth.UserNotFoundError:
        pass

    # Remove Firestore documents.
    doc_ref.delete()
    db.collection("team_members").document(user_id).delete()