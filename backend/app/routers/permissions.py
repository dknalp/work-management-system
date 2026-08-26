"""Permissions router — RBAC role and permission management.

Exposes endpoints for reading the current user's permissions, and for admin
management of roles and permission assignments.

All role and permission data is stored in the Firestore collections:
  - ``custom_roles`` — role definitions
  - ``role_permissions`` — per-role permission grants (one document per grant)

The module-level ``_permission_cache`` in ``deps.py`` is invalidated after any
write by calling ``deps._permission_cache.clear()``.
"""

import re
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore

from ..deps import _permission_cache, get_current_user
from ..firebase import get_db
from ..models import User
from ..schemas import PermissionsResponse, RoleCreate, RolePermissionsMap, RoleResponse

router = APIRouter(tags=["permissions"])

ALL_PERMISSIONS: list[str] = [
    # Tasks
    "tasks:view",
    "tasks:create",
    "tasks:edit_own",
    "tasks:edit_any",
    "tasks:delete_own",
    "tasks:delete_any",
    "tasks:assign",
    # Analytics
    "analytics:view",
    # Board / Pipeline
    "board:view",
    "board:edit",
    # Calendar
    "calendar:view",
    "calendar:edit",
    # Files
    "files:view",
    "files:upload",
    "files:delete",
    "files:rename",
    "files:create_folder",
    # Team
    "team:view",
    "team:manage",
    # Admin
    "admin:view",
    "admin:manage_permissions",
]

# System roles cannot be deleted
_SYSTEM_ROLES = {"admin", "manager", "member"}

DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ALL_PERMISSIONS,
    "manager": [
        "tasks:view", "tasks:create", "tasks:edit_own", "tasks:edit_any",
        "tasks:delete_own", "tasks:delete_any", "tasks:assign",
        "analytics:view", "board:view", "board:edit",
        "calendar:view", "calendar:edit",
        "files:view", "files:upload", "files:delete", "files:rename", "files:create_folder",
        "team:view",
    ],
    "member": [
        "tasks:view", "tasks:create", "tasks:edit_own", "tasks:delete_own",
        "analytics:view", "board:view",
        "calendar:view", "calendar:edit",
        "files:view", "files:upload",
    ],
}


def seed_default_permissions(db: firestore.Client) -> None:
    """Idempotently write default permission documents to Firestore.

    Also ensures system roles (admin, manager, member) exist in
    ``custom_roles``.  Called once at application startup.
    """
    # Seed system role documents
    for role_name in _SYSTEM_ROLES:
        role_ref = db.collection("custom_roles").document(role_name)
        if not role_ref.get().exists:
            role_ref.set({
                "name": role_name,
                "is_system": True,
                "created_at": datetime.now(timezone.utc),
            })

    # Seed permissions — always upsert so that if the backend crashed mid-way
    # on a previous startup, the next restart fully corrects the permission set.
    col = db.collection("role_permissions")
    batch = db.batch()
    count = 0
    for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
        for perm in perms:
            doc_id = f"{role}_{perm.replace(':', '_')}"
            batch.set(col.document(doc_id), {"role": role, "permission": perm})
            count += 1
            if count % 400 == 0:  # Firestore batch limit is 500
                batch.commit()
                batch = db.batch()
    if count % 400 != 0:
        batch.commit()


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


# ── My permissions ─────────────────────────────────────────────────────────────

@router.get("/my", response_model=PermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: firestore.Client = Depends(get_db),
):
    """Return the list of permissions granted to the current user's role."""
    docs = db.collection("role_permissions").where("role", "==", current_user.role).stream()
    perms = [doc.to_dict().get("permission", "") for doc in docs if doc.to_dict().get("permission")]
    return PermissionsResponse(permissions=perms)


# ── Role CRUD ──────────────────────────────────────────────────────────────────

