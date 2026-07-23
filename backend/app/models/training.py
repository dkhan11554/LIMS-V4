"""Mirrors convex/schema.ts `trainingCourses`, `trainingAssignments`
(see convex/training.ts)."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class TrainingCourse(LimsBase):
    __tablename__ = "training_courses"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    course_code: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(String(2000))
    linked_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"))
    linked_method_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("test_methods.id"))
    duration_hours: Mapped[float | None] = mapped_column(Float)
    validity_months: Mapped[int | None] = mapped_column(Integer)
    assessment_required: Mapped[bool] = mapped_column(Boolean, default=False)
    passing_score: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class TrainingAssignment(LimsBase):
    __tablename__ = "training_assignments"

    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_courses.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    assigned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_date: Mapped[str] = mapped_column(String(32))
    due_date: Mapped[str | None] = mapped_column(String(32))
    completed_date: Mapped[str | None] = mapped_column(String(32))
    expiry_date: Mapped[str | None] = mapped_column(String(32))
    assessment_score: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default="assigned")
    notes: Mapped[str | None] = mapped_column(String(2000))
