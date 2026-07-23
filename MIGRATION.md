# Convex → Python migration plan (NextGen AI-LIMS)

This document is the review you asked for of the proposed technology stack,
plus the concrete migration plan and status for this repository. It assumes
the reader is picking this repo up cold, so it starts with what the system
actually is before getting into the stack review.

## 0. What's actually in this repository

The two files that were previously sitting at the repo root
(`Code version Latest 4.gz`, `Data Base Version Latest 4.zip`) have been
unpacked into:

- **`frontend/`** - the React 19 + Vite + Tailwind SPA (kept as-is for now).
- **`legacy-convex-app/convex/`** - the *old* Convex backend: 51 tables in
  `schema.ts` and ~8,300 lines of TypeScript across 24 modules implementing
  a full-featured LIMS/QMS/ERP: sample lifecycle & chain of custody,
  instrument calibration/maintenance/QC + file-based result import,
  inventory, billing (quotations/invoices/payments/complaints), quality
  management (OOS investigations, deviations, CAPAs, change controls,
  audits), document control, training, supplier qualification, retesting,
  specifications, COA generation, result validation (spec/Westgard/trend),
  an AI copilot (OpenAI), analytics, scheduling, and RBAC. This is kept
  purely as a **reference** for porting business logic - it is not run
  anymore and can be deleted once the migration below is complete.
- **`legacy-convex-app/data-export/`** - a snapshot export of the Convex
  database (JSONL per table) - this is demo/seed data (a few dozen to a
  couple hundred rows per table), not a large production dataset, which
  meaningfully lowers the risk/effort of the data migration step.
- **`backend/`** - the **new** Python backend described below.

So: yes, this is a real, non-trivial system (a pharma/analytical-lab LIMS),
not a toy CRUD app. That's the right context for judging the stack below.

## 1. Review of the proposed stack

| Area | Your proposal | Verdict |
|---|---|---|
| Frontend | Keep existing React app | **Agree.** The UI/UX and 30+ pages don't need to be rewritten. The only real work is swapping the data-fetching layer (Convex's `useQuery`/`useMutation` hooks + `@usehercules/auth`) for REST calls + a WebSocket client - see §4. |
| Backend | FastAPI | **Agree.** Async-capable, excellent typing/OpenAPI integration, and the dependency-injection model maps almost 1:1 onto Convex's `ctx`-based query/mutation handlers (see `app/core/deps.py`). |
| Database | SQL Server or PostgreSQL | **Agree, and both are viable with the same codebase.** SQLAlchemy 2's cross-dialect types (`Uuid`, `JSON`, `DateTime(timezone=True)`) are used throughout `app/models/` specifically so the same models work against either engine - only `DATABASE_URL` changes. Recommendation: **default to PostgreSQL** for new environments (better JSON support, `psycopg` needs no native client library on the app server) and reserve SQL Server for shops with an existing SQL Server operations team/licensing. |
| ORM | SQLAlchemy 2 | **Agree.** The 2.0 `Mapped[...]`/`mapped_column()` style is used throughout - see `app/models/`. |
| Migrations | Alembic | **Agree.** Wired up in `backend/migrations/`; `alembic revision --autogenerate` already produces a correct initial migration for all 51 tables (verified in this repo). |
| Auth | JWT initially; Active Directory later | **Agree, and it's a good sequencing decision.** See §3. |
| Validation | Pydantic | **Agree.** Pydantic v2 schemas in `app/schemas/`. |
| Testing | Pytest | **Agree.** `backend/app/tests/` - 11 tests passing today (auth, RBAC, and the full sample-registration workflow) against an in-memory SQLite DB, no external services required. |
| File storage | Local storage or MinIO | **Agree.** `app/services/file_storage.py` implements both behind one interface, selected via `STORAGE_BACKEND`. |
| Real-time | WebSockets | **Agree, with one caveat spelled out in §5:** Convex's reactivity is automatic; a hand-rolled WebSocket layer is explicit (routers must remember to publish events). That's a real behavior change, not just a technology swap. |
| Deployment | Docker Compose | **Agree** for dev/small deployments - see root `docker-compose.yml`. |
| Enterprise deployment | Windows Server, Linux, or Kubernetes | **Agree.** A stateless FastAPI container + managed/clustered Postgres or SQL Server behind it works on all three. The only WebSocket-specific note: if you run more than one backend replica (K8s with >1 pod, or a Windows NLB with >1 instance), the in-process pub/sub in `app/services/realtime.py` needs a shared backplane (Redis pub/sub, or Postgres `LISTEN/NOTIFY`) - documented in that file's docstring. |
| API docs | OpenAPI/Swagger | **Agree, and it's free.** FastAPI generates it automatically from the Pydantic schemas + routers; live at `/docs` and `/redoc`. |

