import uuid
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import TimestampedRead

ResultType = Literal["numeric", "text", "pass_fail", "pos_neg", "selection"]


class TestMethodCreate(BaseModel):
    method_code: str
    name: str
    version: str
    description: str | None = None
    laboratory_id: uuid.UUID
    department_id: uuid.UUID | None = None
    is_accredited: bool = False
    is_active: bool = True


class TestMethodRead(TimestampedRead):
    method_code: str
    name: str
    version: str
    laboratory_id: uuid.UUID
    is_accredited: bool
    is_active: bool


class TestCreate(BaseModel):
    test_code: str
    name: str
    category: str | None = None
    method_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    laboratory_id: uuid.UUID
    unit: str | None = None
    result_type: ResultType
    decimal_places: int | None = None
    lower_limit: float | None = None
    upper_limit: float | None = None
    price: float | None = None
    is_active: bool = True


class TestRead(TimestampedRead):
    test_code: str
    name: str
    category: str | None
    laboratory_id: uuid.UUID
    unit: str | None
    result_type: str
    price: float | None
    is_active: bool
