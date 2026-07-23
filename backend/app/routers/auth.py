"""Phase-1 JWT auth. Replaces convex/auth.config.ts + @usehercules/auth."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.organization import User
from app.schemas.auth import TokenResponse, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    """Bootstrap/self-service registration. Lock this down (admin-only invite
    flow) once real users are onboarded - see MIGRATION.md "Authentication"."""

    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")

    is_first_user = db.execute(select(User.id).limit(1)).first() is None

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        name=payload.name,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role="system_admin" if is_first_user else payload.role,
        department_id=payload.department_id,
        is_active=True,
        account_status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> TokenResponse:
    user = db.execute(select(User).where(User.email == form_data.username)).scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_disabled or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role or "analyst"),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(refresh_token: str, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user or user.is_disabled or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role or "analyst"),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Equivalent to convex/users.ts::getCurrentUser."""
    return current_user
