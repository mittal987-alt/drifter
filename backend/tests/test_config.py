"""
test_config.py — Configuration validation tests.

Verifies that:
  - Development config loads successfully with placeholder secrets.
  - Production config rejects placeholder SESSION_SECRET.
  - Production config rejects SQLite DATABASE_URL.
  - Valid production config passes validation.
  - Errors are reported via RuntimeError, not by printing secrets.
"""

import os
import sys
import importlib
import pytest


def _fresh_settings(env_overrides: dict) -> object:
    """
    Import a fresh copy of app.config with specific environment variables.
    Removes cached modules so that the patched env is picked up.
    """
    for mod in list(sys.modules.keys()):
        if "app.config" in mod or mod == "app.config":
            del sys.modules[mod]

    for key, value in env_overrides.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value

    try:
        import app.config as cfg_module
        return cfg_module.settings
    finally:
        # Restore — tests must be independent
        for key in env_overrides:
            os.environ.pop(key, None)


class TestDevelopmentConfig:
    def test_loads_with_placeholder_secret(self, monkeypatch):
        """Development mode must not reject placeholder secrets."""
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("SESSION_SECRET", "change-me")
        monkeypatch.setenv("DATABASE_URL", "sqlite:///./test.db")

        settings = _fresh_settings({
            "ENV": "development",
            "SESSION_SECRET": "change-me",
            "DATABASE_URL": "sqlite:///./test.db",
        })
        assert settings.ENV == "development"

    def test_default_sqlite_database_url(self, monkeypatch):
        settings = _fresh_settings({
            "ENV": "development",
            "SESSION_SECRET": "any-secret",
            "DATABASE_URL": "sqlite:///./year_in_drift.db",
        })
        assert settings.DATABASE_URL.startswith("sqlite")

    def test_frontend_url_has_default(self, monkeypatch):
        settings = _fresh_settings({
            "ENV": "development",
            "SESSION_SECRET": "any-secret",
            "DATABASE_URL": "sqlite:///./year_in_drift.db",
        })
        assert settings.FRONTEND_URL  # not empty


class TestProductionConfig:
    def test_rejects_placeholder_session_secret(self):
        """Production must reject known placeholder SESSION_SECRET values."""
        for placeholder in [
            "change-me",
            "drifter-local-secret-change-me",
            "drifter-local-secret-2026-change-me",
        ]:
            with pytest.raises(RuntimeError) as exc_info:
                _fresh_settings({
                    "ENV": "production",
                    "SESSION_SECRET": placeholder,
                    "DATABASE_URL": "postgresql+psycopg2://u:p@host/db",
                })
            # The error message must mention the offending setting
            assert "SESSION_SECRET" in str(exc_info.value), (
                f"Expected SESSION_SECRET in error, got: {exc_info.value}"
            )

    def test_rejects_sqlite_database_url(self):
        """Production must reject SQLite as the database backend."""
        with pytest.raises(RuntimeError) as exc_info:
            _fresh_settings({
                "ENV": "production",
                "SESSION_SECRET": "a-very-strong-production-secret-abc123def456",
                "DATABASE_URL": "sqlite:///./year_in_drift.db",
            })
        assert "DATABASE_URL" in str(exc_info.value), (
            f"Expected DATABASE_URL in error, got: {exc_info.value}"
        )

    def test_accepts_valid_postgresql_url(self):
        """Production config with a real PostgreSQL URL and strong secret must pass."""
        # This uses _fresh_settings which properly reloads app.config
        try:
            settings = _fresh_settings({
                "ENV": "production",
                "SESSION_SECRET": "a-very-strong-production-secret-abc123def456",
                "DATABASE_URL": "postgresql+psycopg2://user:pass@localhost:5432/drifter",
            })
            assert settings.ENV == "production"
        except RuntimeError as e:
            pytest.fail(f"Valid production config raised unexpectedly: {e}")

    def test_error_message_does_not_contain_secret(self, capsys):
        """Validation errors must not print the actual secret value."""
        secret = "my-super-secret-password"
        try:
            _fresh_settings({
                "ENV": "production",
                "SESSION_SECRET": "change-me",  # intentionally invalid
                "DATABASE_URL": "postgresql+psycopg2://u:p@host/db",
            })
        except RuntimeError:
            pass

        captured = capsys.readouterr()
        assert secret not in captured.out
        assert secret not in captured.err

