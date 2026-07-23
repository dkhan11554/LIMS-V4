# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A single product: a **LIMS** (Laboratory Information Management System) built on the
**Hercules** app platform. Stack: **React 19 + Vite** frontend, **Convex** serverless
backend/database, **pnpm** package manager, TypeScript. Auth is **Hercules OIDC**.

### Repo layout gotcha (important)
Historically this repo shipped the app as two archives at the root:
`Code version Latest 4.gz` (the source tree) and `Data Base Version Latest 4.zip`
(a Convex snapshot export used to seed data). The project source now lives extracted at
the repo root (`package.json`, `convex/`, `src/`, …). The startup/update script extracts
the `.gz` only if `package.json` is missing, so it is safe whether or not the extraction
is committed. The `Data Base Version Latest 4.zip` is kept as seed data.

### Running the services (two long-running processes)
Run each in its own persistent (tmux) shell; dependencies are already installed by the
update script.

1. **Convex backend (local, anonymous)** — required. This project has no Convex cloud
   account, so run the open-source backend locally in anonymous mode:
   ```
   CONVEX_AGENT_MODE=anonymous npx convex dev --tail-logs disable
   ```
   - First run downloads the local backend binary and serves at `http://127.0.0.1:3210`.
   - It auto-writes `.env.local` with `VITE_CONVEX_URL=http://127.0.0.1:3210` (and
     `CONVEX_DEPLOYMENT=anonymous:anonymous-agent`), which the frontend reads.
   - `auth.config.ts` requires two deployment env vars or the function push fails:
     ```
     CONVEX_AGENT_MODE=anonymous npx convex env set HERCULES_OIDC_AUTHORITY "https://placeholder.hercules.app"
     CONVEX_AGENT_MODE=anonymous npx convex env set HERCULES_OIDC_CLIENT_ID "placeholder-client-id"
     ```
     Placeholders are fine to boot/push functions; real values are only needed for actual
     OIDC login.

2. **Vite frontend** — required. `pnpm dev` (serves `http://localhost:5173`, host 0.0.0.0).
   For the SPA to boot, `.env.local` also needs placeholder OIDC vars (the code non-null
   asserts them):
   ```
   VITE_HERCULES_OIDC_AUTHORITY=https://placeholder.hercules.app
   VITE_HERCULES_OIDC_CLIENT_ID=placeholder-client-id
   ```

### Seeding data
With the Convex backend running:
```
CONVEX_AGENT_MODE=anonymous npx convex import --replace-all -y "Data Base Version Latest 4.zip"
```
(The backend must be up; import against a stopped `--once` backend fails.)

### Auth is an external dependency (key limitation)
The entire authenticated UI (dashboard, sample/customer/CoA workflows, etc.) is gated
behind **Hercules OIDC**. Without real `VITE_HERCULES_OIDC_*` (frontend) and
`HERCULES_OIDC_*` (Convex) values, only the unauthenticated landing page renders and
real login cannot complete. Nearly every Convex mutation calls `getCurrentUserOrThrow`
/ `require*` role helpers, so writes need an authenticated user.

To exercise backend logic **without** the real OIDC provider, use `convex-test` with
`t.withIdentity(...)` (seed a `users` row whose `tokenIdentifier` matches the identity),
then call the real mutations/queries. `HERCULES_API_KEY` (Convex env) is optional and
only powers the AI copilot/insights pages.

### Lint / test / build / run
Standard scripts in `package.json`: `pnpm lint`, `pnpm test` (Vitest; `convex` +
`frontend` projects, currently no test files so it passes trivially), `pnpm build`
(`tsc -b && vite build`), `pnpm dev`. Tests are meant to be hermetic (see
`vitest.config.ts`).