**Bottom line: yes, this stack is correct and I can do this migration.** It's
a well-chosen, boring/proven, enterprise-friendly stack for a regulated
LIMS - no changes recommended. The rest of this document is the concrete
plan plus what's already been built in this branch as a starting point.

## 2. What has been built already (this branch)

- **All 51 tables modelled** in SQLAlchemy (`backend/app/models/`), a
  faithful 1:1 port of every table in `convex/schema.ts`, including every
  field, nullability, and enum-like status field. Verified to create
  cleanly (`Base.metadata.create_all`) with zero foreign-key-cycle issues.
- **Alembic wired up** (`backend/migrations/`), with a working initial
  migration (`alembic upgrade head` / `alembic downgrade base` both tested).
- **JWT auth** (register/login/refresh/me) - `app/routers/auth.py`,
  `app/core/security.py`.
- **RBAC ported 1:1** from `convex/lib/roles.ts` to `app/core/deps.py`
  (`require_role`, `require_admin`, `require_manager`,
  `require_sample_manager`, `require_qa`, `require_reviewer`,
  `require_billing` - same names, same semantics, including the
  `system_admin` superuser bypass).
- **Fully working, tested vertical slices**: users, companies/laboratories/
  departments, customers, test catalogue, and - most importantly - the core
  **sample registration and status-transition workflow**, including the
  LIMS-number generator (`app/services/lims_numbering.py`, a direct port of
  `getNextLimsNumber` using `SELECT ... FOR UPDATE` instead of Convex's
  implicit mutation serializability) and chain-of-custody logging.
- **A generic data-migration script**
  (`backend/scripts/import_convex_export.py`) that loads the Convex JSONL
  export into the new schema for *all* 51 tables, remapping every id
  (including JSON columns that hold lists of ids) - already run
  successfully end-to-end against the real exported demo data in this repo.
- **Docker Compose** (root `docker-compose.yml`) for Postgres + the backend.
- **11 passing pytest tests** exercising the above.

Run it yourself:

