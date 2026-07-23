import uuid

from pydantic import BaseModel, EmailStr

from app.schemas.common import TimestampedRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserRead(TimestampedRead):
    email: str | None
    name: str | None
    first_name: str | None
    last_name: str | None
    role: str
    department_id: uuid.UUID | None
    is_active: bool
    is_disabled: bool
    account_status: str | None
    job_title: str | None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: str = "analyst"
    department_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    department_id: uuid.UUID | None = None
    is_active: bool | None = None
    is_disabled: bool | None = None
    job_title: str | None = None
    phone: str | None = None
