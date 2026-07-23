# Identity and organization module deployment

This is migration module 1. It provides the FastAPI platform, PostgreSQL schema, Microsoft
Entra ID access-token validation, role enforcement, and APIs for companies, laboratories, and
departments. The React frontend continues using Convex until its identity and organization calls
are migrated in a later module.

## Prerequisites

- Docker Engine with Docker Compose
- A Microsoft Entra app registration for the API
- An Entra access token issued for that API

In the Entra app registration:

1. Expose an API scope and note the API Application (client) ID.
2. Configure the SPA as an authorized client application.
3. Ensure access tokens have the API Application ID URI as `aud`.

## Configure

```bash
cd backend
cp .env.example .env
```

Set these exact values in `backend/.env`:

```dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://lims:replace-me@postgres:5432/lims
CORS_ORIGINS=["https://your-react-host.example"]
ENTRA_TENANT_ID=your-tenant-id
ENTRA_CLIENT_ID=your-api-application-client-id
ENTRA_AUDIENCE=api://your-api-application-client-id
```

At the application root, create `.env` with a long unique database password:

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-random-password
```

## Start

```bash
docker compose up --build -d
docker compose logs -f api
```

The container automatically applies the initial Alembic migration. Verify:

```bash
curl http://localhost:8000/healthz
```

Expected response:

```json
{"status":"ok"}
```

Open API documentation at `http://localhost:8000/api/v1/docs`.

## Bootstrap the first administrator

The first Entra login **does not** become an administrator. This prevents accidental privilege
escalation. Obtain the intended administrator's Entra Object ID (`oid` claim), then run:

```bash
docker compose exec api python scripts/bootstrap_admin.py \
  --object-id "<entra-object-id>" \
  --email "admin@example.com" \
  --name "Initial Administrator"
```

Use an Entra-issued API access token to call:

```bash
curl -H "Authorization: Bearer <access-token>" \
  http://localhost:8000/api/v1/auth/me
```

## Module acceptance checks

1. `/healthz` returns `200`.
2. A token for an unconfigured Entra identity receives `403`.
3. The bootstrapped administrator can call `/api/v1/auth/me`.
4. The administrator can create and list a company, laboratory, and department through Swagger.
5. A non-manager user receives `403` for organization write operations.

Do not expose PostgreSQL on the public internet. Use TLS at the reverse proxy/load balancer,
manage `.env` values with your deployment secret manager, and back up PostgreSQL before importing
production data.
