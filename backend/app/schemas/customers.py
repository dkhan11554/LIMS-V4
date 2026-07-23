import uuid

from pydantic import BaseModel

from app.schemas.common import TimestampedRead


class CustomerCreate(BaseModel):
    customer_code: str
    name: str
    legal_name: str | None = None
    tax_number: str | None = None
    billing_address: str | None = None
    collection_address: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    payment_terms: str | None = None
    laboratory_id: uuid.UUID
    notes: str | None = None
    is_active: bool = True


class CustomerUpdate(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    billing_address: str | None = None
    collection_address: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    payment_terms: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CustomerRead(TimestampedRead):
    customer_code: str
    name: str
    legal_name: str | None
    country: str | None
    email: str | None
    phone: str | None
    laboratory_id: uuid.UUID
    is_active: bool
