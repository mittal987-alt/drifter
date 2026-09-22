import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings:
    ENV = os.getenv("ENV", "development").lower()

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    GOOGLE_YOUTUBE_PORTABILITY_SCOPE = (
        "https://www.googleapis.com/auth/"
        "dataportability.myactivity.youtube"
    )

    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

    FRONTEND_URL = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    )

    BACKEND_URL = os.getenv(
        "BACKEND_URL",
        "http://127.0.0.1:8000",
    )

    SPOTIFY_REDIRECT_URI = os.getenv(
        "SPOTIFY_REDIRECT_URI",
        f"{BACKEND_URL}/api/auth/spotify/callback",
    )

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite:///./year_in_drift.db",
    )

    SESSION_SECRET = os.getenv(
        "SESSION_SECRET",
        "change-me",
    )


settings = Settings()