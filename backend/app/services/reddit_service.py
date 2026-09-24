"""
Reddit ingestion service.

Fetches:
  - Saved posts & comments
  - Upvoted posts

and normalizes them into Drifter history_events with source="reddit".

Reddit OAuth scopes required: identity history save
"""

from datetime import datetime, timezone
from typing import Any

import httpx


REDDIT_API = "https://oauth.reddit.com"
USER_AGENT = "Drifter/1.0 (personal interest tracker)"


# ------------------------------------------------------------------
# Low-level API helper
# ------------------------------------------------------------------

async def _reddit_get(path: str, token: str, params: dict | None = None) -> Any:
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{REDDIT_API}{path}",
            headers=headers,
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _ts_from_created(created_utc: Any) -> datetime:
    try:
        return datetime.fromtimestamp(float(created_utc), tz=timezone.utc).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _normalize_reddit_child(child: dict, label: str) -> dict | None:
    """Convert a Reddit listing child (post or comment) into a Drifter event."""
    data = child.get("data") or {}
    kind = child.get("kind", "")  # "t1" = comment, "t3" = link/post

    created = data.get("created_utc") or data.get("created")
    ts = _ts_from_created(created)

    subreddit = data.get("subreddit") or ""
    author = data.get("author") or ""

    if kind == "t3":  # Link / post
        raw_title = data.get("title") or data.get("url") or ""
        title = f"r/{subreddit}: {raw_title[:120]}" if subreddit else raw_title[:120]
        url = data.get("url") or f"https://reddit.com{data.get('permalink', '')}"
    elif kind == "t1":  # Comment
        body = (data.get("body") or "")[:120]
        title = f"r/{subreddit}: {body}" if subreddit else body
        url = f"https://reddit.com{data.get('permalink', '')}"
    else:
        return None

    if not title.strip():
        return None

    return {
        "timestamp": ts,
        "source": "reddit",
        "title": title,
        "artist": author or subreddit or None,
        "url": url,
        "duration": None,
        "metadata": {
            "kind": kind,
            "subreddit": subreddit,
            "score": data.get("score"),
            "label": label,
        },
    }


async def _paginate_listing(
    path: str,
    token: str,
    label: str,
    limit: int = 100,
    max_pages: int = 5,
) -> list[dict]:
    events: list[dict] = []
    after: str | None = None

    for _ in range(max_pages):
        params: dict = {"limit": limit, "raw_json": 1}
        if after:
            params["after"] = after

        data = await _reddit_get(path, token, params)
        listing = (data or {}).get("data") or {}
        children = listing.get("children") or []

        for child in children:
            ev = _normalize_reddit_child(child, label)
            if ev:
                events.append(ev)

        after = listing.get("after")
        if not after or len(children) < limit:
            break

    return events


# ------------------------------------------------------------------
# Master sync function
# ------------------------------------------------------------------

async def sync_reddit_user_history(
    db,
    user_id: int,
    access_token: str,
) -> dict:
    from app.api.history import save_history_events

    saved = await _paginate_listing("/user/me/saved", access_token, label="saved")
    upvoted = await _paginate_listing("/user/me/upvoted", access_token, label="upvoted")

    all_events = saved + upvoted
    imported, duplicates = save_history_events(
        db=db,
        user_id=user_id,
        events=all_events,
        source="reddit",
    )

    return {
        "imported": imported,
        "duplicates": duplicates,
        "total": len(all_events),
    }
