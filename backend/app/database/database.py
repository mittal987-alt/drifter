"""
SQLAlchemy engine and session configuration.

Driver selection
────────────────
• SQLite  (default / local dev) — uses the bundled sqlite3 driver.
• PostgreSQL                    — uses psycopg2-binary (synchronous).

The DATABASE_URL must use the correct scheme:
  • sqlite:///./year_in_drift.db
  • postgresql+psycopg2://user:pass@host:5432/db

Do NOT use asyncpg or any async driver here; this application uses the
synchronous SQLAlchemy API throughout.  If you see
  postgresql+asyncpg://...
in an old docker-compose.yml or .env file, change the scheme to
  postgresql+psycopg2://...
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


# =========================================================
# DRIVER / URL NORMALISATION
# =========================================================

_url = settings.DATABASE_URL

# Guard against the asyncpg scheme being copy-pasted from docker-compose.
# Silently rewrite it to psycopg2 rather than crashing at engine creation.
if _url.startswith("postgresql+asyncpg://"):
    import logging as _log
    _log.getLogger(__name__).warning(
        "DATABASE_URL uses the asyncpg driver, which is incompatible with "
        "synchronous SQLAlchemy.  Rewriting to postgresql+psycopg2://. "
        "Update your DATABASE_URL to silence this warning."
    )
    _url = _url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
elif _url.startswith("postgresql://"):
    # Plain postgresql:// → explicit psycopg2 dialect
    _url = _url.replace("postgresql://", "postgresql+psycopg2://", 1)


# =========================================================
# ENGINE
# =========================================================

connect_args: dict = {}
engine_kwargs: dict = {}

if _url.startswith("sqlite"):
    # SQLite: allow multi-threaded access (FastAPI uses a thread pool)
    connect_args["check_same_thread"] = False
    # Enforce foreign keys for data integrity
    engine_kwargs["connect_args"] = connect_args
else:
    # PostgreSQL: sensible pool defaults
    engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,      # detect stale connections
        pool_recycle=1800,       # recycle connections every 30 min
        connect_timeout=10,      # fail fast on unreachable DB
        connect_args=connect_args,
    )

engine = create_engine(_url, **engine_kwargs)

# Enable SQLite WAL mode for better concurrent read performance
if _url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# =========================================================
# SESSION
# =========================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# =========================================================
# BASE MODEL
# =========================================================

Base = declarative_base()


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()