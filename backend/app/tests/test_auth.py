def test_first_registered_user_becomes_system_admin(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "first@example.com", "password": "password123", "name": "First User"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "system_admin"


def test_login_returns_tokens(client, admin_token):
    assert admin_token


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@example.com"


def test_login_rejects_wrong_password(client, admin_token):
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
