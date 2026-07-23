from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, catalogue, customers, health, notifications, organization, samples, users, ws

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Python/FastAPI backend for the NextGen AI-LIMS platform - a "
        "from-scratch port of the previous Convex backend (see /MIGRATION.md "
        "in the repository root for the full module-by-module mapping)."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(organization.router, prefix=settings.API_V1_PREFIX)
app.include_router(customers.router, prefix=settings.API_V1_PREFIX)
app.include_router(catalogue.router, prefix=settings.API_V1_PREFIX)
app.include_router(samples.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws.router)  # WebSocket route, kept outside the REST prefix
