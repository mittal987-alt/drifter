"""
test_health.py — Health endpoint tests.

Verifies:
  - /health returns 200 with expected JSON structure.
  - status is 'healthy' when DB is reachable.
  - No secrets are exposed in the health response.
  - / (root) returns 200.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient


def _make_client(tmp_db_url: str) -> TestClient:
    """Import app fresh with the given database URL."""
    os.environ["DATABASE_URL"] = tmp_db_url
    os.environ["SESSION_SECRET"] = "test-session-secret-not-for-production"
    os.environ["ENV"] = "development"

    for mod in list(sys.modules.keys()):
        if mod.startswith("app."):
            del sys.modules[mod]

    from app.database.database import Base, engine
    import app.database.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    from app.main import app
    return TestClient(app, raise_server_exceptions=True)


class TestRootEndpoint:
    def test_root_returns_200(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert "name" in data

    def test_root_does_not_expose_secrets(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        response = client.get("/")
        body = response.text
        # Ensure no session secret leaks
        assert "test-session-secret" not in body


class TestHealthEndpoint:
    def test_health_returns_200(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_json_structure(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        data = client.get("/health").json()

        assert "status" in data
        assert "database" in data
        assert "llm" in data
        assert "providers_configured" in data
        assert "cache_entries" in data

    def test_health_db_ok_with_sqlite(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        data = client.get("/health").json()

        assert data["status"] == "healthy"
        assert data["database"]["status"] == "ok"
        assert data["database"]["type"] == "sqlite"

    def test_health_does_not_expose_secrets(self, tmp_db_url):
        client = _make_client(tmp_db_url)
        response = client.get("/health")
        body = response.text

        # Must not leak session secret or any OAuth credentials
        assert "test-session-secret" not in body
        assert "REPLACE_WITH" not in body

    def test_providers_configured_when_env_empty(self, tmp_db_url, monkeypatch):
        """With no OAuth keys set, providers_configured must all be False."""
        import dotenv
        monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **kw: None)
        for key in [
            "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
            "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET",
            "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
            "REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET",
        ]:
            monkeypatch.delenv(key, raising=False)

        client = _make_client(tmp_db_url)
        data = client.get("/health").json()
        providers = data["providers_configured"]

        for name, value in providers.items():
            assert value is False, f"{name} should be False when env var is unset"
