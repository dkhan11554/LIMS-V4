"""Mirrors convex/schema.ts `suppliers` (see convex/suppliers.ts)."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Supplier(LimsBase):
    __tablename__ = "suppliers"

    supplier_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    category: Mapped[str] = mapped_column(String(32))
    qualification_status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    country: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(1000))
    website: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    contact_name: Mapped[str | None] = mapped_column(String(255))
    qualification_date: Mapped[str | None] = mapped_column(String(32))
    requalification_date: Mapped[str | None] = mapped_column(String(32))
    qualification_notes: Mapped[str | None] = mapped_column(String(2000))
    certifications: Mapped[list | None] = mapped_column(JSON)
    performance_score: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
