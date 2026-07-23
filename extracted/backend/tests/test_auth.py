import uuid
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.models import LimsRole, User
from app.security import get_current_user, validate_entra_access_token


def test_sync_requires_bearer_token() -> None:
    client = TestClient(app)

    response = client.post("/api/v1/auth/sync")

    assert response.status_code == 401
    assert response.json() == {"detail": "Bearer authentication is required"}


def test_sync_returns_local_user_profile() -> None:
    user = User(
        id=uuid.uuid4(),
        entra_object_id="entra-user-id",
        email="user@example.com",
        name="Test User",
        role=LimsRole.ANALYST,
        is_active=True,
        is_disabled=False,
    )

    async def current_user_override() -> User:
        return user

    app.dependency_overrides[get_current_user] = current_user_override
    try:
        response = TestClient(app).post("/api/v1/auth/sync")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": "user@example.com",
        "display_name": "Test User",
        "roles": ["analyst"],
        "permissions": [],
    }


def test_invalid_entra_token_returns_unauthorized() -> None:
    settings = Settings(
        entra_tenant_id="expected-tenant",
        entra_client_id="api-client-id",
        entra_audience="api://api-client-id",
    )

    with (
        patch("app.security._get_jwks_client") as jwks_client,
        patch("app.security.jwt.decode", side_effect=jwt.InvalidTokenError),
    ):
        jwks_client.return_value.get_signing_key_from_jwt.return_value.key = "public-key"
        with pytest.raises(HTTPException, match="Invalid or expired access token") as error:
            validate_entra_access_token("invalid-token", settings)

    assert error.value.status_code == 401


def test_wrong_entra_tenant_returns_unauthorized() -> None:
    settings = Settings(
        entra_tenant_id="expected-tenant",
        entra_client_id="api-client-id",
        entra_audience="api://api-client-id",
    )
    claims = {"tid": "unexpected-tenant", "sub": "subject"}

    with (
        patch("app.security._get_jwks_client") as jwks_client,
        patch("app.security.jwt.decode", return_value=claims),
    ):
        jwks_client.return_value.get_signing_key_from_jwt.return_value.key = "public-key"
        with pytest.raises(HTTPException, match="unexpected tenant") as error:
            validate_entra_access_token("valid-token", settings)

    assert error.value.status_code == 401
