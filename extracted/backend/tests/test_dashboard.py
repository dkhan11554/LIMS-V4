import uuid
from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app
from app.models import LimsRole, User
from app.security import get_current_user


class DashboardSession:
    def __init__(self, results: list[list[object]]) -> None:
        self.results = iter(results)

    async def scalars(self, _: object) -> list[object]:
        return next(self.results)


def active_user() -> User:
    return User(
        id=uuid.uuid4(),
        entra_object_id="entra-user-id",
        email="user@example.com",
        name="Test User",
        role=LimsRole.ANALYST,
        is_active=True,
        is_disabled=False,
    )


def test_dashboard_returns_zero_values_when_no_samples_exist() -> None:
    laboratory_id = uuid.uuid4()

    async def current_user_override() -> User:
        return active_user()

    async def session_override() -> AsyncIterator[DashboardSession]:
        yield DashboardSession([[laboratory_id], []])

    app.dependency_overrides[get_current_user] = current_user_override
    app.dependency_overrides[get_session] = session_override
    try:
        response = TestClient(app).get("/api/v1/dashboard/statistics")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "inProgress": 0,
        "pendingReview": 0,
        "completed": 0,
        "overdue": 0,
        "statusCounts": {},
        "volumeByDay": [],
        "byPriority": {"routine": 0, "urgent": 0, "stat": 0},
        "avgTatDays": 0,
        "recentSamples": [],
    }


def test_dashboard_forbids_user_without_laboratory_access() -> None:
    async def current_user_override() -> User:
        return active_user()

    async def session_override() -> AsyncIterator[DashboardSession]:
        yield DashboardSession([[]])

    app.dependency_overrides[get_current_user] = current_user_override
    app.dependency_overrides[get_session] = session_override
    try:
        response = TestClient(app).get("/api/v1/dashboard/statistics")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json() == {"detail": "User is not assigned to a laboratory"}
