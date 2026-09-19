from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings

# API Routers
from app.api.auth import router as auth_router
from app.api.spotify import router as spotify_router
from app.api.youtube import router as youtube_router
from app.api.history import router as history_router
from app.api.analytics import router as analytics_router
from app.api.google_history import router as google_history_router

# Database
from sqlalchemy import inspect, text
from app.database.database import Base, engine

# Import models so SQLAlchemy knows about them
import app.database.models  # noqa: F401


# ============================================================
# DATABASE & MIGRATIONS
# ============================================================

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()

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

        if "analysis_results" in tables:
            columns = [c["name"] for c in inspector.get_columns("analysis_results")]
            for col_name, col_type in [
                ("status", "VARCHAR(32) DEFAULT 'READY'"),
                ("error", "TEXT"),
            ]:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE analysis_results ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
            conn.execute(text("UPDATE analysis_results SET status = 'READY' WHERE status IS NULL"))
            conn.commit()

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


init_db()


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
)


# ============================================================
# SESSION MIDDLEWARE
# ============================================================

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=False,
)


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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
    return {
        "status": "healthy",
    }


# ============================================================
# SIGNOUT / LOGOUT CONVENIENCE REDIRECT
# ============================================================

@app.get("/signout")
@app.get("/logout")
def direct_signout(request: Request):
    request.session.clear()
    return RedirectResponse(f"{settings.FRONTEND_URL}/")
