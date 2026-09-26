import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.config import Settings
from app.main import create_app

TOKEN = "t" * 40


@pytest.fixture
def client() -> TestClient:
    settings = Settings(cv_service_token=SecretStr(TOKEN), _env_file=None)
    return TestClient(create_app(settings))


def test_health_reports_library_versions(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "cv-service"
    assert body["opencv_version"]


def test_internal_route_rejects_missing_token(client: TestClient) -> None:
    assert client.get("/internal/v1/info").status_code == 401


def test_internal_route_rejects_wrong_token(client: TestClient) -> None:
    response = client.get("/internal/v1/info", headers={"X-Service-Token": "x" * 40})
    assert response.status_code == 401


def test_internal_route_accepts_valid_token(client: TestClient) -> None:
    response = client.get("/internal/v1/info", headers={"X-Service-Token": TOKEN})
    assert response.status_code == 200
    assert response.json() == {"service": "cv-service", "version": "0.1.0", "models": []}


def test_settings_reject_short_token() -> None:
    with pytest.raises(ValidationError):
        Settings(cv_service_token=SecretStr("short"), _env_file=None)


def test_settings_reject_placeholder_token() -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        Settings(
            cv_service_token=SecretStr("replace_with_long_random_token_0000000000"),
            _env_file=None,
        )
