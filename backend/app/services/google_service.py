from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings


# =========================================================
# GOOGLE AUTH
# =========================================================

GOOGLE_AUTH_URL = (
    "https://accounts.google.com/o/oauth2/v2/auth"
)

GOOGLE_TOKEN_URL = (
    "https://oauth2.googleapis.com/token"
)


# =========================================================
# YOUTUBE API
# =========================================================

YOUTUBE_API_URL = (
    "https://www.googleapis.com/youtube/v3"
)


# =========================================================
# GOOGLE DATA PORTABILITY API
# =========================================================

DATA_PORTABILITY_API_URL = (
    "https://dataportability.googleapis.com/v1"
)

GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE = (
    "https://www.googleapis.com/auth/"
    "dataportability.myactivity.youtube"
)


# =========================================================
# YOUTUBE SCOPES
# =========================================================

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    GOOGLE_DATA_PORTABILITY_YOUTUBE_SCOPE,
]


# =========================================================
# GOOGLE LOGIN URL
# =========================================================

def get_google_login_url(
    state: str,
) -> str:

    redirect_uri = (
        f"{settings.BACKEND_URL}"
        "/api/auth/google/data-portability/callback"
    )

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    return (
        f"{GOOGLE_AUTH_URL}"
        f"?{urlencode(params)}"
    )


# =========================================================
# EXCHANGE GOOGLE AUTH CODE
# =========================================================

async def exchange_google_code(
    code: str,
):

    redirect_uri = (
        f"{settings.BACKEND_URL}"
        "/api/auth/google/data-portability/callback"
    )

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient(
        timeout=60.0,
    ) as client:

        response = await client.post(
            GOOGLE_TOKEN_URL,
            data=data,
        )

    response.raise_for_status()

    return response.json()


# =========================================================
# REFRESH GOOGLE TOKEN
# =========================================================

async def refresh_google_token(
    refresh_token: str,
):

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient(
        timeout=60.0,
    ) as client:

        response = await client.post(
            GOOGLE_TOKEN_URL,
            data=data,
        )

    response.raise_for_status()

    return response.json()


# =========================================================
# YOUTUBE API REQUEST
# =========================================================

async def youtube_api_request(
    access_token: str,
    endpoint: str,
    params: dict | None = None,
):

    headers = {
        "Authorization": (
            f"Bearer {access_token}"
        ),
    }

    url = (
        f"{YOUTUBE_API_URL}"
        f"{endpoint}"
    )

    async with httpx.AsyncClient(
        timeout=60.0,
    ) as client:

        response = await client.get(
            url,
            headers=headers,
            params=params,
        )

    response.raise_for_status()

    return response.json()


# =========================================================
# INITIATE YOUTUBE DATA PORTABILITY EXPORT
# =========================================================

async def initiate_youtube_history_export(
    access_token: str,
) -> dict[str, Any]:

    url = (
        f"{DATA_PORTABILITY_API_URL}"
        "/portabilityArchive:initiate"
    )

    headers = {
        "Authorization": (
            f"Bearer {access_token}"
        ),
        "Content-Type": "application/json",
    }

    payload = {
        "resources": [
            "myactivity.youtube",
        ],
    }

    async with httpx.AsyncClient(
        timeout=60.0,
    ) as client:

        response = await client.post(
            url,
            headers=headers,
            json=payload,
        )

    response.raise_for_status()

    return response.json()


# =========================================================
# GET YOUTUBE EXPORT STATE
# =========================================================

async def get_youtube_history_export_state(
    access_token: str,
    archive_job_id: str,
) -> dict[str, Any]:

    url = (
        f"{DATA_PORTABILITY_API_URL}"
        f"/archiveJobs/{archive_job_id}"
        "/portabilityArchiveState"
    )

    headers = {
        "Authorization": (
            f"Bearer {access_token}"
        ),
    }

    async with httpx.AsyncClient(
        timeout=60.0,
    ) as client:

        response = await client.get(
            url,
            headers=headers,
        )

    response.raise_for_status()

    return response.json()


# =========================================================
# DOWNLOAD DATA PORTABILITY ARCHIVE
# =========================================================

async def download_portability_archive(
    signed_url: str,
) -> bytes:

    async with httpx.AsyncClient(
        timeout=300.0,
        follow_redirects=True,
    ) as client:

        response = await client.get(
            signed_url,
        )

    response.raise_for_status()

    return response.content