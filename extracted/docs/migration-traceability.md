# Convex to FastAPI migration traceability

This file is the completion control for the migration. A module can be marked complete only
after its schema, data import, FastAPI routes, authorization, React replacement, automated
tests, manual evidence, and Convex-removal status have all been recorded.

| Module | Convex source | FastAPI target | Dependency | Status |
|---|---|---|---|---|
| Identity and RBAC | `convex/users.ts`, `convex/lib/roles.ts`, `convex/auth.config.ts` | `backend/app/security.py`, `api/auth.py` | Microsoft Entra ID | In progress |
| Organization | `convex/organization.ts` | `backend/app/api/organization.py` | Identity | In progress |
| Configuration | `convex/config.ts` | `api/config.py` | Identity | Pending |
| Catalogue | `convex/catalogue.ts` | `api/catalogue.py` | Organization | Pending |
| Customers | `convex/customers.ts` | `api/customers.py` | Organization | Pending |
| Suppliers | `convex/suppliers.ts` | `api/suppliers.py` | Organization | Pending |
| Sample workflow | `convex/samples.ts` | `api/samples.py` | Catalogue, customers, identity | Pending |
| Audit and notifications | Logic in `samples.ts`, `notifications.ts` | `services/audit.py`, `api/notifications.py` | Sample workflow | Pending |
| Calculations | `convex/calculations.ts` | `api/calculations.py` | Samples, catalogue | Pending |
| Validation | `convex/validation.ts` | `api/validation.py` | Calculations, samples | Pending |
| Certificate of analysis | `convex/coa.ts` | `api/coa.py` | Validated samples | Pending |
| Instruments | `convex/instruments.ts` | `api/instruments.py` | Organization | Pending |
| Instrument integration | `convex/instrumentIntegration.ts` | `api/instrument_integration.py` | Instruments, samples | Pending |
| Inventory | `convex/inventory.ts` | `api/inventory.py` | Organization | Pending |
| Physical storage | `convex/storage.ts` | `api/storage.py` | Samples | Pending |
| Scheduling | `convex/scheduling.ts` | `api/scheduling.py` | Samples, users, instruments | Pending |
| Quality management | `convex/quality.ts` | `api/quality.py` | Samples, users | Pending |
| Documents and files | `convex/documents.ts`, Convex `_storage` | `api/documents.py`, `services/storage.py` | Object storage | Pending |
| Training | `convex/training.ts` | `api/training.py` | Users | Pending |
| Audits | `convex/audits.ts` | `api/audits.py` | Quality | Pending |
| Billing | `convex/billing.ts` | `api/billing.py` | Customers, samples | Pending |
| Revenue | `convex/revenue.ts` | `api/revenue.py` | Organization | Pending |
| Analytics | `convex/analytics.ts` | `api/analytics.py` | Read models | Pending |
| Error logging | `convex/errorLogs.ts` | `api/error_logs.py` | Identity | Pending |
| AI | `convex/ai.ts`, `coa.ts` | `api/ai.py`, worker service | Read models | Pending |

## Per-module evidence

For every row above, retain:

1. A source-function inventory and endpoint mapping.
2. An Alembic migration and data-import reconciliation report.
3. Unit and API test results.
4. A manual acceptance script and signed result.
5. A React search proving that the module has no remaining `convex/react` or generated-API call.

## Final Convex-removal gate

Before release, confirm all deployed application files contain no Convex provider, client,
generated API, package, configuration, environment variable, deployment command, or storage URL.
Historical archives and this migration record may retain the word “Convex” only as evidence; they
must not be included in the deployed artifact.
