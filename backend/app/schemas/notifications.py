import uuid

from app.schemas.common import TimestampedRead


class NotificationRead(TimestampedRead):
    title: str
    message: str
    type: str
    related_module: str | None
    related_id: str | None
    is_read: bool
    user_id: uuid.UUID
