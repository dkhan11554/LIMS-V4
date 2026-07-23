"""Mirrors convex/schema.ts `retestRequests`."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class RetestRequest(LimsBase):
    __tablename__ = "retest_requests"

    sample_test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sample_tests.id"), index=True)
    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    requested_at: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(32))
    reason_detail: Mapped[str | None] = mapped_column(String(2000))
    root_cause: Mapped[str | None] = mapped_column(String(2000))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="pending_approval", index=True)
    original_result: Mapped[str | None] = mapped_column(String(255))
    retest_result: Mapped[str | None] = mapped_column(String(255))
    conclusion: Mapped[str | None] = mapped_column(String(2000))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
