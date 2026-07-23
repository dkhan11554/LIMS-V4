"""Mirrors convex/schema.ts `customers`, `customerContacts`, `customerProjects`
(see convex/customers.ts)."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase

CUSTOMER_PROJECT_STATUSES = ("active", "completed", "on_hold", "cancelled")


class Customer(LimsBase):
    __tablename__ = "customers"

    customer_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    legal_name: Mapped[str | None] = mapped_column(String(255))
    tax_number: Mapped[str | None] = mapped_column(String(64))
    billing_address: Mapped[str | None] = mapped_column(String(1000))
    collection_address: Mapped[str | None] = mapped_column(String(1000))
    country: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    payment_terms: Mapped[str | None] = mapped_column(String(255))
    contract_start: Mapped[str | None] = mapped_column(String(32))
    contract_expiry: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    notes: Mapped[str | None] = mapped_column(String(4000))


class CustomerContact(LimsBase):
    __tablename__ = "customer_contacts"

    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(128))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class CustomerProject(LimsBase):
    __tablename__ = "customer_projects"

    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    project_code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000))
    start_date: Mapped[str | None] = mapped_column(String(32))
    end_date: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="active")
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_contacts.id"))
    notes: Mapped[str | None] = mapped_column(String(4000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
