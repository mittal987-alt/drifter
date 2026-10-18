"""Alembic environment configuration for Drifter.

DATABASE_URL is read from the environment so that migrations work
consistently regardless of whether you are running locally, in CI,
or inside Docker.  The static URL in alembic.ini is only a fallback.

Usage
─────
# Apply all pending migrations
alembic upgrade head

# Baseline an existing database that already has the correct schema
alembic stamp head

# Generate a new migration after changing models
alembic revision --autogenerate -m "describe the change"

# Roll back the last migration
alembic downgrade -1
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Make sure the app package is importable when running alembic from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database.database import Base  # noqa: E402
import app.database.models  # noqa: E402, F401 — registers all ORM models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    """
    Prefer DATABASE_URL from the environment over the static value in
    alembic.ini.  Normalise asyncpg → psycopg2 so the same variable can
    be used in docker-compose for both the app and migrations.
    """
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url", "")
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection required)."""
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Required for SQLite ALTER TABLE support
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _get_url()

    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
