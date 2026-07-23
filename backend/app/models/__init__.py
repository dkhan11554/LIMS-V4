"""Import every model module so `Base.metadata` is fully populated for Alembic
autogenerate and for `Base.metadata.create_all()` in tests.

The 49 tables here are a 1:1 port of the 49 tables previously defined in the
Convex `convex/schema.ts` file (see MIGRATION.md for the full mapping)."""

from app.models import (  # noqa: F401
    audit_trail,
    audits,
    billing,
    calculations,
    catalogue,
    coa,
    complaints,
    customers,
    documents,
    error_logs,
    instruments,
    inventory,
    notifications,
    organization,
    quality,
    retest,
    revenue,
    samples,
    specifications,
    storage,
    suppliers,
    system_config,
    training,
    validation,
)

__all__ = [
    "organization",
    "customers",
    "catalogue",
    "samples",
    "instruments",
    "inventory",
    "billing",
    "revenue",
    "complaints",
    "quality",
    "documents",
    "storage",
    "suppliers",
    "training",
    "audits",
    "system_config",
    "audit_trail",
    "notifications",
    "calculations",
    "retest",
    "specifications",
    "coa",
    "validation",
    "error_logs",
]