```bash
cd backend
pip install -e ".[dev]"
pytest                      # 11 passed
cp .env.example .env
docker compose -f ../docker-compose.yml up -d db
alembic upgrade head
python scripts/import_convex_export.py ../legacy-convex-app/data-export
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## 3. Authentication: JWT now, Active Directory later

The current Convex app already delegates auth to an external OIDC provider
(`@usehercules/auth` + `oidc-client-ts`/`react-oidc-context`) - it does not
use Convex's own auth. That's actually convenient: it means the frontend
already speaks OAuth2/OIDC "shapes" (bearer tokens, a `/auth/callback`
route), so swapping the *issuer* is lower-risk than it might sound.

- **Phase 1 (this repo today):** local username/password + JWT, via
  `app/core/security.py` / `app/core/deps.py`. First registered user is
  auto-promoted to `system_admin` (bootstrap convenience - lock this down
  once real users exist).
- **Phase 2 (Active Directory):** two supported paths, same downstream
  code:
  1. **LDAP bind** against AD directly (`ldap3`), issuing our own JWTs after
     a successful bind - swap only `authenticate_user()`; `deps.py`,
     routers, and RBAC are untouched.
  2. **Federate via ADFS/Entra ID (OIDC)** - the frontend redirects to
     Azure AD/ADFS, and the backend verifies *their* JWTs (issuer, audience,
     signature via their JWKS endpoint) instead of minting its own. This is
     the closer match to how the app already behaves under Convex/Hercules.

Either way, `User.role` (the LIMS RBAC role) stays a first-class column
here, separate from the AD group membership - map AD groups → LIMS roles at
login time.

## 4. Frontend integration (the largest remaining chunk of work)

The React app is kept, but its data layer needs to change. Convex usage is
spread across roughly **50 files** (every page + a handful of hooks/
providers), all going through 2-3 files that centralize the client:

- `src/components/providers/convex.tsx` → replace with a small REST client
  (`fetch`/`axios` + a thin wrapper that attaches the JWT and refreshes it)
  and a React Query (`@tanstack/react-query`, already a dependency)
  `QueryClientProvider`.
- Every `useQuery(api.samples.list, {...})` → `useQuery({ queryKey: [...],
  queryFn: () => apiClient.get("/samples") })` (React Query, not Convex's
  hook of the same name - already installed).
- Every `useMutation(api.samples.register)` → React Query's `useMutation`
  calling the REST endpoint, with `queryClient.invalidateQueries(...)` (or a
  WebSocket-driven cache update, see below) replacing Convex's automatic
  re-render-on-change.
- `@usehercules/auth`, `oidc-client-ts`, `react-oidc-context` → replaced by
  a small auth context storing the JWT (e.g. in memory + refresh via
  httpOnly cookie, or `localStorage` for a v1) and calling
  `/api/v1/auth/login` / `/refresh`.
- `vite.config.ts`: remove the `@usehercules/vite` plugin and the
  `@/convex` alias; add `VITE_API_BASE_URL` / `VITE_WS_BASE_URL` env vars.
- `convex` package and `convex-test` dependency removed from `package.json`.

This is mechanical but touches every page, so it's the single largest
remaining piece of work in the whole migration by file count (not by
difficulty - each change is small and repetitive).

## 5. Real-time updates: Convex reactivity → explicit WebSocket events

Convex re-ran subscribed queries and pushed new results automatically -
nobody had to think about it. A hand-rolled backend has no automatic
equivalent, so `app/services/realtime.py` implements an explicit pub/sub
hub: any router that mutates something another screen displays must call
`await hub.publish(topic, message)` (see `app/routers/notifications.py` for
the pattern). This is the one place where "swap the technology" isn't
enough - each ported mutation needs a one-line addition to publish its
event, and each frontend screen needs to subscribe to the relevant topic
and merge the pushed update into its React Query cache (or just
`invalidateQueries` on receipt, which is simpler and fine for a v1).

Scaling note: the current hub is in-process (fine for one backend replica).
Running multiple replicas (Kubernetes, or a load-balanced Windows/Linux
deployment) needs a shared backplane - swap the in-memory dict for Redis
pub/sub without changing the `publish`/`subscribe` call sites.

## 6. Full module mapping: Convex → Python

Legend: ✅ done (router + schema + tests) · 🟡 model done, router pending ·
⬜ not started. "Relative complexity" reflects how much business logic
needs porting (not calendar time).

| Convex module | Lines | New backend location | Status | Relative complexity |
|---|---:|---|---|---|
| `lib/roles.ts` | 116 | `app/core/deps.py` | ✅ | Small - already ported verbatim |
| `auth.config.ts` | 10 | `app/core/security.py`, `app/routers/auth.py` | ✅ (JWT) | Small |
| `users.ts` | 373 | `app/models/organization.py`, `app/routers/users.py` | ✅ | Medium |
| `organization.ts` | 151 | `app/models/organization.py`, `app/routers/organization.py` | ✅ | Small |
| `customers.ts` | 215 | `app/models/customers.py`, `app/routers/customers.py` | ✅ (customers only; contacts/projects endpoints pending) | Medium |
| `catalogue.ts` | 189 | `app/models/catalogue.py`, `app/routers/catalogue.py` | ✅ | Small |
| `samples.ts` | 865 | `app/models/samples.py`, `app/routers/samples.py`, `app/services/lims_numbering.py` | ✅ core flow (register, status transitions, assigned-to-me); worksheet/receipt-inspection/rejection endpoints pending | **Large** - the central workflow |
| `validation.ts` | 320 | `app/models/validation.py` | 🟡 | Large - spec/Westgard/trend rule engine |
| `calculations.ts` | 363 | `app/models/calculations.py` | 🟡 | Large - formula evaluator (safe expression eval; the `formula` string format ports directly) |
| `quality.ts` | 403 | `app/models/quality.py` | 🟡 | Large - 4 sub-workflows (OOS, deviations, CAPA, change control) |
| `billing.ts` | 367 | `app/models/billing.py`, `app/models/complaints.py` | 🟡 | Large - quotations/invoices/payments + complaints + numbering sequences |
| `instruments.ts` | 251 | `app/models/instruments.py` | 🟡 | Medium |
| `instrumentIntegration.ts` | 472 | `app/models/instruments.py` | 🟡 | Large - CSV/TSV parsing + column-mapping engine |
| `inventory.ts` | 218 | `app/models/inventory.py` | 🟡 | Medium |
| `documents.ts` | 117 | `app/models/documents.py`, `app/services/file_storage.py` | 🟡 | Medium |
| `coa.ts` | 192 | `app/models/coa.py` | 🟡 | Medium - PDF generation needs a Python equivalent of `jspdf` (e.g. WeasyPrint/ReportLab) |
| `storage.ts` | 121 | `app/models/storage.py` | 🟡 | Small |
| `suppliers.ts` | 78 | `app/models/suppliers.py` | 🟡 | Small |
| `training.ts` | 121 | `app/models/training.py` | 🟡 | Small |
| `audits.ts` | 107 | `app/models/audits.py` | 🟡 | Small |
| `config.ts` | 50 | `app/models/system_config.py` | 🟡 | Small |
| `notifications.ts` | 42 | `app/models/notifications.py`, `app/routers/notifications.py` | ✅ (list/read; publishers to be added per-module as each is ported) | Small |
| `errorLogs.ts` | 126 | `app/models/error_logs.py` | 🟡 | Small |
| `revenue.ts` | 239 | `app/models/revenue.py` | 🟡 | Medium |
| `scheduling.ts` | 252 | *(no dedicated table - reads/aggregates `sampleTests`)* | ⬜ | Medium |
| `analytics.ts` | 420 | *(no dedicated table - aggregation queries)* | ⬜ | Large - mostly SQL aggregation (`GROUP BY`/window functions), a good fit for SQLAlchemy Core |
| `ai.ts` | 886 | *(no dedicated table)* | ⬜ | Large - OpenAI SDK calls port almost unchanged (same REST API, official `openai` Python SDK) |

Also not yet ORM-modelled from `schema.ts` beyond the two extra tables that
came bundled into `billing.ts`/`validation.ts`/`calculations.ts` above
(`retestRequests`, `specificationSets`, `specificationParameters`) - those
already have models in `app/models/retest.py` and
`app/models/specifications.py` (🟡, routers pending).

## 7. Suggested execution order for the remaining work

1. **Quality + validation + calculations** (`quality.ts`, `validation.ts`,
   `calculations.ts`) - these are the regulatory backbone (OOS/CAPA/
   deviations) and are pure business logic with no external dependencies,
   so they're both high-value and low-risk to port next.
2. **Billing + complaints, instruments + instrument integration, inventory,
   documents, storage, suppliers, training, audits** - mostly
   straightforward CRUD following the exact pattern already established in
   `app/routers/customers.py` / `app/routers/catalogue.py`.
3. **Scheduling + analytics** - aggregation-heavy; a good use of
   SQLAlchemy Core `select()` with `func.count`/`func.sum`/window functions
   instead of Convex's `.collect()` + in-memory JS reduction.
4. **AI copilot** - swap the Convex `action` (which called OpenAI) for a
   FastAPI endpoint calling the same OpenAI API via the `openai` Python
   SDK; the prompts themselves don't need to change.
5. **Frontend integration** (§4) - can start in parallel with step 1 once
   the auth + a couple of CRUD endpoints exist, screen by screen.
6. **Cutover**: run `scripts/import_convex_export.py` against a fresh
   production export, validate row counts/spot-check records, switch the
   frontend's `VITE_API_BASE_URL` to the new backend, decommission Convex.

## 8. Data migration

Already implemented and tested end-to-end (§2) - see
`backend/scripts/import_convex_export.py`'s module docstring for the full
design (id remapping, dependency-ordered insertion, and how the one real
reference cycle in the schema - `users` ↔ `departments`/`laboratories`/
`companies` - is resolved via a deferred-FK fixup pass). Re-running it
against a fresh production export before cutover is all that's needed;
no per-table code changes are required as new tables get ported since the
importer is driven by `app/models/__init__.py` + naming convention.
