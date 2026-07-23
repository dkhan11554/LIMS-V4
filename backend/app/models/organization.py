"""Auth + organization hierarchy. Mirrors convex/schema.ts `users`, `companies`,
`laboratories`, `departments` tables (see convex/organization.ts, convex/users.ts).
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase

# Role hierarchy, ported 1:1 from convex/lib/roles.ts::LIMS_ROLES.
LIMS_ROLES = (
    "system_admin",
    "lab_manager",
    "supervisor",
    "analyst",
    "qa_officer",
    "reception",
    "customer",
)


class User(LimsBase):
    __tablename__ = "users"

    # Phase 1 (JWT): local credential store. Phase 2 (Active Directory): this
    # becomes nullable and `auth_provider`/`external_id` are used instead -
    # see MIGRATION.md "Authentication".
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    auth_provider: Mapped[str] = mapped_column(String(32), default="local")  # local | active_directory | oidc
    external_id: Mapped[str | None] = mapped_column(String(255), index=True)

    name: Mapped[str | None] = mapped_column(String(255))
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(32), default="analyst")
    laboratories_access: Mapped[list | None] = mapped_column(JSON)  # list[str(UUID)]
    # `use_alter`: users <-> departments <-> laboratories <-> companies form a
    # reference cycle (a user belongs to a department, a department belongs to
    # a lab, a lab belongs to a company, and a company records which user
    # created it). Convex has no enforced FK constraints so this cycle was
    # invisible there; in SQL we break it by adding this one constraint via a
    # separate ALTER TABLE (Alembic/`create_all` emit it after every table
    # exists) instead of inline in `CREATE TABLE users`.
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", use_alter=True, name="fk_users_department_id")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    account_status: Mapped[str | None] = mapped_column(String(32))
    employee_number: Mapped[str | None] = mapped_column(String(64))
    phone: Mapped[str | None] = mapped_column(String(64))
    job_title: Mapped[str | None] = mapped_column(String(255))
    designation: Mapped[str | None] = mapped_column(String(255))
    business_unit: Mapped[str | None] = mapped_column(String(255))
    site_location: Mapped[str | None] = mapped_column(String(255))
    cost_center: Mapped[str | None] = mapped_column(String(64))
    employment_type: Mapped[str | None] = mapped_column(String(64))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    timezone: Mapped[str | None] = mapped_column(String(64))
    language: Mapped[str | None] = mapped_column(String(16))
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    digital_signature_url: Mapped[str | None] = mapped_column(String(1024))
    bio: Mapped[str | None] = mapped_column(String(2000))
    qualifications: Mapped[list | None] = mapped_column(JSON)
    last_login_at: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class Company(LimsBase):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255))
    legal_name: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(1000))
    country: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(1024))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Laboratory(LimsBase):
    __tablename__ = "laboratories"

    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(32), index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    address: Mapped[str | None] = mapped_column(String(1000))
    country: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str | None] = mapped_column(String(64))
    accreditation_number: Mapped[str | None] = mapped_column(String(128))
    accreditation_expiry: Mapped[str | None] = mapped_column(String(32))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Department(LimsBase):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(32))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    description: Mapped[str | None] = mapped_column(String(1000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
