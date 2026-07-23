"""Mirrors convex/schema.ts `expenses`, `budgets` (see convex/revenue.ts)."""

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Expense(LimsBase):
    __tablename__ = "expenses"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    expense_number: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(2000))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8))
    vendor: Mapped[str | None] = mapped_column(String(255))
    invoice_ref: Mapped[str | None] = mapped_column(String(128))
    expense_date: Mapped[str] = mapped_column(String(32), index=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    cost_centre: Mapped[str | None] = mapped_column(String(64))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Budget(LimsBase):
    __tablename__ = "budgets"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    fiscal_year: Mapped[int] = mapped_column(Integer, index=True)
    category: Mapped[str] = mapped_column(String(64))
    allocated_amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
