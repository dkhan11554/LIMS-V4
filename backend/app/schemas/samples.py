import uuid
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import TimestampedRead

SamplePriority = Literal["routine", "urgent", "stat"]


class SampleCreate(BaseModel):
    customer_sample_number: str | None = None
    customer_id: uuid.UUID
    project_id: uuid.UUID | None = None
    laboratory_id: uuid.UUID
    sample_name: str
    sample_type: str | None = None
    product: str | None = None
    batch_number: str | None = None
    lot_number: str | None = None
    manufacturing_date: str | None = None
    expiry_date: str | None = None
    collection_date: str | None = None
    collection_location: str | None = None
    priority: SamplePriority = "routine"
    container_type: str | None = None
    container_count: int | None = None
    sample_volume: str | None = None
    storage_condition: str | None = None
    requested_completion_date: str | None = None
    customer_instructions: str | None = None
    internal_notes: str | None = None
    test_ids: list[uuid.UUID] = []


class SampleRead(TimestampedRead):
    lims_number: str
    customer_id: uuid.UUID
    laboratory_id: uuid.UUID
    sample_name: str
    sample_type: str | None
    priority: str
    status: str


class SampleTestRead(TimestampedRead):
    sample_id: uuid.UUID
    test_id: uuid.UUID
    status: str
    assigned_to: uuid.UUID | None
    result: str | None
    pass_fail_status: str | None


class SampleStatusUpdate(BaseModel):
    status: str
    reason: str | None = None
