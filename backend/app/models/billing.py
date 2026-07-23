"""Mirrors convex/schema.ts `quotations`, `invoices`, `payments`
(see convex/billing.ts). `lineItems` sub-objects become a JSON column since
neither Postgres nor SQL Server needs a separate line-items table for a v1
migration; they can be normalized into a `invoice_line_items` table later
without touching the API contract."""

import uuid

from sqlalchemy import Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Quotation(LimsBase):
    __tablename__ = "quotations"

    quotation_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_projects.id"))
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    valid_until: Mapped[str | None] = mapped_column(String(32))
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    subtotal: Mapped[float] = mapped_column(Float)
    tax_rate: Mapped[float | None] = mapped_column(Float)
    tax_amount: Mapped[float | None] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    currency: Mapped[str | None] = mapped_column(String(8))
    notes: Mapped[str | None] = mapped_column(String(2000))
    terms_conditions: Mapped[str | None] = mapped_column(String(4000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Invoice(LimsBase):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_projects.id"))
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("quotations.id"))
    sample_ids: Mapped[list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    issue_date: Mapped[str] = mapped_column(String(32))
    due_date: Mapped[str | None] = mapped_column(String(32))
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    subtotal: Mapped[float] = mapped_column(Float)
    tax_rate: Mapped[float | None] = mapped_column(Float)
    tax_amount: Mapped[float | None] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    amount_paid: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str | None] = mapped_column(String(8))
    notes: Mapped[str | None] = mapped_column(String(2000))
    payment_terms: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Payment(LimsBase):
    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str | None] = mapped_column(String(8))
    payment_date: Mapped[str] = mapped_column(String(32))
    payment_method: Mapped[str] = mapped_column(String(32))
    reference_number: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(String(2000))
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
