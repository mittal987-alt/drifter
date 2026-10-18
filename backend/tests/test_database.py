"""
test_database.py — Database configuration and engine tests.

Verifies:
  - SQLite engine creates correctly with check_same_thread=False.
  - asyncpg URL is transparently rewritten to psycopg2.
  - Engine connects and executes a basic query.
  - Fresh schema creation via create_all succeeds.
  - All expected tables are created.
"""

import os
import sys
import pytest
from sqlalchemy import create_engine, inspect, text


def _build_engine_from_url(url: str):
    """Helper — mirrors the logic in database.py."""
    connect_args = {}
    engine_kwargs: dict = {}

    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        engine_kwargs["connect_args"] = connect_args

    return create_engine(url, **engine_kwargs)


class TestEngineConfiguration:
    def test_sqlite_engine_creates(self, tmp_db_url):
        engine = _build_engine_from_url(tmp_db_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
        engine.dispose()

    def test_asyncpg_url_is_rewritten(self):
        """asyncpg:// in DATABASE_URL must be silently normalised."""
        asyncpg_url = "postgresql+asyncpg://user:pass@localhost/db"
        engine = _build_engine_from_url(asyncpg_url)
        # The engine should use psycopg2 dialect internally
        assert "psycopg2" in str(engine.dialect.__class__.__module__)
        engine.dispose()

    def test_bare_postgresql_url_is_rewritten(self):
        plain_url = "postgresql://user:pass@localhost/db"
        engine = _build_engine_from_url(plain_url)
        assert "psycopg2" in str(engine.dialect.__class__.__module__)
        engine.dispose()


class TestSchemaCreation:
    def test_create_all_creates_expected_tables(self, tmp_db_url):
        """All ORM model tables must be created from scratch."""
        # Reload modules with the test database URL
        os.environ["DATABASE_URL"] = tmp_db_url
        os.environ["SESSION_SECRET"] = "test-secret"
        os.environ["ENV"] = "development"

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        from app.database.database import Base, engine
        import app.database.models  # noqa: F401

        Base.metadata.create_all(bind=engine)

        with engine.connect() as conn:
            insp = inspect(conn)
            tables = insp.get_table_names()

        expected = {
            "users",
            "connections",
            "history_events",
            "analysis_results",
            "portability_export_jobs",
        }
        assert expected.issubset(set(tables)), (
            f"Missing tables: {expected - set(tables)}"
        )

    def test_analysis_results_not_deleted_by_schema_init(self, tmp_db_url):
        """
        _ensure_schema() must not delete rows from analysis_results.
        This test guards against the destructive DELETE that existed
        in the original main.py startup.
        """
        os.environ["DATABASE_URL"] = tmp_db_url
        os.environ["SESSION_SECRET"] = "test-secret"
        os.environ["ENV"] = "development"

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        from app.database.database import Base, engine, SessionLocal
        import app.database.models  # noqa: F401
        from app.database.models import AnalysisResult, User

        Base.metadata.create_all(bind=engine)

        # Insert a user and sentinel analysis result
        session = SessionLocal()
        try:
            user = User(id=1, email="sentinel@example.com")
            session.add(user)
            sentinel = AnalysisResult(
                user_id=1,
                source="test",
                event_count=1,
                status="READY",
                analysis_json='{"test": true}',
            )
            session.add(sentinel)
            session.commit()
            row_id = sentinel.id
        finally:
            session.close()

        # Run _ensure_schema — it must not touch analysis_results data
        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        from app.main import _ensure_schema
        _ensure_schema()

        # Verify the sentinel still exists
        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        os.environ["DATABASE_URL"] = tmp_db_url
        from app.database.database import engine as e2, SessionLocal as SL2
        from app.database.models import AnalysisResult as AR2

        session2 = SL2()
        try:
            row = session2.query(AR2).filter(AR2.id == row_id).first()
            assert row is not None, (
                "analysis_results row was deleted during startup — "
                "this is the destructive DELETE bug."
            )
            assert row.analysis_json == '{"test": true}'
        finally:
            session2.close()
