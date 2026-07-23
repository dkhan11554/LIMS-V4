"""Mirrors convex/schema.ts `calculationFormulas`, `sampleTestCalculations`
(see convex/calculations.ts). The formula-evaluation engine itself
(safe arithmetic expression evaluator) ports directly to Python - see
MIGRATION.md "Calculations engine"."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class CalculationFormula(LimsBase):
    __tablename__ = "calculation_formulas"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000))
    category: Mapped[str] = mapped_column(String(32), index=True)
    formula: Mapped[str] = mapped_column(String(2000))
    variables: Mapped[list] = mapped_column(JSON, default=list)
    result_unit: Mapped[str | None] = mapped_column(String(32))
    decimal_places: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class SampleTestCalculation(LimsBase):
    __tablename__ = "sample_test_calculations"

    sample_test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sample_tests.id"), index=True)
    formula_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("calculation_formulas.id"))
    formula_name: Mapped[str | None] = mapped_column(String(255))
    variable_values: Mapped[dict | None] = mapped_column(JSON)
    calculated_result: Mapped[float | None] = mapped_column(Float)
    replicates: Mapped[list | None] = mapped_column(JSON)
    average: Mapped[float | None] = mapped_column(Float)
    std_dev: Mapped[float | None] = mapped_column(Float)
    rsd: Mapped[float | None] = mapped_column(Float)
    uncertainty: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
