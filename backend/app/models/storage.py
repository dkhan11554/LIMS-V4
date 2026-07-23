"""Mirrors convex/schema.ts `storageLocations`, `sampleStorageAssignments`
(see convex/storage.ts). Not to be confused with `app.services.file_storage`
(document/blob storage) - this is physical sample storage (freezers, racks…)."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class StorageLocation(LimsBase):
    __tablename__ = "storage_locations"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(64))
    location_type: Mapped[str] = mapped_column(String(32))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("storage_locations.id"), index=True)
    temperature: Mapped[str | None] = mapped_column(String(32))
    humidity: Mapped[str | None] = mapped_column(String(32))
    capacity: Mapped[int | None] = mapped_column(Integer)
    current_occupancy: Mapped[int | None] = mapped_column(Integer)
    barcode: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(String(2000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class SampleStorageAssignment(LimsBase):
    __tablename__ = "sample_storage_assignments"

    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("storage_locations.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    position: Mapped[str | None] = mapped_column(String(64))
    check_in_date: Mapped[str] = mapped_column(String(32))
    check_in_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    check_out_date: Mapped[str | None] = mapped_column(String(32))
    check_out_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    retention_expiry: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="in_storage")
    notes: Mapped[str | None] = mapped_column(String(2000))
