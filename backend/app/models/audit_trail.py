"""Mirrors convex/schema.ts `auditTrail` - the immutable change-log used for
21 CFR Part 11 / GxP style traceability."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class AuditTrailEntry(LimsBase):
    __tablename__ = "audit_trail"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    module: Mapped[str] = mapped_column(String(64), index=True)
    record_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(32))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(String(2000))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    timestamp: Mapped[str] = mapped_column(String(32))
