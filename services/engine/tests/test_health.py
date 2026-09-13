import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    # Constructed without `with`, so the lifespan never runs and no pool is opened.
    # That is the state /health has to survive: the route must answer, not raise.
    return TestClient(app)


def test_health_reports_degraded_without_a_database(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "degraded",
        "version": "0.1.0",
        "database": "down",
    }


def test_openapi_schema_documents_health(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    assert "/health" in schema["paths"]
