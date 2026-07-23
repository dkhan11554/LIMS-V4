"""Mirrors convex/schema.ts `inventoryItems`, `inventoryTransactions`
(see convex/inventory.ts)."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class InventoryItem(LimsBase):
    __tablename__ = "inventory_items"

    item_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(32))
    supplier: Mapped[str | None] = mapped_column(String(255))
    catalogue_number: Mapped[str | None] = mapped_column(String(128))
    unit: Mapped[str] = mapped_column(String(32))
    current_stock: Mapped[float] = mapped_column(Float, default=0)
    min_stock: Mapped[float] = mapped_column(Float, default=0)
    max_stock: Mapped[float | None] = mapped_column(Float)
    reorder_point: Mapped[float | None] = mapped_column(Float)
    location: Mapped[str | None] = mapped_column(String(255))
    storage_condition: Mapped[str | None] = mapped_column(String(64))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    linked_instrument_ids: Mapped[list | None] = mapped_column(JSON)
    expiry_date: Mapped[str | None] = mapped_column(String(32))
    lot_number: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(String(2000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class InventoryTransaction(LimsBase):
    __tablename__ = "inventory_transactions"

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(16))
    quantity: Mapped[float] = mapped_column(Float)
    quantity_before: Mapped[float] = mapped_column(Float)
    quantity_after: Mapped[float] = mapped_column(Float)
    reference_number: Mapped[str | None] = mapped_column(String(128))
    reason: Mapped[str | None] = mapped_column(String(1000))
    performed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    transaction_date: Mapped[str] = mapped_column(String(32), index=True)
