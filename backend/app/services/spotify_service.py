import base64
from urllib.parse import urlencode

import httpx

from app.config import settings


SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_URL = "https://api.spotify.com/v1"


SPOTIFY_SCOPES = [
    "user-read-recently-played",
    "user-top-read",
    "user-read-private",
    "user-read-email",
]


def get_spotify_login_url(state: str) -> str:
    redirect_uri = settings.SPOTIFY_REDIRECT_URI

    params = {
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": " ".join(SPOTIFY_SCOPES),
        "state": state,
    }

    return f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"


async def exchange_spotify_code(code: str):

    credentials = (
        f"{settings.SPOTIFY_CLIENT_ID}:"
        f"{settings.SPOTIFY_CLIENT_SECRET}"
    )

    encoded_credentials = base64.b64encode(
        credentials.encode()
    ).decode()

    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    redirect_uri = settings.SPOTIFY_REDIRECT_URI

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient() as client:

        response = await client.post(
            SPOTIFY_TOKEN_URL,
            headers=headers,
            data=data,
        )

    response.raise_for_status()

    return response.json()


async def refresh_spotify_token(refresh_token: str):

    credentials = (
        f"{settings.SPOTIFY_CLIENT_ID}:"
        f"{settings.SPOTIFY_CLIENT_SECRET}"
    )

    encoded_credentials = base64.b64encode(
        credentials.encode()
    ).decode()

    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }

    async with httpx.AsyncClient() as client:

        response = await client.post(
            SPOTIFY_TOKEN_URL,
            headers=headers,
            data=data,
        )

    response.raise_for_status()

    return response.json()


async def spotify_api_request(
    access_token: str,
    endpoint: str,
    params: dict | None = None,
):

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    url = f"{SPOTIFY_API_URL}{endpoint}"

    async with httpx.AsyncClient() as client:

        response = await client.get(
            url,
            headers=headers,
            params=params,
        )

    response.raise_for_status()

    return response.json()


async def sync_spotify_user_history(
    db,
    user_id: int,
    access_token: str,
) -> dict[str, int]:
    """
    Fetch user's recent and top tracks from Spotify API and save them to history_events.
    """
    import json
    from app.database.models import HistoryEvent
    from app.services.history_service import normalize_spotify_event, create_event_hash
    from app.services.analysis_cache_service import delete_cached_analysis

    raw_items = []

    # 1. Fetch recently played tracks
    try:
        recent_data = await spotify_api_request(
            access_token,
            "/me/player/recently-played",
            {"limit": 50},
        )
        if isinstance(recent_data, dict) and "items" in recent_data:
            raw_items.extend(recent_data["items"])
    except Exception as exc:
        print(f"[Spotify Sync] Error fetching recently-played: {exc}", flush=True)

    # 2. Fetch top tracks
    try:
        top_data = await spotify_api_request(
            access_token,
            "/me/top/tracks",
            {"limit": 50, "time_range": "short_term"},
        )
        if isinstance(top_data, dict) and "items" in top_data:
            raw_items.extend(top_data["items"])
    except Exception as exc:
        print(f"[Spotify Sync] Error fetching top tracks: {exc}", flush=True)

    from app.api.history import save_history_events

    events = []
    for item in raw_items:
        event = normalize_spotify_event(item)
        if event and event.get("title"):
            events.append(event)

    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=events,
        source="spotify",
    )

    print(f"[Spotify Sync] Completed for user {user_id}: {imported} imported, {duplicates} duplicates.", flush=True)
    return {"imported": imported, "duplicates": duplicates, "total": len(raw_items)}