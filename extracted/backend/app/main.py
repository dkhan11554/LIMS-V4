from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, organization
from app.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Database schema changes are applied by Alembic, never automatically at runtime.
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.cors_origins],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(organization.router, prefix=settings.api_v1_prefix)


@app.get("/healthz", tags=["operations"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
