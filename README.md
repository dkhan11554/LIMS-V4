# NextGen AI-LIMS

A laboratory information management system (LIMS) with integrated quality
management (CAPA/deviations/OOS/audits/change control) and light ERP
(billing, expenses/budgets) capabilities, being migrated from a Convex
backend to a Python (FastAPI) backend.

**Start here: [`MIGRATION.md`](./MIGRATION.md)** - the stack review, the
migration plan, current status, and the full module-by-module mapping.

## Layout

| Path | What it is |
|---|---|
| [`backend/`](./backend) | The new Python (FastAPI + SQLAlchemy 2 + Alembic) backend. See [`backend/README.md`](./backend/README.md) to run it. |
| [`frontend/`](./frontend) | The React 19 + Vite SPA (kept as-is for now; its data layer still targets Convex - see `MIGRATION.md` §4 for the integration plan). |
| [`legacy-convex-app/`](./legacy-convex-app) | The previous Convex backend + a data export, kept only as a reference for porting business logic. Not run anymore. |
| [`docker-compose.yml`](./docker-compose.yml) | Postgres + the new backend, for local development. |
