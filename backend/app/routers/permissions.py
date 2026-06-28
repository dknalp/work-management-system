from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, delete

from ..database import get_session
from ..deps import get_current_user
from ..models import RolePermission, User
from ..schemas import PermissionsResponse, RolePermissionsMap

router = APIRouter(tags=["permissions"])

ALL_PERMISSIONS = [
    "tasks:create",
    "tasks:edit_own",
    "tasks:edit_any",
    "tasks:delete_own",
    "tasks:delete_any",
    "tasks:assign",
    "files:upload",
    "files:delete",
    "team:view",
    "team:manage",
    "admin:view",
    "admin:manage_permissions",
]

DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ALL_PERMISSIONS,
    "manager": [
        "tasks:create",
        "tasks:edit_own",
        "tasks:edit_any",
        "tasks:delete_own",
        "tasks:delete_any",
        "tasks:assign",
        "files:upload",
        "files:delete",
    ],
    "member": [
        "tasks:create",
        "tasks:edit_own",
        "tasks:delete_own",
        "files:upload",
    ],
}


def seed_default_permissions(session: Session) -> None:
    existing = session.exec(select(RolePermission)).first()
    if existing:
        return
    for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
        for perm in perms:
            session.add(RolePermission(role=role, permission=perm))
    session.commit()


def _is_admin(user: User) -> bool:
    return user.is_admin or user.role == "admin"


@router.get("/permissions/my", response_model=PermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(RolePermission).where(RolePermission.role == current_user.role)
    ).all()
    return PermissionsResponse(permissions=[r.permission for r in rows])


@router.get("/admin/permissions", response_model=List[RolePermissionsMap])
def get_all_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result: dict[str, list[str]] = {"admin": [], "manager": [], "member": []}
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
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    roles_to_update = [entry.role for entry in body]
    for role in roles_to_update:
        session.exec(delete(RolePermission).where(RolePermission.role == role))

    for entry in body:
        for perm in entry.permissions:
            if perm in ALL_PERMISSIONS:
                session.add(RolePermission(role=entry.role, permission=perm))

    session.commit()

    result: dict[str, list[str]] = {"admin": [], "manager": [], "member": []}
    rows = session.exec(select(RolePermission)).all()
    for row in rows:
        if row.role in result:
            result[row.role].append(row.permission)

    return [RolePermissionsMap(role=role, permissions=perms) for role, perms in result.items()]