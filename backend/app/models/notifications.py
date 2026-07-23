"""Mirrors convex/schema.ts `notifications` (see convex/notifications.ts).

Convex delivered these reactively via subscriptions; the Python equivalent
pushes over the `/ws/notifications` WebSocket (see app/routers/ws.py) in
addition to persisting the row for the notification bell / inbox."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Notification(LimsBase):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(2000))
    type: Mapped[str] = mapped_column(String(32))
    related_module: Mapped[str | None] = mapped_column(String(64))
    related_id: Mapped[str | None] = mapped_column(String(64))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
