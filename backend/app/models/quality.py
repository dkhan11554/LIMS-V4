"""Mirrors convex/schema.ts `oosInvestigations`, `deviations`, `capas`,
`changeControls` (see convex/quality.ts)."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class OosInvestigation(LimsBase):
    __tablename__ = "oos_investigations"

    oos_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    sample_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("samples.id"), index=True)
    sample_test_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sample_tests.id"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000))
    detected_date: Mapped[str] = mapped_column(String(32))
    detected_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    phase1_summary: Mapped[str | None] = mapped_column(String(4000))
    phase1_completed_date: Mapped[str | None] = mapped_column(String(32))
    phase1_completed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    phase2_summary: Mapped[str | None] = mapped_column(String(4000))
    phase2_completed_date: Mapped[str | None] = mapped_column(String(32))
    phase2_completed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    root_cause: Mapped[str | None] = mapped_column(String(4000))
    root_cause_category: Mapped[str | None] = mapped_column(String(128))
    outcome: Mapped[str | None] = mapped_column(String(16))
    closed_date: Mapped[str | None] = mapped_column(String(32))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(String(4000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Capa(LimsBase):
    __tablename__ = "capas"

    capa_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000))
    capa_type: Mapped[str] = mapped_column(String(16))
    source_type: Mapped[str | None] = mapped_column(String(64))
    source_id: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    priority: Mapped[str] = mapped_column(String(16))
    due_date: Mapped[str | None] = mapped_column(String(32))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    actions: Mapped[str | None] = mapped_column(String(4000))
    implementation_date: Mapped[str | None] = mapped_column(String(32))
    implemented_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    verification_criteria: Mapped[str | None] = mapped_column(String(4000))
    verification_date: Mapped[str | None] = mapped_column(String(32))
    verified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    effectiveness_review: Mapped[str | None] = mapped_column(String(4000))
    closed_date: Mapped[str | None] = mapped_column(String(32))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Deviation(LimsBase):
    __tablename__ = "deviations"

    deviation_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000))
    deviation_type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    detected_date: Mapped[str] = mapped_column(String(32))
    detected_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    investigation: Mapped[str | None] = mapped_column(String(4000))
    root_cause: Mapped[str | None] = mapped_column(String(4000))
    immediate_action: Mapped[str | None] = mapped_column(String(4000))
    closed_date: Mapped[str | None] = mapped_column(String(32))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    linked_capa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("capas.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class ChangeControl(LimsBase):
    __tablename__ = "change_controls"

    change_number: Mapped[str] = mapped_column(String(64), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000))
    change_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    priority: Mapped[str] = mapped_column(String(16))
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    requested_date: Mapped[str] = mapped_column(String(32))
    planned_date: Mapped[str | None] = mapped_column(String(32))
    implemented_date: Mapped[str | None] = mapped_column(String(32))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_date: Mapped[str | None] = mapped_column(String(32))
    risk_assessment: Mapped[str | None] = mapped_column(String(4000))
    justification: Mapped[str | None] = mapped_column(String(4000))
    implementation_plan: Mapped[str | None] = mapped_column(String(4000))
    verification_required: Mapped[bool | None] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(String(4000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
