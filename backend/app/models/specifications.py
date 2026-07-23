"""Mirrors convex/schema.ts `specificationSets`, `specificationParameters`."""

import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class SpecificationSet(LimsBase):
    __tablename__ = "specification_sets"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(32))
    pharmacopoeia_ref: Mapped[str | None] = mapped_column(String(16))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), index=True)
    product: Mapped[str | None] = mapped_column(String(255))
    country: Mapped[str | None] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(32))
    effective_date: Mapped[str] = mapped_column(String(32))
    expiry_date: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class SpecificationParameter(LimsBase):
    __tablename__ = "specification_parameters"

    spec_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("specification_sets.id"), index=True)
    test_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tests.id"), index=True)
    parameter_name: Mapped[str] = mapped_column(String(255))
    unit: Mapped[str | None] = mapped_column(String(32))
    result_type: Mapped[str] = mapped_column(String(32))
    lower_limit: Mapped[float | None] = mapped_column(Float)
    upper_limit: Mapped[float | None] = mapped_column(Float)
    alert_lower: Mapped[float | None] = mapped_column(Float)
    alert_upper: Mapped[float | None] = mapped_column(Float)
    action_lower: Mapped[float | None] = mapped_column(Float)
    action_upper: Mapped[float | None] = mapped_column(Float)
    nominal_value: Mapped[float | None] = mapped_column(Float)
    tolerance: Mapped[float | None] = mapped_column(Float)
    method: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(String(2000))
