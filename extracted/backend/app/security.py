from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_session
from app.models import LimsRole, User

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_clients: dict[str, PyJWKClient] = {}


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_clients[jwks_url]


def validate_entra_access_token(token: str, settings: Settings) -> dict:
    """Validate an Entra-issued access token using its published signing keys."""
    if not (
        settings.resolved_entra_issuer
        and settings.resolved_entra_audience
        and settings.entra_jwks_url
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft Entra ID is not configured",
        )
    try:
        signing_key = _get_jwks_client(settings.entra_jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.resolved_entra_audience,
            issuer=settings.resolved_entra_issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired access token") from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Bearer authentication is required")

    claims = validate_entra_access_token(credentials.credentials, settings)
    object_id = claims.get("oid") or claims["sub"]
    user = await session.scalar(select(User).where(User.entra_object_id == object_id))

    if user is None:
        # New identities receive no elevated role. An administrator must grant access explicitly.
        user = User(
            entra_object_id=object_id,
            email=claims.get("preferred_username") or claims.get("email"),
            name=claims.get("name"),
            role=LimsRole.ANALYST,
            is_active=False,
            is_disabled=True,
        )
        session.add(user)
    else:
        user.email = claims.get("preferred_username") or claims.get("email") or user.email
        user.name = claims.get("name") or user.name
        user.last_login_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(user)
    if not user.is_active or user.is_disabled or user.is_archived:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )
    return user


CurrentUserDependency = Annotated[User, Depends(get_current_user)]


def require_roles(*allowed_roles: LimsRole) -> Callable:
    async def role_guard(current_user: CurrentUserDependency) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this operation",
            )
        return current_user

    return role_guard


RequireManager = Annotated[
    User, Depends(require_roles(LimsRole.SYSTEM_ADMIN, LimsRole.LAB_MANAGER))
]
