import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for response schemas that read directly off SQLAlchemy ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class TimestampedRead(ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None


class Message(BaseModel):
    detail: str
