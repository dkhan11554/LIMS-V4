"""Mirrors convex/schema.ts `testMethods`, `tests` (see convex/catalogue.ts)."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase

TEST_RESULT_TYPES = ("numeric", "text", "pass_fail", "pos_neg", "selection")


class TestMethod(LimsBase):
    __tablename__ = "test_methods"

    method_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    version: Mapped[str] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(String(2000))
    document_reference: Mapped[str | None] = mapped_column(String(255))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    is_accredited: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[str | None] = mapped_column(String(32))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Test(LimsBase):
    __tablename__ = "tests"

    test_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(128))
    method_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("test_methods.id"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    unit: Mapped[str | None] = mapped_column(String(32))
    result_type: Mapped[str] = mapped_column(String(32))
    decimal_places: Mapped[int | None] = mapped_column(Integer)
    lower_limit: Mapped[float | None] = mapped_column(Float)
    upper_limit: Mapped[float | None] = mapped_column(Float)
    detection_limit: Mapped[float | None] = mapped_column(Float)
    standard_tat: Mapped[float | None] = mapped_column(Float)  # hours
    price: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
