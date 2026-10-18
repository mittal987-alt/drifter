"""
Application settings loaded from environment variables.

For local development, place a .env file in the backend/ directory (or in
the repository root).  Never commit real secrets to version control.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv(override=False)


# ---------------------------------------------------------------------------
# Known placeholder values that are never valid in production
# ---------------------------------------------------------------------------
_PLACEHOLDER_SECRETS = {
    "change-me",
    "drifter-local-secret-change-me",
    "drifter-local-secret-2026-change-me",
    "your-secret-here",
    "secret",
    "",
}


class Settings:
    ENV: str = os.getenv("ENV", "development").lower()

    # OAuth — Google / YouTube
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str | None = os.getenv("GOOGLE_CLIENT_SECRET")

    GOOGLE_YOUTUBE_PORTABILITY_SCOPE: str = (
        "https://www.googleapis.com/auth/"
        "dataportability.myactivity.youtube"
    )

    # OAuth — Spotify
    SPOTIFY_CLIENT_ID: str | None = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET: str | None = os.getenv("SPOTIFY_CLIENT_SECRET")

    # OAuth — GitHub
    GITHUB_CLIENT_ID: str | None = os.getenv("GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: str | None = os.getenv("GITHUB_CLIENT_SECRET")

    # OAuth — Reddit
    REDDIT_CLIENT_ID: str | None = os.getenv("REDDIT_CLIENT_ID")
    REDDIT_CLIENT_SECRET: str | None = os.getenv("REDDIT_CLIENT_SECRET")

    # URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

    # Redirect URIs derived from BACKEND_URL when not explicitly set
    SPOTIFY_REDIRECT_URI: str = os.getenv(
        "SPOTIFY_REDIRECT_URI",
        f"{os.getenv('BACKEND_URL', 'http://127.0.0.1:8000')}/api/auth/spotify/callback",
    )
    GITHUB_REDIRECT_URI: str = os.getenv(
        "GITHUB_REDIRECT_URI",
        f"{os.getenv('BACKEND_URL', 'http://127.0.0.1:8000')}/api/github/callback",
    )
    REDDIT_REDIRECT_URI: str = os.getenv(
        "REDDIT_REDIRECT_URI",
        f"{os.getenv('BACKEND_URL', 'http://127.0.0.1:8000')}/api/reddit/callback",
    )

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./year_in_drift.db",
    )

    # Redis (optional — used only if a Redis-backed component is active)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Session secret
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "change-me")

    # Provider token encryption at rest key (AES-128-CBC / Fernet compatible)
    TOKEN_ENCRYPTION_KEY: str | None = os.getenv("TOKEN_ENCRYPTION_KEY")

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self) -> None:
        """
        Raise a descriptive RuntimeError for invalid production configuration.

        Called at application startup.  Intentionally does NOT print secret
        values in error messages.
        """
        errors: list[str] = []

        if self.ENV == "production":
            if self.SESSION_SECRET in _PLACEHOLDER_SECRETS:
                errors.append(
                    "SESSION_SECRET is set to a known placeholder value. "
                    "Set a strong random secret in your production environment "
                    "(e.g. `openssl rand -hex 32`)."
                )

            if self.TOKEN_ENCRYPTION_KEY and self.TOKEN_ENCRYPTION_KEY in _PLACEHOLDER_SECRETS:
                errors.append(
                    "TOKEN_ENCRYPTION_KEY is set to a known placeholder value. "
                    "Set a dedicated 32-byte urlsafe key or leave unset to derive from SESSION_SECRET."
                )

            if not self.DATABASE_URL or self.DATABASE_URL.startswith("sqlite"):
                errors.append(
                    "DATABASE_URL must be a PostgreSQL connection string in production "
                    "(e.g. postgresql+psycopg://user:pass@host/db)."
                )

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required but not set.")

        if errors:
            msg = "\n".join(f"  • {e}" for e in errors)
            print(
                f"\n[CONFIG ERROR] Invalid configuration for ENV={self.ENV!r}:\n{msg}\n",
                file=sys.stderr,
            )
            raise RuntimeError(
                f"Configuration error: {'; '.join(errors)}"
            )


settings = Settings()
settings.validate()