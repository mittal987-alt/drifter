from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import logging
import sys

from app.config import settings

# Structured logging
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# API Routers
from app.api.auth import router as auth_router
from app.api.spotify import router as spotify_router
from app.api.youtube import router as youtube_router
from app.api.history import router as history_router
from app.api.analytics import router as analytics_router
from app.api.google_history import router as google_history_router
from app.api.history_extension_api import router as history_extension_router
from app.api.github_api import router as github_router
from app.api.reddit_api import router as reddit_router
from app.api.websocket import router as websocket_router

# Database
from sqlalchemy import inspect, text
from app.database.database import Base, engine

# Import models so SQLAlchemy knows about them
import app.database.models  # noqa: F401


# ============================================================
# DATABASE INITIALISATION  (safe — additive only, no deletes)
# ============================================================

def _ensure_schema() -> None:
    """
    Create missing tables and add any missing columns.

    This is a *development convenience only*.  In production, use Alembic
    migrations exclusively.  This function never drops tables or rows.
    """
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()

        # ── users ─────────────────────────────────────────────
        if "users" in tables:
            columns = [c["name"] for c in inspector.get_columns("users")]
            for col_name, col_type in [
                ("email", "VARCHAR(255)"),
                ("password_hash", "VARCHAR(255)"),
                ("name", "VARCHAR(255)"),
                ("is_active", "BOOLEAN DEFAULT 1"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()

        # ── connections ───────────────────────────────────────
        if "connections" in tables:
            columns = [c["name"] for c in inspector.get_columns("connections")]
            for col_name, col_type in [
                ("refresh_token", "TEXT"),
                ("expires_at", "DATETIME"),
                ("scope", "TEXT"),
                ("created_at", "DATETIME"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE connections ADD COLUMN {col_name} {col_type}"))
                    conn.commit()

        # ── history_events ────────────────────────────────────
        if "history_events" in tables:
            columns = [c["name"] for c in inspector.get_columns("history_events")]
            for col_name, col_type in [
                ("artist", "TEXT"),
                ("url", "TEXT"),
                ("event_hash", "VARCHAR(64)"),
                ("duration", "FLOAT"),
                ("metadata_json", "TEXT"),
                ("created_at", "DATETIME"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE history_events ADD COLUMN {col_name} {col_type}"))
                    conn.commit()

            # Normalise "Meet" topic labels (idempotent UPDATE, safe to re-run)
            columns = [c["name"] for c in inspector.get_columns("history_events")]
            if "topic" in columns:
                conn.execute(text(
                    "UPDATE history_events SET topic = 'Google Meet' "
                    "WHERE topic LIKE 'Meet%' OR topic LIKE '%Google Meet%' "
                    "OR title LIKE '%meet.google%' OR title LIKE 'Meet -%' OR title LIKE 'Meet –%'"
                ))
                conn.commit()

        # ── analysis_results ──────────────────────────────────
        if "analysis_results" in tables:
            columns = [c["name"] for c in inspector.get_columns("analysis_results")]
            for col_name, col_type in [
                ("status", "VARCHAR(32) DEFAULT 'READY'"),
                ("error", "TEXT"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE analysis_results ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
            # Patch NULL statuses — safe, does not erase analysis_json
            conn.execute(text("UPDATE analysis_results SET status = 'READY' WHERE status IS NULL"))
            conn.commit()
            # NOTE: We intentionally do NOT DELETE FROM analysis_results here.
            # Existing cached analysis results are user data and must not be
            # destroyed on startup.  Use DELETE /api/cache/clear if you want
            # to invalidate them manually.

        # ── portability_export_jobs ───────────────────────────
        if "portability_export_jobs" in tables:
            columns = [c["name"] for c in inspector.get_columns("portability_export_jobs")]
            for col_name, col_type in [
                ("error", "TEXT"),
                ("imported", "INTEGER DEFAULT 0"),
                ("duplicates", "INTEGER DEFAULT 0"),
                ("skipped", "INTEGER DEFAULT 0"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE portability_export_jobs ADD COLUMN {col_name} {col_type}"))
                    conn.commit()

        # ── extension_tokens ──────────────────────────────────
        if "extension_tokens" in tables:
            columns = [c["name"] for c in inspector.get_columns("extension_tokens")]
            for col_name, col_type in [
                ("token_prefix", "VARCHAR(16)"),
                ("client_name", "VARCHAR(100) DEFAULT 'Chrome Extension'"),
                ("permissions", "TEXT"),
                ("is_revoked", "BOOLEAN DEFAULT 0"),
                ("revoked_at", "DATETIME"),
                ("last_used_at", "DATETIME"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE extension_tokens ADD COLUMN {col_name} {col_type}"))
                    conn.commit()


# ============================================================
# LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup / shutdown managed via FastAPI lifespan.
    Startup: ensure schema is present, log configuration summary.
    Shutdown: nothing special needed for sync SQLAlchemy.
    """
    logger.info(
        "Drifter starting — ENV=%s  DB=%s",
        settings.ENV,
        "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql",
    )

    try:
        _ensure_schema()
        logger.info("Database schema verified.")
    except Exception as exc:
        logger.error("Database initialisation failed: %s", exc)
        raise SystemExit(1) from exc

    yield

    logger.info("Drifter shutting down.")


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Year in Drift",
    description=(
        "AI-powered personal interest evolution platform "
        "that analyzes YouTube and Spotify history."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


# ============================================================
# SESSION MIDDLEWARE
# ============================================================

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="drifter_session",
    max_age=7 * 24 * 3600,  # 7 days
    same_site="none" if settings.ENV == "production" else "lax",
    https_only=settings.ENV == "production",
)


# ============================================================
# CSRF PROTECTION FOR COOKIE-AUTHENTICATED REQUESTS
# ============================================================

@app.middleware("http")
async def csrf_protection_middleware(request: Request, call_next):
    """
    Validate Origin header on state-changing requests when authenticated via cookies.
    Bearer tokens and extension sync tokens are immune to browser cross-site CSRF.
    """
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        auth_hdr = request.headers.get("authorization") or request.headers.get("x-sync-token")
        is_token_auth = (
            auth_hdr is not None
            and (
                auth_hdr.lower().startswith("bearer ")
                or auth_hdr.startswith("drifter_ext_")
            )
        )
        if not is_token_auth:
            origin = request.headers.get("origin")
            if origin:
                allowed_origins = {
                    settings.FRONTEND_URL.rstrip("/"),
                    settings.BACKEND_URL.rstrip("/"),
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:5174",
                    "http://127.0.0.1:5174",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                }
                origin_clean = origin.rstrip("/")
                if origin_clean not in allowed_origins and not (
                    origin_clean.startswith("chrome-extension://")
                    or origin_clean.startswith("moz-extension://")
                ):
                    logger.warning("CSRF origin validation failed for origin: %s", origin)
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Forbidden: Cross-site request rejected (untrusted origin)."},
                    )
    return await call_next(request)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # Also allow Chrome/Firefox extension origins so the background
    # service worker can POST events without CORS preflight failures.
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|chrome-extension://[a-z]+|moz-extension://[\w-]+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTES
# ============================================================

# auth.py already uses /auth in its router.
app.include_router(auth_router, tags=["Authentication"])

app.include_router(
    spotify_router,
    prefix="/api/spotify",
    tags=["Spotify"],
)

app.include_router(
    youtube_router,
    prefix="/api/youtube",
    tags=["YouTube"],
)

app.include_router(
    history_router,
    prefix="/api/history",
    tags=["History"],
)

app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics"],
)

app.include_router(google_history_router)
app.include_router(history_extension_router)

app.include_router(
    github_router,
    prefix="/api/github",
    tags=["GitHub"],
)

app.include_router(
    reddit_router,
    prefix="/api/reddit",
    tags=["Reddit"],
)

# WebSocket
app.include_router(websocket_router, tags=["WebSocket"])


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():
    return {
        "name": "Year in Drift",
        "status": "running",
        "version": "0.1.0",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    import os
    from app.services.cache import cache

    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {str(exc)}"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": {
            "type": "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql",
            "status": db_status,
        },
        "llm": {
            "gemini": bool(os.getenv("GEMINI_API_KEY")),
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "ollama": os.getenv("OLLAMA_ENABLED", "").lower() in ("1", "true", "yes"),
        },
        "providers_configured": {
            "youtube": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "spotify": bool(settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET),
            "github": bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET),
            "reddit": bool(settings.REDDIT_CLIENT_ID and settings.REDDIT_CLIENT_SECRET),
        },
        "cache_entries": cache.size,
    }


# ============================================================
# CACHE MANAGEMENT (Authenticated & Scoped)
# ============================================================

from app.api.dependencies import get_current_user_id

@app.delete("/api/cache/clear")
def clear_cache(user_id: int = Depends(get_current_user_id)):
    """Invalidate cached analysis results for authenticated user."""
    from app.services.cache import cache
    from app.services.analysis_cache_service import delete_cached_analysis
    cache.delete_pattern(f"user:{user_id}")
    delete_cached_analysis(user_id=user_id, source=None)
    logger.info("Cache cleared for user=%d via API", user_id)
    return {"status": "cleared", "user_id": user_id}


# ============================================================
# SIGNOUT / LOGOUT CONVENIENCE REDIRECT
# ============================================================

@app.get("/signout")
@app.get("/logout")
def direct_signout(request: Request):
    request.session.clear()
    return RedirectResponse(f"{settings.FRONTEND_URL}/")
