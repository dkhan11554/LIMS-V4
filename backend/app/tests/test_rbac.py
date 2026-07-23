"""Verifies require_role() mirrors convex/lib/roles.ts::requireRole semantics."""


def _register(client, email, role, password="password123"):
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": email, "role": role},
    )
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    return resp.json()["access_token"]


def test_non_admin_cannot_create_company(client, admin_token):
    # First user is auto-promoted to system_admin; register a second, regular user.
    analyst_token = _register(client, "analyst@example.com", role="analyst")
    resp = client.post(
        "/api/v1/companies",
        json={"name": "Acme Labs"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert resp.status_code == 403


def test_admin_can_create_company(client, auth_headers):
    resp = client.post("/api/v1/companies", json={"name": "Acme Labs"}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Acme Labs"
