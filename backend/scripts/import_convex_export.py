#!/usr/bin/env python3
"""One-time data migration: Convex JSONL export -> the new SQL schema.

Usage:
    python scripts/import_convex_export.py /path/to/legacy-convex-app/data-export

Design (see MIGRATION.md "Data migration" for the full write-up):

1. Every Convex table is exported as `<tableName>/documents.jsonl`, one JSON
   object per line, each with a `_id` (opaque string) and `_creationTime`
   (epoch-ms float) system field.
2. This script is *generic*: it walks `app.models` and, for every mapped
   table, reads the matching export file and converts each document's
   camelCase fields into the corresponding snake_case SQLAlchemy column
   using naming convention alone - no per-table hand-written mapping code
   is needed for the ~90% of columns that pass straight through.
3. Convex's `_id` strings (e.g. "k571bf7952ap...") are replaced with proper
   UUID primary keys. Foreign-key columns (and the handful of JSON columns
   that hold *lists* of ids, e.g. `linked_method_ids`) are resolved through
   a single process-wide `old_id -> new_uuid` map, built in a first pass
   over *every* table before any row is inserted - so it doesn't matter
   which table happens to be exported/inserted first.
4. Row insertion itself still has to happen in dependency order (a FOREIGN
   KEY constraint requires the parent row to physically exist first). The
   one genuine cycle in this schema - users <-> departments <-> laboratories
   <-> companies (a user belongs to a department; a department/lab/company
   records which user created/manages it) - is broken by inserting users
   with `department_id` deferred to NULL, then fixing it up with an UPDATE
   once the departments table has been imported.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import Integer, JSON, update  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models as _models  # noqa: E402,F401  (populates Base.metadata)
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.organization import User  # noqa: E402
from app.services.casing import snake_to_camel  # noqa: E402

# convexTableName -> ORM model class. Add new tables here as they're modelled.
from app.models import (  # noqa: E402
    audit_trail, audits, billing, calculations, catalogue, coa, complaints,
    customers, documents, error_logs, instruments, inventory, notifications,
    organization, quality, retest, revenue, samples, specifications, storage,
    suppliers, system_config, training, validation,
)

CONVEX_TABLE_MODEL_MAP: dict[str, type] = {
    "users": organization.User,
    "companies": organization.Company,
    "laboratories": organization.Laboratory,
    "departments": organization.Department,
    "customers": customers.Customer,
    "customerContacts": customers.CustomerContact,
    "customerProjects": customers.CustomerProject,
    "testMethods": catalogue.TestMethod,
    "tests": catalogue.Test,
    "samples": samples.Sample,
    "sampleTests": samples.SampleTest,
    "chainOfCustody": samples.ChainOfCustody,
    "instruments": instruments.Instrument,
    "instrumentCalibrations": instruments.InstrumentCalibration,
    "instrumentMaintenance": instruments.InstrumentMaintenance,
    "instrumentInterfaces": instruments.InstrumentInterface,
    "instrumentResultBatches": instruments.InstrumentResultBatch,
    "instrumentResultRows": instruments.InstrumentResultRow,
    "instrumentQcResults": instruments.InstrumentQcResult,
    "inventoryItems": inventory.InventoryItem,
    "inventoryTransactions": inventory.InventoryTransaction,
    "quotations": billing.Quotation,
    "invoices": billing.Invoice,
    "payments": billing.Payment,
    "complaints": complaints.Complaint,
    "oosInvestigations": quality.OosInvestigation,
    "deviations": quality.Deviation,
    "capas": quality.Capa,
    "changeControls": quality.ChangeControl,
    "documents": documents.Document,
    "storageLocations": storage.StorageLocation,
    "sampleStorageAssignments": storage.SampleStorageAssignment,
    "suppliers": suppliers.Supplier,
    "trainingCourses": training.TrainingCourse,
    "trainingAssignments": training.TrainingAssignment,
    "audits": audits.Audit,
    "auditFindings": audits.AuditFinding,
    "systemConfig": system_config.SystemConfig,
    "limsCounters": system_config.LimsCounter,
    "auditTrail": audit_trail.AuditTrailEntry,
    "notifications": notifications.Notification,
    "expenses": revenue.Expense,
    "budgets": revenue.Budget,
    "calculationFormulas": calculations.CalculationFormula,
    "sampleTestCalculations": calculations.SampleTestCalculation,
    "retestRequests": retest.RetestRequest,
    "specificationSets": specifications.SpecificationSet,
    "specificationParameters": specifications.SpecificationParameter,
    "coaRecords": coa.CoaRecord,
    "resultValidations": validation.ResultValidation,
    "errorLogs": error_logs.ErrorLog,
}

# JSON columns that hold a *list* of Convex ids (rather than a scalar FK)
# and therefore also need id-remapping.
ID_LIST_FIELDS = {
    "laboratories_access",
    "linked_method_ids",
    "linked_instrument_ids",
    "departments",
    "sample_ids",
}

# (table, attribute) -> convex JSON key, for the few fields that don't
# follow the generic camelCase<->snake_case convention.
FIELD_KEY_OVERRIDES = {
    ("documents", "file_storage_key"): "fileStorageId",
}


def _load_documents(export_dir: Path, convex_table: str) -> list[dict]:
    path = export_dir / convex_table / "documents.jsonl"
    if not path.exists():
        print(f"  (skip) no export file for '{convex_table}'")
        return []
    docs = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                docs.append(json.loads(line))
    return docs


def _build_id_map(export_dir: Path) -> tuple[dict[str, UUID], dict[str, list[dict]]]:
    id_map: dict[str, UUID] = {}
    docs_by_table: dict[str, list[dict]] = {}
    for convex_table in CONVEX_TABLE_MODEL_MAP:
        docs = _load_documents(export_dir, convex_table)
        docs_by_table[convex_table] = docs
        for doc in docs:
            id_map[doc["_id"]] = uuid4()
    return id_map, docs_by_table


def _coerce_scalar(value, column):
    if value is None:
        return None
    if isinstance(column.type, Integer) and isinstance(value, float):
        return int(value)
    return value


def _build_kwargs(model, doc: dict, table_name: str, id_map: dict[str, UUID], warnings: list[str]) -> dict:
    kwargs: dict = {}
    for column in model.__table__.columns:
        attr = column.key
        if attr in ("id", "legacy_id", "created_at"):
            continue

        convex_key = FIELD_KEY_OVERRIDES.get((table_name, attr), snake_to_camel(attr))
        if convex_key not in doc:
            continue
        value = doc[convex_key]

        if column.foreign_keys:
            if value is None:
                kwargs[attr] = None
            else:
                resolved = id_map.get(value)
                if resolved is None:
                    warnings.append(f"{table_name}.{attr}: unresolved reference {value!r}")
                kwargs[attr] = resolved
        elif attr in ID_LIST_FIELDS and isinstance(column.type, JSON):
            if value is None:
                kwargs[attr] = None
            else:
                kwargs[attr] = [str(id_map[v]) for v in value if v in id_map]
        else:
            kwargs[attr] = _coerce_scalar(value, column)

    return kwargs


def run_import(export_dir: Path) -> None:
    id_map, docs_by_table = _build_id_map(export_dir)
    print(f"Discovered {len(id_map)} documents across {len(docs_by_table)} tables.\n")

    db: Session = SessionLocal()
    warnings: list[str] = []
    deferred_user_departments: list[tuple[UUID, str]] = []
    seen_user_emails: set[str] = set()

    try:
        for table in Base.metadata.sorted_tables:
            convex_table = next(
                (name for name, model in CONVEX_TABLE_MODEL_MAP.items() if model.__table__ is table),
                None,
            )
            if convex_table is None:
                continue

            model = CONVEX_TABLE_MODEL_MAP[convex_table]
            docs = docs_by_table.get(convex_table, [])
            if not docs:
                continue

            print(f"Importing {len(docs):>5} rows -> {table.name} ({convex_table})")
            for doc in docs:
                kwargs = _build_kwargs(model, doc, convex_table, id_map, warnings)

                if model is User:
                    convex_dept_id = doc.get("departmentId")
                    if convex_dept_id:
                        deferred_user_departments.append((id_map[doc["_id"]], convex_dept_id))
                    kwargs["department_id"] = None

                    # The legacy data has no unique constraint on email and
                    # contains accidental duplicates among disabled/archived
                    # test accounts. Null out later dupes rather than fail
                    # the whole import - flag them for manual reconciliation.
                    email = kwargs.get("email")
                    if email:
                        email_lower = email.lower()
                        if email_lower in seen_user_emails:
                            warnings.append(
                                f"users: duplicate email {email!r} on legacy id {doc['_id']} - "
                                "email cleared, needs manual reconciliation"
                            )
                            kwargs["email"] = None
                        else:
                            seen_user_emails.add(email_lower)

                creation_time = doc.get("_creationTime")
                created_at = (
                    datetime.fromtimestamp(creation_time / 1000, tz=timezone.utc)
                    if creation_time
                    else datetime.now(timezone.utc)
                )

                db.add(model(id=id_map[doc["_id"]], legacy_id=doc["_id"], created_at=created_at, **kwargs))
            db.flush()

        for user_id, convex_dept_id in deferred_user_departments:
            dept_uuid = id_map.get(convex_dept_id)
            if dept_uuid:
                db.execute(update(User).where(User.id == user_id).values(department_id=dept_uuid))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings[:50]:
            print("  -", w)
        if len(warnings) > 50:
            print(f"  ... and {len(warnings) - 50} more")
    print("\nImport complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "export_dir",
        type=Path,
        help="Path to the extracted Convex snapshot export (the directory containing "
        "one subdirectory per table, e.g. legacy-convex-app/data-export)",
    )
    args = parser.parse_args()

    print(f"Target database: {engine.url}")
    run_import(args.export_dir)
