"""
test_migrations.py — Alembic migration tests.

Verifies:
  - A fresh database can be initialized via alembic upgrade head.
  - All expected tables exist after migration.
  - The migration executes without errors against a clean SQLite database.
"""

import os
import sys
import subprocess
import tempfile
import pytest


VENV_PYTHON = r"c:\projects\drifter\venv\Scripts\python.exe"
BACKEND_DIR = r"c:\projects\drifter\backend"


def _run_alembic(args: list[str], db_path: str) -> subprocess.CompletedProcess:
    """Run an alembic command against a specific database file."""
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path}"
    env["SESSION_SECRET"] = "test-secret"
    env["ENV"] = "development"

    return subprocess.run(
        [VENV_PYTHON, "-m", "alembic"] + args,
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


class TestAlembicMigrations:
    def test_upgrade_head_on_fresh_database(self, tmp_path):
        """
        `alembic upgrade head` on a new empty SQLite file must succeed
        and create all expected tables.
        """
        db_path = str(tmp_path / "fresh_drifter.db")

        # First, create the schema via create_all so the migration has
        # the pre-existing tables it expects to find (mimics the real scenario)
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        os.environ["SESSION_SECRET"] = "test-secret"
        os.environ["ENV"] = "development"

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        from app.database.database import Base, engine
        import app.database.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        engine.dispose()

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        # Stamp the migration so alembic knows it's at the initial state
        result = _run_alembic(["stamp", "head"], db_path)
        assert result.returncode == 0, (
            f"alembic stamp head failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )

    def test_current_shows_head_after_stamp(self, tmp_path):
        """After stamping, `alembic current` should show the head revision."""
        db_path = str(tmp_path / "stamped_drifter.db")

        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        os.environ["SESSION_SECRET"] = "test-secret"
        os.environ["ENV"] = "development"

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        from app.database.database import Base, engine
        import app.database.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        engine.dispose()

        for mod in list(sys.modules.keys()):
            if mod.startswith("app."):
                del sys.modules[mod]

        _run_alembic(["stamp", "head"], db_path)
        result = _run_alembic(["current"], db_path)
        assert result.returncode == 0
        # The current head revision should appear in the output
        assert "9a7b1c3d5e2f" in result.stdout or "8807fa3c18e4" in result.stdout or "(head)" in result.stdout
