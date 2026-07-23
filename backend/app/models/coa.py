"""Mirrors convex/schema.ts `coaRecords` (Certificate of Analysis, see
convex/coa.ts). PDF rendering (`jspdf` in the frontend, `generate-coa.ts`) is
replaced server-side by a Python PDF library (e.g. WeasyPrint/ReportLab) so
the same certificate can be generated for the UI "preview" and for the
emailed/stored final PDF - see MIGRATION.md "Documents / COA generation"."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class CoaRecord(LimsBase):
    __tablename__ = "coa_records"

    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    lims_number: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    watermark: Mapped[str | None] = mapped_column(String(16))
    issued_at: Mapped[str | None] = mapped_column(String(32))
    issued_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    emailed_to: Mapped[str | None] = mapped_column(String(255))
    emailed_at: Mapped[str | None] = mapped_column(String(32))
    ai_summary: Mapped[str | None] = mapped_column(Text)
    reissue_reason: Mapped[str | None] = mapped_column(String(2000))
    notes: Mapped[str | None] = mapped_column(String(2000))
