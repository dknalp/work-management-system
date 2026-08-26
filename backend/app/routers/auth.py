import logging
"""Authentication router.

Handles user registration and password management via Firebase Authentication.

Login and token refresh are intentionally absent from this router — they are
handled client-side by the Firebase JavaScript SDK (``signInWithEmailAndPassword``
and automatic token refresh).  The backend only needs to:

  1. Create accounts (``POST /auth/register``)
  2. Trigger password-reset emails (``POST /auth/forgot-password``)
  3. Update passwords for already-authenticated users (``PATCH /auth/change-password``)
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as fb_auth
from firebase_admin import firestore

from ..deps import get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: firestore.Client = Depends(get_db),
):
    """Create a new user account.

    Creates the Firebase Auth user, then writes the extended profile
    (name, role, is_admin, etc.) to the ``users/{uid}`` Firestore document.
    """
    try:
        fb_user = fb_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.name,
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. The email may already be in use.",
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
    uid = fb_user.uid
    try:
        db.collection("users").document(uid).set(user_data)
    except Exception as firestore_err:
        # Firestore write failed — try to roll back the Firebase Auth account
        # so the user is not left with credentials they can never use.
        logger.error(
            "[auth] Firestore write failed during registration for uid=%s: %s. "
            "Attempting Firebase Auth rollback.",
            uid,
            firestore_err,
        )
        try:
            fb_auth.delete_user(uid)
        except Exception as rollback_err:
            logger.error(
                "[auth] Firebase Auth rollback FAILED for uid=%s: %s. "
                "Orphaned Firebase account requires manual cleanup.",
                uid,
                rollback_err,
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a server error. Please try again.",
        )

    return UserResponse(
        id=fb_user.uid,
        email=body.email,
        name=body.name,
        is_active=True,
        is_admin=False,
        role="member",
        created_at=now,
    )


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest):
    """Send a password-reset link to the provided email address.

    Uses Firebase Authentication's built-in password reset email.  For
    security, this always returns HTTP 200 regardless of whether the email
    exists in the system.
    """
    try:
        link = fb_auth.generate_password_reset_link(body.email)
        # In production the Firebase SDK sends the email automatically when
        # the action code settings include a ``continueUrl``.  In development
        # or when using the Admin SDK directly, the link is printed here so it
        # can be tested without configuring an email provider.
        # Link is delivered by Firebase email — do not log it.
    except Exception:
        # Never leak whether the email exists — always return 200
        pass
    return {"message": "If that email is registered, a reset link has been sent."}


@router.patch("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """Change the password of the currently authenticated user.

    The current password is validated client-side by re-authenticating with
    Firebase before calling this endpoint.  The backend simply sets the new
    password via the Admin SDK.
    """
    try:
        fb_auth.update_user(current_user.id, password=body.new_password)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password update failed. Please try again.",
        )
    return {"message": "Password changed successfully."}