"""Create dashboard customer and sample read models.

Revision ID: 0002_dashboard_read_model
Revises: 0001_identity_organization
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_dashboard_read_model"
down_revision = "0001_identity_organization"
branch_labels = None
depends_on = None

uuid = postgresql.UUID(as_uuid=True)
now = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "laboratory_id",
            uuid,
            sa.ForeignKey("laboratories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index("ix_customers_laboratory_id", "customers", ["laboratory_id"])
    op.create_table(
        "samples",
        sa.Column("id", uuid, primary_key=True),
        sa.Column("lims_number", sa.String(100), nullable=False, unique=True),
        sa.Column(
            "customer_id",
            uuid,
            sa.ForeignKey("customers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "laboratory_id",
            uuid,
            sa.ForeignKey("laboratories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("sample_name", sa.String(255), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("requested_completion_date", sa.DateTime(timezone=True)),
        sa.Column("received_date", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index("ix_samples_laboratory_id", "samples", ["laboratory_id"])
    op.create_index("ix_samples_status", "samples", ["status"])
    op.create_index("ix_samples_created_at", "samples", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_samples_created_at", table_name="samples")
    op.drop_index("ix_samples_status", table_name="samples")
    op.drop_index("ix_samples_laboratory_id", table_name="samples")
    op.drop_table("samples")
    op.drop_index("ix_customers_laboratory_id", table_name="customers")
    op.drop_table("customers")
