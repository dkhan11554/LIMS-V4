"""Central application configuration, loaded from environment variables / .env."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "NextGen AI-LIMS API"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # SQLAlchemy connection string, e.g.:
    #   postgresql+psycopg://lims:lims@localhost:5432/lims
    #   mssql+pyodbc://lims:lims@localhost:1433/lims?driver=ODBC+Driver+18+for+SQL+Server
    DATABASE_URL: str = "postgresql+psycopg://lims:lims@localhost:5432/lims"
    DATABASE_ECHO: bool = False

    # JWT auth (Phase 1). Swap for Active Directory / SSO in Phase 2 (see MIGRATION.md).
    JWT_SECRET_KEY: str = "CHANGE_ME_INSECURE_DEFAULT_DEV_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8h shift
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14  # 14 days

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # File storage (local disk by default, MinIO/S3-compatible optional later)
    STORAGE_BACKEND: str = "local"  # "local" | "minio"
    LOCAL_STORAGE_DIR: str = "./storage"
    MINIO_ENDPOINT: str | None = None
    MINIO_ACCESS_KEY: str | None = None
    MINIO_SECRET_KEY: str | None = None
    MINIO_BUCKET: str = "lims-documents"
    MINIO_SECURE: bool = True

    OPENAI_API_KEY: str | None = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