@router.get("/admin/roles", response_model=List[RoleResponse])
def list_roles(
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Return all roles (system and custom), ordered by creation date."""
    docs = db.collection("custom_roles").order_by("created_at").stream()
    result = []
    for doc in docs:
        data = doc.to_dict() or {}
        created_raw = data.get("created_at")
        created_at = created_raw if isinstance(created_raw, datetime) else datetime.now(timezone.utc)
        result.append(RoleResponse(
            name=doc.id,
            is_system=data.get("is_system", False),
            created_at=created_at,
        ))
    return result


@router.post("/admin/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleCreate,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Create a new custom role, optionally copying permissions from another role."""
    name = body.name.strip().lower()

    if not re.match(r"^[a-z0-9_-]+$", name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name may only contain lowercase letters, digits, hyphens, and underscores.",
        )
    if len(name) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name must be 50 characters or fewer.",
        )

    doc_ref = db.collection("custom_roles").document(name)
    if doc_ref.get().exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{name}' already exists.",
        )

    now = datetime.now(timezone.utc)
    doc_ref.set({"name": name, "is_system": False, "created_at": now})

    # Optionally copy permissions from another role
    if body.copy_from:
        source_docs = db.collection("role_permissions").where("role", "==", body.copy_from).stream()
        for source_doc in source_docs:
            perm = source_doc.to_dict().get("permission", "")
            if perm:
                new_id = f"{name}_{perm.replace(':', '_')}"
                db.collection("role_permissions").document(new_id).set({"role": name, "permission": perm})
        _permission_cache.pop(name, None)

    return RoleResponse(name=name, is_system=False, created_at=now)


@router.delete("/admin/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_name: str,
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Delete a custom role and reassign its users to 'member'."""
    if role_name in _SYSTEM_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System roles (admin, manager, member) cannot be deleted.",
        )

    role_ref = db.collection("custom_roles").document(role_name)
    if not role_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    # Reassign users that had this role to 'member'
    user_docs = db.collection("users").where("role", "==", role_name).stream()
    for user_doc in user_docs:
        user_doc.reference.update({"role": "member", "is_admin": False, "updated_at": datetime.now(timezone.utc)})

    # Delete all permission grants for this role
    perm_docs = db.collection("role_permissions").where("role", "==", role_name).stream()
    for perm_doc in perm_docs:
        perm_doc.reference.delete()

    role_ref.delete()
    _permission_cache.pop(role_name, None)


# ── Permission management ──────────────────────────────────────────────────────

@router.get("/admin/permissions", response_model=List[RolePermissionsMap])
def get_all_permissions(
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Return the full permission map for all roles."""
    role_docs = db.collection("custom_roles").order_by("created_at").stream()
    result: dict[str, list[str]] = {doc.id: [] for doc in role_docs}

    perm_docs = db.collection("role_permissions").stream()
    for perm_doc in perm_docs:
        data = perm_doc.to_dict() or {}
        role = data.get("role", "")
        perm = data.get("permission", "")
        if role in result and perm:
            result[role].append(perm)

    return [RolePermissionsMap(role=role, permissions=perms) for role, perms in result.items()]


@router.put("/admin/permissions", response_model=List[RolePermissionsMap])
def update_permissions(
    body: List[RolePermissionsMap],
    admin: User = Depends(_require_admin),
    db: firestore.Client = Depends(get_db),
):
    """Replace the full permission set for the given roles.

    All existing grants for the listed roles are deleted and replaced with the
    provided set.  Only permissions in ``ALL_PERMISSIONS`` are accepted.
    """
    roles_to_update = [entry.role for entry in body]

    # Delete existing grants for the roles being updated
    for role in roles_to_update:
        existing = db.collection("role_permissions").where("role", "==", role).stream()
        for doc in existing:
            doc.reference.delete()

    # Write new grants
    for entry in body:
        for perm in entry.permissions:
            if perm in ALL_PERMISSIONS:
                doc_id = f"{entry.role}_{perm.replace(':', '_')}"
                db.collection("role_permissions").document(doc_id).set({
                    "role": entry.role,
                    "permission": perm,
                })

    # Invalidate the entire cache since multiple roles may have changed
    _permission_cache.clear()

    # Return the updated map
    role_docs = db.collection("custom_roles").order_by("created_at").stream()
    result: dict[str, list[str]] = {doc.id: [] for doc in role_docs}
    perm_docs = db.collection("role_permissions").stream()
    for perm_doc in perm_docs:
        data = perm_doc.to_dict() or {}
        role = data.get("role", "")
        perm = data.get("permission", "")
        if role in result and perm:
            result[role].append(perm)

    return [RolePermissionsMap(role=role, permissions=perms) for role, perms in result.items()]