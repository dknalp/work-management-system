import re
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, delete

from ..database import get_session
from ..deps import get_current_user, invalidate_permission_cache, is_admin
from ..models import CustomRole, RolePermission, User
from ..schemas import PermissionsResponse, RoleCreate, RolePermissionsMap, RoleResponse

router = APIRouter(tags=["permissions"])

ALL_PERMISSIONS = [
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

DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ALL_PERMISSIONS,
    "manager": [
        "tasks:view",
        "tasks:create",
        "tasks:edit_own",
        "tasks:edit_any",
        "tasks:delete_own",
        "tasks:delete_any",
        "tasks:assign",
        "analytics:view",
        "board:view",
        "board:edit",
        "calendar:view",
        "calendar:edit",
        "files:view",
        "files:upload",
        "files:delete",
        "files:rename",
        "files:create_folder",
        "team:view",
    ],
    "member": [
        "tasks:view",
        "tasks:create",
        "tasks:edit_own",
        "tasks:delete_own",
        "analytics:view",
        "board:view",
        "calendar:view",
        "calendar:edit",
        "files:view",
        "files:upload",
    ],
}


def seed_default_permissions(session: Session) -> None:
    existing_perms = {
        (r.role, r.permission)
        for r in session.exec(select(RolePermission)).all()
    }
    for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
        for perm in perms:
            if (role, perm) not in existing_perms:
                session.add(RolePermission(role=role, permission=perm))
    session.commit()


# ── My permissions ─────────────────────────────────────────────────────────────

@router.get("/permissions/my", response_model=PermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(RolePermission).where(RolePermission.role == current_user.role)
    ).all()
    return PermissionsResponse(permissions=[r.permission for r in rows])


# ── Role CRUD ──────────────────────────────────────────────────────────────────

@router.get("/admin/roles", response_model=List[RoleResponse])
def list_roles(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin erişimi gerekli")
    roles = session.exec(select(CustomRole).order_by(CustomRole.created_at)).all()
    return roles


@router.post("/admin/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin erişimi gerekli")

    name = body.name.strip().lower()

    if not re.match(r"^[a-z0-9_-]+$", name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol adı sadece küçük harf, rakam, tire ve alt çizgi içerebilir",
        )
    if len(name) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol adı en fazla 50 karakter olabilir",
        )

    existing = session.get(CustomRole, name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{name}' rolü zaten mevcut",
        )

    role = CustomRole(name=name, is_system=False)
    session.add(role)

    if body.copy_from:
        source_perms = session.exec(
            select(RolePermission).where(RolePermission.role == body.copy_from)
        ).all()
        for perm in source_perms:
            session.add(RolePermission(role=name, permission=perm.permission))

    session.commit()
    session.refresh(role)
    return role


@router.delete("/admin/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_name: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin erişimi gerekli")

    role = session.get(CustomRole, role_name)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol bulunamadı")
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sistem rolleri (admin, manager, member) silinemez",
        )

    users_with_role = session.exec(select(User).where(User.role == role_name)).all()
    for user in users_with_role:
        user.role = "member"
        user.is_admin = False
        user.updated_at = datetime.now(timezone.utc)
        session.add(user)

    session.exec(delete(RolePermission).where(RolePermission.role == role_name))
    session.delete(role)
    session.commit()
    invalidate_permission_cache(role_name)


# ── Permissions management ────────────────────────────────────────────────────

@router.get("/admin/permissions", response_model=List[RolePermissionsMap])
def get_all_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin erişimi gerekli")

    all_roles = session.exec(select(CustomRole).order_by(CustomRole.created_at)).all()
    result: dict[str, list[str]] = {r.name: [] for r in all_roles}

    rows = session.exec(select(RolePermission)).all()
    for row in rows:
        if row.role in result:
            result[row.role].append(row.permission)

    return [RolePermissionsMap(role=role, permissions=perms) for role, perms in result.items()]


@router.put("/admin/permissions", response_model=List[RolePermissionsMap])
def update_permissions(
    body: List[RolePermissionsMap],
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin erişimi gerekli")

    roles_to_update = [entry.role for entry in body]
    for role in roles_to_update:
        session.exec(delete(RolePermission).where(RolePermission.role == role))

    for entry in body:
        for perm in entry.permissions:
            if perm in ALL_PERMISSIONS:
                session.add(RolePermission(role=entry.role, permission=perm))

    session.commit()
    invalidate_permission_cache()

    all_roles = session.exec(select(CustomRole).order_by(CustomRole.created_at)).all()
    result: dict[str, list[str]] = {r.name: [] for r in all_roles}
    rows = session.exec(select(RolePermission)).all()
    for row in rows:
        if row.role in result:
            result[row.role].append(row.permission)

    return [RolePermissionsMap(role=role, permissions=perms) for role, perms in result.items()]