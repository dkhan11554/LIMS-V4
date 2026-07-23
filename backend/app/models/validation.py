"""Mirrors convex/schema.ts `resultValidations` (see convex/validation.ts) -
spec/Westgard/trend checks run against a submitted result."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class ResultValidation(LimsBase):
    __tablename__ = "result_validations"

    sample_test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sample_tests.id"), index=True)
    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tests.id"))
    measured_value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(32))
    spec_set_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("specification_sets.id"))
    spec_parameter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("specification_parameters.id"))
    lower_limit: Mapped[float | None] = mapped_column(Float)
    upper_limit: Mapped[float | None] = mapped_column(Float)
    spec_status: Mapped[str | None] = mapped_column(String(16))
    westgard_violations: Mapped[list | None] = mapped_column(JSON)
    westgard_status: Mapped[str | None] = mapped_column(String(16))
    trend_alerts: Mapped[list | None] = mapped_column(JSON)
    validation_status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    validated_at: Mapped[str | None] = mapped_column(String(32))
    validation_notes: Mapped[str | None] = mapped_column(String(2000))
    is_outlier: Mapped[bool | None] = mapped_column(Boolean)
    outlier_reason: Mapped[str | None] = mapped_column(String(1000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
