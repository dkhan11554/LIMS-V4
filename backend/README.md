# NextGen AI-LIMS - Python backend

FastAPI/SQLAlchemy/Alembic replacement for the previous Convex backend (see
`/MIGRATION.md` at the repository root for the full rationale, the
module-by-module mapping, and what's left to port).

## Stack

- **FastAPI** for the HTTP + WebSocket API
- **SQLAlchemy 2.0** (declarative, typed `Mapped[...]` models) as the ORM
- **Alembic** for schema migrations
- **Pydantic v2** for request/response validation
- **JWT** auth today (`python-jose` + `passlib`/`bcrypt`), designed to be
  swapped for Active Directory/SSO later without touching routers - see
  `app/core/security.py` and `app/core/deps.py`
- **Postgres** by default; **SQL Server** is supported by SQLAlchemy 2's
  cross-dialect types used throughout the models (swap `DATABASE_URL` +
  install the `mssql` extra)
- **Pytest** for tests (in-memory SQLite; no external services needed)

## Getting started

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # then edit JWT_SECRET_KEY, DATABASE_URL, etc.

# Start Postgres (or point DATABASE_URL at your own instance):
docker compose -f ../docker-compose.yml up -d db

alembic upgrade head
uvicorn app.main:app --reload
```

Interactive API docs (Swagger/OpenAPI) are then served at
`http://localhost:8000/docs`, and `http://localhost:8000/redoc` for ReDoc.

## Running the tests

```bash
pytest
```

Tests spin up an isolated in-memory SQLite database per test via
`app/tests/conftest.py` - no Postgres instance required to run the suite.

## Project layout

```
app/
  core/       settings, JWT auth, RBAC dependencies (app/core/deps.py mirrors
              convex/lib/roles.ts exactly)
  db/         SQLAlchemy engine/session + the declarative Base/mixins
  models/     one file per Convex module (organization.py, samples.py, ...),
              51 tables total - see MIGRATION.md for the full list
  schemas/    Pydantic request/response models
  routers/    FastAPI routers (one per implemented vertical so far)
  services/   business logic that isn't simple CRUD (LIMS numbering,
              realtime pub/sub, file storage)
  tests/      pytest suite
migrations/   Alembic environment + versioned migration scripts
scripts/      one-off scripts, e.g. import_convex_export.py
```

## Migrating data from the old Convex export

The exported Convex snapshot under `../legacy-convex-app/data-export`
(one `<tableName>/documents.jsonl` file per table) can be loaded directly:

```bash
alembic upgrade head
python scripts/import_convex_export.py ../legacy-convex-app/data-export
```

The importer is generic (driven by column introspection + naming
convention), remaps every Convex document id to a new UUID primary key, and
resolves every foreign key (including the JSON columns that hold *lists* of
ids, e.g. `linked_method_ids`) through a single id map built up-front. See
the module docstring in `scripts/import_convex_export.py` for the full
design notes, including how the one genuine reference cycle in the schema
(`users` <-> `departments`/`laboratories`/`companies`) is resolved.

## What's implemented vs. what's scaffolded

This backend currently has fully working, tested vertical slices for:
auth/JWT, users, companies/laboratories/departments, customers, the test
catalogue, and the core sample registration + status-transition workflow
(including the LIMS-number generator and chain-of-custody logging).

Every one of the 51 tables from the old `convex/schema.ts` has a complete,
migration-ready SQLAlchemy model (see `app/models/`), and the data importer
covers all of them - but most of the remaining ~20 Convex modules (quality
management, billing, instruments/QC, training, audits, AI copilot, etc.)
still need their routers/business logic ported. See `/MIGRATION.md` for the
full table of what's done vs. outstanding, grouped by relative complexity.
