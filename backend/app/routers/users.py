"""Users router — profile management for the authenticated user.

Handles reading and updating the current user's profile, including avatar
image uploads. Avatar bytes are stored in Cloudflare R2 when the relevant
env vars are set; otherwise they are written to local disk under the
configured FILE_STORAGE_PATH (defaults to frontend/data/).
"""

import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from firebase_admin import firestore

from ..deps import _user_cache, get_current_user
from ..firebase import get_db
from ..models import User
from ..r2 import r2_upload_fileobj
from ..schemas import UpdateProfileRequest, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

# ---------------------------------------------------------------------------
# Avatar upload constants
# ---------------------------------------------------------------------------

# MIME types accepted for avatar uploads.
_ALLOWED_AVATAR_MIME_TYPES = frozenset({
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
})

# Hard cap for avatar uploads: 5 MB.
_AVATAR_MAX_BYTES = 5 * 1024 * 1024

# Map accepted MIME types to file extensions.
_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def _avatar_storage_root() -> Path:
    """Return the local directory where avatars are stored when R2 is not configured.

    Mirrors the logic in files_utils._storage_root() so avatar files land in
    the same tree as regular uploaded files.
    """
    custom = os.environ.get("FILE_STORAGE_PATH", "").strip()
    if custom:
        return Path(custom)
    # Default: <repo_root>/frontend/data/
    return Path(__file__).resolve().parents[3] / "frontend" / "data"


def _r2_configured() -> bool:
    """Return True when all required Cloudflare R2 environment variables are set."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID", "")
    return bool(account_id and os.environ.get("R2_BUCKET_NAME", ""))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        bio=current_user.bio,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        role=current_user.role,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Partially update the currently authenticated user's profile.

    Only the fields present in the request body are updated.
    """
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.name is not None:
        updates["name"] = body.name
    if body.bio is not None:
        updates["bio"] = body.bio
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url

    db.collection("users").document(current_user.id).update(updates)

    # Merge updates into the current user object for the response.
    updated = current_user.model_copy(update={k: v for k, v in updates.items() if k != "updated_at"})
    return UserResponse(
        id=updated.id,
        email=updated.email,
        name=updated.name,
        bio=updated.bio,
        avatar_url=updated.avatar_url,
        is_active=updated.is_active,
        is_admin=updated.is_admin,
        role=updated.role,
        created_at=updated.created_at,
    )


@router.post("/me/avatar", summary="Upload or replace the caller's avatar image")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
) -> dict:
    """Accept an image upload and store it as the caller's avatar.

    Validates MIME type (jpeg/png/webp/gif) and enforces a 5 MB cap.
    Stores the file in Cloudflare R2 when the relevant env vars are set;
    falls back to local disk otherwise. Updates the Firestore user document
    with the resulting URL and evicts the in-memory user cache so subsequent
    requests see the new avatar immediately.

    Args:
        file: The uploaded image file (multipart/form-data).
        current_user: The authenticated user resolved from the Bearer token.
        db: Firestore client dependency.

    Returns:
        {"avatar_url": str} — publicly accessible URL for the stored image.

    Raises:
        400 if the MIME type is not an accepted image type.
        400 if the file exceeds 5 MB.
    """
    # Validate MIME type before reading the full body to fail fast.
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in _ALLOWED_AVATAR_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{content_type}'. "
                "Accepted types: image/jpeg, image/png, image/webp, image/gif."
            ),
        )

    # Read the full body so we can enforce the size cap.
    body = await file.read()
    if len(body) > _AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Avatar must be smaller than 5 MB "
                f"(received {len(body) / 1024 / 1024:.2f} MB)."
            ),
        )

    # Derive the extension from the MIME type; fall back to the original filename.
    ext = _MIME_TO_EXT.get(content_type, (file.filename or "jpg").rsplit(".", 1)[-1])
    object_key = f"avatars/{current_user.id}/{uuid.uuid4()}.{ext}"

    if _r2_configured():
        # Upload to Cloudflare R2 and build the public URL from R2_PUBLIC_URL.
        r2_public_url = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
        await r2_upload_fileobj(io.BytesIO(body), object_key, content_type=content_type)
        avatar_url = f"{r2_public_url}/{object_key}"
    else:
        # Store on local disk under the configured storage root.
        dest = _avatar_storage_root() / object_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        # Return a relative URL path; the Next.js layer serves /data/ from
        # frontend/data/ so the avatar is accessible from the browser.
        avatar_url = f"/data/{object_key}"

    # Persist the new avatar URL to Firestore.
    db.collection("users").document(current_user.id).update({
        "avatar_url": avatar_url,
        "updated_at": datetime.now(timezone.utc),
    })

    # Evict the cached user record so the next authenticated request re-fetches
    # the Firestore document and sees the updated avatar_url.
    _user_cache.pop(current_user.id, None)

    return {"avatar_url": avatar_url}
