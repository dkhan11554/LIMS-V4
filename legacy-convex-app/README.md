# Legacy Convex backend (reference only - not run anymore)

This directory is the previous Convex backend, kept **only as a reference**
while porting its business logic to the new Python backend in `../backend/`.
It is not deployed or executed as part of this repository anymore.

- `convex/` - the original Convex schema (`schema.ts`) and 24 TypeScript
  modules implementing the LIMS/QMS/ERP business logic. Consult this when
  porting a module - see `../MIGRATION.md` for the full module-by-module
  mapping and status.
- `data-export/` - a JSONL snapshot export of the Convex database (one
  `<tableName>/documents.jsonl` file per table), used by
  `../backend/scripts/import_convex_export.py` to migrate demo/production
  data into the new schema.

Once the migration in `../MIGRATION.md` is complete and verified, this
entire directory can be deleted.
