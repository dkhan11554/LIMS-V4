"""Mirrors convex/schema.ts `documents` (see convex/documents.ts).

`fileStorageId` (a Convex storage blob reference) becomes `file_storage_key`,
a string key into whichever `FileStorage` backend is configured
(local disk or MinIO) - see app/services/file_storage.py."""

import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Document(LimsBase):
    __tablename__ = "documents"

    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    document_number: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(32))
    version: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    owner: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    effective_date: Mapped[str | None] = mapped_column(String(32))
    review_date: Mapped[str | None] = mapped_column(String(32))
    expiry_date: Mapped[str | None] = mapped_column(String(32))
    file_url: Mapped[str | None] = mapped_column(String(1024))
    file_storage_key: Mapped[str | None] = mapped_column(String(512))
    file_name: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(String(2000))
    keywords: Mapped[list | None] = mapped_column(JSON)
    linked_method_ids: Mapped[list | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
