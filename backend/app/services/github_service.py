"""
GitHub ingestion service.

Fetches:
  - Starred repositories (title, language, description, topics)
  - Public user events (PushEvent, WatchEvent, ForkEvent, CreateEvent)

and normalizes them into Drifter history_events with source="github".
"""

from datetime import datetime
from typing import Any

import httpx


GITHUB_API = "https://api.github.com"
HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


# ------------------------------------------------------------------
# Low-level API helper
# ------------------------------------------------------------------

async def _github_get(path: str, token: str, params: dict | None = None) -> Any:
    headers = {**HEADERS_BASE, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{GITHUB_API}{path}", headers=headers, params=params or {})
        resp.raise_for_status()
        return resp.json()


# ------------------------------------------------------------------
# Starred repos
# ------------------------------------------------------------------

async def fetch_starred_repos(token: str, max_pages: int = 5) -> list[dict]:
    """Return up to max_pages * 100 starred repos."""
    events: list[dict] = []
    for page in range(1, max_pages + 1):
        data = await _github_get(
            "/user/starred",
            token,
            {"per_page": 100, "page": page},
        )
        if not data:
            break
        for repo in data:
            ts_str = repo.get("starred_at") or repo.get("updated_at") or repo.get("created_at")
            try:
                ts = datetime.fromisoformat((ts_str or "").replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                ts = datetime.utcnow()

            topics = repo.get("topics") or []
            lang = repo.get("language") or ""
            desc = repo.get("description") or ""
            full_name = repo.get("full_name") or repo.get("name") or ""

            subtitle_parts = [p for p in [lang, desc[:80] if desc else ""] if p]
            title = full_name
            if subtitle_parts:
                title = f"{full_name} ({', '.join(subtitle_parts[:1])})"

            events.append({
                "timestamp": ts,
                "source": "github",
                "title": title,
                "artist": lang or None,
                "url": repo.get("html_url"),
                "duration": None,
                "metadata": {
                    "full_name": full_name,
                    "language": lang,
                    "description": desc,
                    "topics": topics,
                    "stars": repo.get("stargazers_count"),
                },
            })
        if len(data) < 100:
            break
    return events


# ------------------------------------------------------------------
# Public user events
# ------------------------------------------------------------------

async def fetch_user_events(token: str, username: str, max_pages: int = 3) -> list[dict]:
    """Return recent public events for the authenticated user."""
    events: list[dict] = []
    INTERESTING = {"WatchEvent", "ForkEvent", "CreateEvent", "PushEvent"}

    for page in range(1, max_pages + 1):
        data = await _github_get(
            f"/users/{username}/events",
            token,
            {"per_page": 100, "page": page},
        )
        if not data:
            break
        for ev in data:
            if ev.get("type") not in INTERESTING:
                continue
            try:
                ts = datetime.fromisoformat(
                    (ev.get("created_at") or "").replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except Exception:
                ts = datetime.utcnow()

            repo = ev.get("repo") or {}
            repo_name = repo.get("name") or ""
            payload = ev.get("payload") or {}
            ev_type = ev.get("type", "")

            if ev_type == "WatchEvent":
                title = f"Starred: {repo_name}"
            elif ev_type == "ForkEvent":
                title = f"Forked: {repo_name}"
            elif ev_type == "CreateEvent":
                ref_type = payload.get("ref_type", "repo")
                title = f"Created {ref_type}: {repo_name}"
            elif ev_type == "PushEvent":
                commits = payload.get("commits") or []
                first_msg = commits[0].get("message", "")[:80] if commits else ""
                title = f"Pushed to {repo_name}" + (f": {first_msg}" if first_msg else "")
            else:
                title = f"{ev_type}: {repo_name}"

            events.append({
                "timestamp": ts,
                "source": "github",
                "title": title,
                "artist": None,
                "url": f"https://github.com/{repo_name}",
                "duration": None,
                "metadata": ev,
            })
        if len(data) < 100:
            break
    return events


# ------------------------------------------------------------------
# Master sync function
# ------------------------------------------------------------------

async def sync_github_user_history(
    db,
    user_id: int,
    access_token: str,
) -> dict:
    from app.api.history import save_history_events

    # Get authenticated username first
    me = await _github_get("/user", access_token)
    username = me.get("login") or ""

    starred = await fetch_starred_repos(access_token)
    user_events = await fetch_user_events(access_token, username) if username else []

    all_events = starred + user_events
    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=all_events,
        source="github",
    )

    return {
        "imported": imported,
        "duplicates": duplicates,
        "total": len(all_events),
        "username": username,
    }
