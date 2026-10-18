"""
conftest.py — shared pytest fixtures for Drifter backend tests.

Provides:
  - env_development: ensure ENV=development so config validation passes
  - tmp_db_url: a temporary SQLite database URL for each test
  - app_client: a FastAPI TestClient wired to a fresh, isolated database
"""

import os
import tempfile
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# ---------------------------------------------------------------------------
# Ensure the test environment uses development settings so that placeholder
# SESSION_SECRET does not trigger a production validation error.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def env_development(monkeypatch):
    """Force ENV=development and a known-safe SESSION_SECRET for all tests."""
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("SESSION_SECRET", "test-session-secret-not-for-production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./year_in_drift.db")


# ---------------------------------------------------------------------------
# Temporary SQLite database — isolated per test
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_db_path(tmp_path):
    """Return a path to a temporary SQLite database file."""
    return str(tmp_path / "test_drifter.db")


@pytest.fixture()
def tmp_db_url(tmp_db_path):
    """Return a sqlite:// URL for the temporary test database."""
    return f"sqlite:///{tmp_db_path}"


@pytest.fixture()
def tmp_engine(tmp_db_url):
    """Create a fresh SQLite engine for the test database."""
    engine = create_engine(
        tmp_db_url,
        connect_args={"check_same_thread": False},
    )
    yield engine
    engine.dispose()


@pytest.fixture()
def tmp_session_factory(tmp_engine):
    """SessionLocal bound to the temporary test engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=tmp_engine)


# ---------------------------------------------------------------------------
# FastAPI TestClient using an isolated in-memory database
# ---------------------------------------------------------------------------

@pytest.fixture()
def app_client(monkeypatch, tmp_db_url):
    """
    Return a FastAPI TestClient pointed at a fresh temporary database.

    The DATABASE_URL env var is patched before app.main is imported so that
    the engine and session are bound to the test database, not the developer's
    real database.
    """
    import importlib
    import sys

    # Patch the URL before importing the app modules
    monkeypatch.setenv("DATABASE_URL", tmp_db_url)

    # Remove any previously cached modules so a fresh import picks up the
    # patched environment.
    for mod in list(sys.modules.keys()):
        if mod.startswith("app."):
            del sys.modules[mod]

    from app.database.database import Base, engine as test_engine, SessionLocal
    import app.database.models  # noqa: F401
    Base.metadata.create_all(bind=test_engine)

    from app.main import app, _ensure_schema
    _ensure_schema()

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture()
def db_session(app_client):
    """Provide a database session bound to the isolated test database."""
    from app.database.database import SessionLocal
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
