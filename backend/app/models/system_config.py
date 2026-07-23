"""Mirrors convex/schema.ts `systemConfig`, `limsCounters` (see convex/config.ts)."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class SystemConfig(LimsBase):
    __tablename__ = "system_config"
    __table_args__ = (UniqueConstraint("laboratory_id", "key", name="uq_system_config_lab_key"),)

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    key: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(4000))
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[str] = mapped_column(String(32))


class LimsCounter(LimsBase):
    """Backs sequential LIMS-number / document-number generation
    (see convex/samples.ts::generateLimsNumber and similar helpers)."""

    __tablename__ = "lims_counters"
    __table_args__ = (UniqueConstraint("laboratory_id", "year", name="uq_lims_counters_lab_year"),)

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    last_sequence: Mapped[int] = mapped_column(Integer, default=0)
