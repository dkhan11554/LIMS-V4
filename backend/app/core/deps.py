"""Shared FastAPI dependencies: DB session, current user, RBAC.

Direct port of convex/lib/roles.ts. Compare:

    export async function requireRole(ctx, allowedRoles) { ... }

with `require_role()` below - the semantics (system_admin always passes,
otherwise role must be in the allow-list) are identical."""

import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.organization import LIMS_ROLES, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    try:
        user = db.get(User, uuid.UUID(user_id))
    except (ValueError, TypeError):
        user = None

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.is_disabled or user.is_archived or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return user


def require_role(*allowed_roles: str) -> Callable[[User], User]:
    """FastAPI dependency factory - equivalent to convex/lib/roles.ts::requireRole.

    Usage: `current_user: User = Depends(require_role("system_admin", "lab_manager"))`
    """

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        role = current_user.role or "analyst"
        if role == "system_admin":
            return current_user  # superuser bypass, mirrors the Convex helper
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Insufficient permissions. Required: {', '.join(allowed_roles)}. "
                    f"Your role: {role}"
                ),
            )
        return current_user

    return _dependency


require_admin = require_role("system_admin")
require_manager = require_role("system_admin", "lab_manager")
require_sample_manager = require_role("system_admin", "lab_manager", "supervisor", "reception")
require_qa = require_role("system_admin", "lab_manager", "qa_officer")
require_reviewer = require_role("system_admin", "lab_manager", "supervisor")
require_billing = require_role("system_admin", "lab_manager", "reception")

__all__ = [
    "LIMS_ROLES",
    "get_current_user",
    "require_role",
    "require_admin",
    "require_manager",
    "require_sample_manager",
    "require_qa",
    "require_reviewer",
    "require_billing",
]
