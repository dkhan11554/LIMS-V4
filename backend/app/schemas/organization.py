import uuid

from pydantic import BaseModel

from app.schemas.common import TimestampedRead


class CompanyCreate(BaseModel):
    name: str
    legal_name: str | None = None
    address: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    is_active: bool = True


class CompanyRead(TimestampedRead):
    name: str
    legal_name: str | None
    country: str | None
    is_active: bool


class LaboratoryCreate(BaseModel):
    name: str
    code: str
    company_id: uuid.UUID
    address: str | None = None
    country: str | None = None
    timezone: str | None = None
    manager_id: uuid.UUID | None = None
    is_active: bool = True


class LaboratoryRead(TimestampedRead):
    name: str
    code: str
    company_id: uuid.UUID
    country: str | None
    is_active: bool


class DepartmentCreate(BaseModel):
    name: str
    code: str
    laboratory_id: uuid.UUID
    manager_id: uuid.UUID | None = None
    description: str | None = None
    is_active: bool = True


class DepartmentRead(TimestampedRead):
    name: str
    code: str
    laboratory_id: uuid.UUID
    is_active: bool
