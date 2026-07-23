import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import LimsRole


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CurrentUser(APIModel):
    id: uuid.UUID
    email: EmailStr | None
    name: str | None
    role: LimsRole
    is_active: bool
    is_disabled: bool


class AuthenticatedUser(APIModel):
    id: uuid.UUID
    email: EmailStr | None
    display_name: str | None
    roles: list[LimsRole]
    permissions: list[str]


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    address: str | None = None
    country: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(default=None, max_length=2048)


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    address: str | None = None
    country: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(default=None, max_length=2048)
    is_active: bool | None = None


class Company(APIModel):
    id: uuid.UUID
    name: str
    legal_name: str | None
    address: str | None
    country: str | None
    phone: str | None
    email: EmailStr | None
    website: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LaboratoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=50)
    company_id: uuid.UUID
    address: str | None = None
    country: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=100)
    accreditation_number: str | None = Field(default=None, max_length=100)


class Laboratory(APIModel):
    id: uuid.UUID
    name: str
    code: str
    company_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=50)
    laboratory_id: uuid.UUID
    description: str | None = None


class Department(APIModel):
    id: uuid.UUID
    name: str
    code: str
    laboratory_id: uuid.UUID
    manager_id: uuid.UUID | None
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
