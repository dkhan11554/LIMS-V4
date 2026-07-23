"""Declarative base + shared mixins used by every model.

Design notes (see MIGRATION.md for the full rationale):

- Primary keys are UUIDs (``sqlalchemy.Uuid``) rather than the opaque
  Convex document ids (e.g. ``k571bf7952ap...``). ``sqlalchemy.Uuid`` maps to
  a native ``UUID`` column on PostgreSQL and to ``UNIQUEIDENTIFIER`` on SQL
  Server, so the same model code works for either target database.
- Every table gets a ``created_at`` column that mirrors Convex's implicit
  ``_creationTime`` system field, plus an ``updated_at`` column that Convex
  did not have (Convex has no built-in "last modified" timestamp) but which
  is standard practice for a relational schema and is populated
  automatically by SQLAlchemy.
- The legacy Convex document id is preserved in a ``legacy_id`` column on
  every table purely so the one-time data import (``scripts/import_convex_export.py``)
  can resolve foreign keys; new rows created after the migration leave it
  ``NULL``. It can be dropped once the import has been verified.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Original Convex "_id" (e.g. "k571bf7952apemmr7tm2vzt7ms8azbfd"), kept only
    # to support the one-time data migration. Safe to drop post-cutover.
    legacy_id: Mapped[str | None] = mapped_column(
        "legacy_id", nullable=True, index=True, unique=True
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )


class LimsBase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Abstract base every LIMS table should inherit from."""

    __abstract__ = True
