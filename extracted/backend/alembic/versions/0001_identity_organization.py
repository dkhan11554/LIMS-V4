"""Create identity and organization tables.

Revision ID: 0001_identity_organization
Revises:
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_identity_organization"
down_revision = None
branch_labels = None
depends_on = None

uuid = postgresql.UUID(as_uuid=True)
now = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("entra_object_id", sa.String(255), nullable=False, unique=True),
        sa.Column("email", sa.String(320), nullable=True, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="analyst"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_disabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("department_id", uuid, nullable=True),
        sa.Column(
            "manager_id",
            uuid,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index("ix_users_entra_object_id", "users", ["entra_object_id"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table(
        "companies",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("address", sa.Text()),
        sa.Column("country", sa.String(100)),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(320)),
        sa.Column("website", sa.String(2048)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "laboratories",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column(
            "company_id", uuid, sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("address", sa.Text()),
        sa.Column("country", sa.String(100)),
        sa.Column("timezone", sa.String(100)),
        sa.Column("accreditation_number", sa.String(100)),
        sa.Column("accreditation_expiry", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint("company_id", "code", name="uq_laboratory_company_code"),
    )
    op.create_table(
        "departments",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column(
            "laboratory_id",
            uuid,
            sa.ForeignKey("laboratories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("manager_id", uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("description", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint("laboratory_id", "code", name="uq_department_laboratory_code"),
    )
    op.create_foreign_key(
        "fk_users_department_id",
        "users",
        "departments",
        ["department_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "user_laboratories",
        sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "laboratory_id",
            uuid,
            sa.ForeignKey("laboratories.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("user_laboratories")
    op.drop_constraint("fk_users_department_id", "users", type_="foreignkey")
    op.drop_table("departments")
    op.drop_table("laboratories")
    op.drop_table("companies")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_entra_object_id", table_name="users")
    op.drop_table("users")
