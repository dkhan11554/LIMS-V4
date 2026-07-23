"""Mirrors convex/schema.ts `complaints`."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Complaint(LimsBase):
    __tablename__ = "complaints"

    complaint_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    sample_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("samples.id"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000))
    severity: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    submitted_date: Mapped[str] = mapped_column(String(32))
    submitted_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    resolution: Mapped[str | None] = mapped_column(String(4000))
    resolved_date: Mapped[str | None] = mapped_column(String(32))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    linked_capa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("capas.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
