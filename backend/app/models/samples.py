"""Mirrors convex/schema.ts `samples`, `sampleTests`, `chainOfCustody`
(see convex/samples.ts) - the central workflow of the LIMS."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase

SAMPLE_PRIORITIES = ("routine", "urgent", "stat")

SAMPLE_STATUSES = (
    "draft", "registered", "awaiting_receipt", "received", "accepted", "rejected",
    "assigned", "preparation", "testing", "result_entered", "pending_review",
    "returned", "pending_qa", "oos_investigation", "approved", "coa_generated",
    "delivered", "stored", "disposed", "cancelled",
)

SAMPLE_TEST_STATUSES = (
    "not_assigned", "assigned", "in_progress", "result_entered", "submitted",
    "returned", "technically_approved", "qa_approved", "failed", "oos", "cancelled",
)


class Sample(LimsBase):
    __tablename__ = "samples"

    lims_number: Mapped[str] = mapped_column(String(64), index=True)
    customer_sample_number: Mapped[str | None] = mapped_column(String(128))
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_projects.id"))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    sample_name: Mapped[str] = mapped_column(String(255))
    sample_type: Mapped[str | None] = mapped_column(String(128))
    product: Mapped[str | None] = mapped_column(String(255))
    batch_number: Mapped[str | None] = mapped_column(String(128))
    lot_number: Mapped[str | None] = mapped_column(String(128))
    manufacturing_date: Mapped[str | None] = mapped_column(String(32))
    expiry_date: Mapped[str | None] = mapped_column(String(32))
    collection_date: Mapped[str | None] = mapped_column(String(32))
    collection_location: Mapped[str | None] = mapped_column(String(255))
    received_date: Mapped[str | None] = mapped_column(String(32))
    priority: Mapped[str] = mapped_column(String(16), default="routine")
    container_type: Mapped[str | None] = mapped_column(String(128))
    container_count: Mapped[int | None] = mapped_column(Integer)
    sample_volume: Mapped[str | None] = mapped_column(String(64))
    storage_condition: Mapped[str | None] = mapped_column(String(128))
    requested_completion_date: Mapped[str | None] = mapped_column(String(32))
    customer_instructions: Mapped[str | None] = mapped_column(String(2000))
    internal_notes: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    package_condition: Mapped[str | None] = mapped_column(String(32))
    container_condition: Mapped[str | None] = mapped_column(String(32))
    seal_condition: Mapped[str | None] = mapped_column(String(32))
    temperature: Mapped[str | None] = mapped_column(String(32))
    temperature_adequate: Mapped[bool | None] = mapped_column(Boolean)
    sample_condition_notes: Mapped[str | None] = mapped_column(String(2000))
    rejection_reason: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class SampleTest(LimsBase):
    __tablename__ = "sample_tests"

    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tests.id"))
    status: Mapped[str] = mapped_column(String(32), default="not_assigned", index=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_at: Mapped[str | None] = mapped_column(String(32))
    started_at: Mapped[str | None] = mapped_column(String(32))
    completed_at: Mapped[str | None] = mapped_column(String(32))
    result: Mapped[str | None] = mapped_column(String(255))
    pass_fail_status: Mapped[str | None] = mapped_column(String(8))
    comments: Mapped[str | None] = mapped_column(String(2000))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[str | None] = mapped_column(String(32))
    review_comments: Mapped[str | None] = mapped_column(String(2000))
    qa_approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    qa_approved_at: Mapped[str | None] = mapped_column(String(32))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class ChainOfCustody(LimsBase):
    __tablename__ = "chain_of_custody"

    sample_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("samples.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))
    from_name: Mapped[str | None] = mapped_column(String(255))
    to_name: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(String(2000))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    timestamp: Mapped[str] = mapped_column(String(32))
