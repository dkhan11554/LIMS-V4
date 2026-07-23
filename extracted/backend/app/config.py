from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Values are read from environment variables or .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NextGen LIMS API"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://lims:lims@postgres:5432/lims"
    cors_origins: list[AnyHttpUrl] = Field(default_factory=list)

    entra_tenant_id: str | None = None
    entra_client_id: str | None = None
    entra_audience: str | None = None
    entra_issuer: str | None = None

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment == "production":
            if not self.entra_tenant_id or not self.entra_client_id:
                raise ValueError("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required in production")
            if not self.cors_origins:
                raise ValueError("CORS_ORIGINS is required in production")
        return self

    @property
    def resolved_entra_issuer(self) -> str | None:
        return self.entra_issuer or (
            f"https://login.microsoftonline.com/{self.entra_tenant_id}/v2.0"
            if self.entra_tenant_id
            else None
        )

    @property
    def entra_jwks_url(self) -> str | None:
        return (
            f"https://login.microsoftonline.com/{self.entra_tenant_id}/discovery/v2.0/keys"
            if self.entra_tenant_id
            else None
        )

    @property
    def resolved_entra_audience(self) -> str | None:
        return self.entra_audience or self.entra_client_id


@lru_cache
def get_settings() -> Settings:
    return Settings()
