from fastapi.testclient import TestClient

from app.main import app


def test_healthcheck_is_available_without_authentication() -> None:
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_documentation_uses_versioned_path() -> None:
    client = TestClient(app)

    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "NextGen LIMS API"
