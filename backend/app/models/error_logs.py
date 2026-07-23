"""Mirrors convex/schema.ts `errorLogs` (see convex/errorLogs.ts) - client-side
error telemetry captured for admin diagnostics."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class ErrorLog(LimsBase):
    __tablename__ = "error_logs"

    error_id: Mapped[str] = mapped_column(String(64), index=True)
    timestamp: Mapped[str] = mapped_column(String(32), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    user_name: Mapped[str | None] = mapped_column(String(255))
    laboratory_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("laboratories.id"), index=True)
    module: Mapped[str] = mapped_column(String(64))
    screen: Mapped[str] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(128))
    field_id: Mapped[str | None] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255))
    detail: Mapped[str] = mapped_column(Text)
    raw_message: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    url: Mapped[str | None] = mapped_column(String(1024))
