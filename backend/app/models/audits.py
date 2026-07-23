"""Mirrors convex/schema.ts `audits`, `auditFindings` (see convex/audits.ts).

Not to be confused with `app.models.audit_trail` (system change-log)."""

import uuid

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Audit(LimsBase):
    __tablename__ = "audits"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    audit_number: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    audit_type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="planned", index=True)
    planned_date: Mapped[str] = mapped_column(String(32))
    conducted_date: Mapped[str | None] = mapped_column(String(32))
    closed_date: Mapped[str | None] = mapped_column(String(32))
    lead_auditor: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    scope: Mapped[str | None] = mapped_column(String(2000))
    objectives: Mapped[str | None] = mapped_column(String(2000))
    departments: Mapped[list | None] = mapped_column(JSON)  # list[str(UUID)] of department ids
    summary: Mapped[str | None] = mapped_column(String(4000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class AuditFinding(LimsBase):
    __tablename__ = "audit_findings"

    audit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("audits.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    finding_number: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(String(4000))
    requirement: Mapped[str | None] = mapped_column(String(1000))
    evidence: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(16), default="open")
    due_date: Mapped[str | None] = mapped_column(String(32))
    responsible_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    linked_capa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("capas.id"))
    closed_date: Mapped[str | None] = mapped_column(String(32))
    closure_evidence: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
