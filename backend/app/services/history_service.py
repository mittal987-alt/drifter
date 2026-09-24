import hashlib
import csv
import io
import json
import zipfile
from datetime import datetime
from io import BytesIO
from typing import Any


# --------------------------------------------------
# Timestamp
# --------------------------------------------------

def parse_timestamp(value: Any) -> datetime | None:

    if not value:
        return None

    if isinstance(value, datetime):
        return value

    value = str(value).strip()

    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]

    for fmt in formats:

        try:
            return datetime.strptime(
                value,
                fmt
            )
        except ValueError:
            pass

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        ).replace(tzinfo=None)

    except ValueError:
        return None


# --------------------------------------------------
# YouTube
# --------------------------------------------------

def normalize_youtube_event(item: dict):

    timestamp = parse_timestamp(
        item.get("time")
        or item.get("timestamp")
        or item.get("date")
    )

    if not timestamp:
        return None

    title = (
        item.get("title")
        or item.get("name")
        or ""
    )

    # Google Takeout often stores
    # "Watched TITLE"

    if title.startswith("Watched "):
        title = title[8:]

    url = (
        item.get("titleUrl")
        or item.get("url")
    )

    return {
        "timestamp": timestamp,
        "source": "youtube",
        "title": title,
        "artist": None,
        "url": url,
        "duration": None,
        "metadata": item,
    }


# --------------------------------------------------
# Spotify
# --------------------------------------------------

def normalize_spotify_event(item: dict):
    if not isinstance(item, dict):
        return None

    track_obj = item.get("track") if isinstance(item.get("track"), dict) else item

    timestamp = parse_timestamp(
        item.get("played_at")
        or item.get("ts")
        or item.get("timestamp")
        or item.get("endTime")
    )

    if not timestamp:
        timestamp = datetime.utcnow()

    # Artist extraction
    artist = (
        track_obj.get("master_metadata_album_artist_name")
        or track_obj.get("artistName")
        or track_obj.get("artist")
        or ""
    )
    if not artist and "artists" in track_obj and isinstance(track_obj["artists"], list):
        artist = ", ".join(
            a.get("name", "") for a in track_obj["artists"] if isinstance(a, dict) and a.get("name")
        )

    # Title extraction
    title = (
        track_obj.get("master_metadata_track_name")
        or track_obj.get("trackName")
        or track_obj.get("name")
        or track_obj.get("track")
        or ""
    )

    if not title:
        return None

    # Duration extraction
    duration = (
        track_obj.get("duration_ms")
        or item.get("ms_played")
        or item.get("msPlayed")
    )

    if duration is not None:
        try:
            duration = float(duration) / 1000
        except (TypeError, ValueError):
            duration = None

    # URL extraction
    url = None
    if isinstance(track_obj.get("external_urls"), dict):
        url = track_obj["external_urls"].get("spotify")
    if not url:
        track_uri = track_obj.get("spotify_track_uri") or track_obj.get("uri")
        if track_uri and isinstance(track_uri, str):
            parts = track_uri.split(":")
            if len(parts) == 3:
                url = f"https://open.spotify.com/{parts[1]}/{parts[2]}"

    return {
        "timestamp": timestamp,
        "source": "spotify",
        "title": title,
        "artist": artist,
        "url": url,
        "duration": duration,
        "metadata": item,
    }


# --------------------------------------------------
# GitHub
# --------------------------------------------------

def normalize_github_event(item: dict):
    if not isinstance(item, dict):
        return None

    timestamp = parse_timestamp(
        item.get("created_at")
        or item.get("starred_at")
        or item.get("timestamp")
        or item.get("updated_at")
    )
    if not timestamp:
        timestamp = datetime.utcnow()

    title = (
        item.get("full_name")
        or item.get("name")
        or (item.get("repo", {}).get("name") if isinstance(item.get("repo"), dict) else None)
        or item.get("title")
        or ""
    )
    if not title:
        return None

    desc = item.get("description") or item.get("language") or ""
    if desc:
        title = f"{title} ({desc})"

    url = item.get("html_url") or item.get("url") or f"https://github.com/{title.split(' ')[0]}"

    return {
        "timestamp": timestamp,
        "source": "github",
        "title": title,
        "artist": item.get("language") or item.get("owner", {}).get("login") if isinstance(item.get("owner"), dict) else None,
        "url": url,
        "duration": None,
        "metadata": item,
    }


# --------------------------------------------------
# Netflix
# --------------------------------------------------

def normalize_netflix_event(item: dict):
    if not isinstance(item, dict):
        return None

    timestamp = parse_timestamp(
        item.get("Date")
        or item.get("date")
        or item.get("timestamp")
        or item.get("Start Time")
        or item.get("startTime")
    )
    if not timestamp:
        timestamp = datetime.utcnow()

    title = (
        item.get("Title")
        or item.get("title")
        or item.get("name")
        or ""
    )
    if not title:
        return None

    duration = item.get("Duration") or item.get("duration")

    return {
        "timestamp": timestamp,
        "source": "netflix",
        "title": title,
        "artist": None,
        "url": None,
        "duration": duration,
        "metadata": item,
    }


# --------------------------------------------------
# Reddit
# --------------------------------------------------

def normalize_reddit_event(item: dict):
    if not isinstance(item, dict):
        return None

    timestamp = parse_timestamp(
        item.get("date")
        or item.get("created_utc")
        or item.get("timestamp")
    )
    if not timestamp:
        timestamp = datetime.utcnow()

    title = (
        item.get("title")
        or item.get("body")
        or item.get("subreddit")
        or ""
    )
    if not title:
        return None

    sub = item.get("subreddit")
    if sub and not title.startswith(f"r/{sub}"):
        title = f"r/{sub}: {title[:120]}"

    url = item.get("permalink") or item.get("url")

    return {
        "timestamp": timestamp,
        "source": "reddit",
        "title": title,
        "artist": item.get("author") or sub,
        "url": url,
        "duration": None,
        "metadata": item,
    }


# --------------------------------------------------
# Steam
# --------------------------------------------------

def normalize_steam_event(item: dict):
    if not isinstance(item, dict):
        return None

    timestamp = parse_timestamp(
        item.get("last_played")
        or item.get("rtime_last_played")
        or item.get("timestamp")
    )
    if not timestamp:
        timestamp = datetime.utcnow()

    title = item.get("name") or item.get("title") or ""
    if not title:
        return None

    playtime_min = item.get("playtime_forever") or item.get("playtime_2weeks")

    return {
        "timestamp": timestamp,
        "source": "steam",
        "title": title,
        "artist": None,
        "url": None,
        "duration": playtime_min,
        "metadata": item,
    }


# --------------------------------------------------
# Browser Web History
# --------------------------------------------------

def normalize_browser_event(item: dict):
    if not isinstance(item, dict):
        return None

    timestamp = parse_timestamp(
        item.get("visit_time")
        or item.get("lastVisitTime")
        or item.get("timestamp")
        or item.get("time")
    )
    if not timestamp:
        timestamp = datetime.utcnow()

    title = item.get("title") or item.get("url") or ""
    if not title:
        return None

    return {
        "timestamp": timestamp,
        "source": "browser",
        "title": title,
        "artist": None,
        "url": item.get("url"),
        "duration": None,
        "metadata": item,
    }


# --------------------------------------------------
# Generic normalization
# --------------------------------------------------

def normalize_event(
    item: dict,
    source: str
):
    src = (source or "youtube").lower()

    if src == "youtube":
        return normalize_youtube_event(item)

    if src == "spotify":
        return normalize_spotify_event(item)

    if src == "github":
        return normalize_github_event(item)

    if src == "netflix":
        return normalize_netflix_event(item)

    if src == "reddit":
        return normalize_reddit_event(item)

    if src == "steam":
        return normalize_steam_event(item)

    if src in ("browser", "chrome", "web"):
        return normalize_browser_event(item)

    # Fallback to general event normalization
    title = item.get("title") or item.get("name") or item.get("track")
    if not title:
        return None
    return {
        "timestamp": parse_timestamp(item.get("timestamp") or item.get("date") or item.get("time")) or datetime.utcnow(),
        "source": src,
        "title": str(title),
        "artist": item.get("artist") or item.get("author"),
        "url": item.get("url"),
        "duration": item.get("duration"),
        "metadata": item,
    }


# --------------------------------------------------
# JSON parser
# --------------------------------------------------

def parse_json_history(
    content: bytes,
    source: str
):

    data = json.loads(
        content.decode("utf-8-sig")
    )

    if isinstance(data, dict):

        if "items" in data:

            data = data["items"]

        elif "events" in data:

            data = data["events"]

        else:

            data = [data]

    if not isinstance(data, list):

        raise ValueError(
            "JSON must contain a list of history events."
        )

    events = []

    for item in data:

        if not isinstance(item, dict):
            continue

        event = normalize_event(
            item,
            source
        )

        if event:
            events.append(event)

    return events


# --------------------------------------------------
# CSV parser
# --------------------------------------------------

def parse_csv_history(
    content: bytes,
    source: str
):

    text = content.decode(
        "utf-8-sig"
    )

    reader = csv.DictReader(
        io.StringIO(text)
    )

    events = []

    for row in reader:

        event = normalize_event(
            dict(row),
            source
        )

        if event:
            events.append(event)

    return events


# --------------------------------------------------
# File parser
# --------------------------------------------------

def parse_history_file(
    content: bytes,
    filename: str,
    source: str
):

    filename_lower = filename.lower()

    if filename_lower.endswith(".json"):

        return parse_json_history(
            content,
            source
        )

    if filename_lower.endswith(".csv"):

        return parse_csv_history(
            content,
            source
        )

    raise ValueError(
        "Unsupported file type. "
        "Use JSON or CSV."
    )


def parse_youtube_archive_bytes(content: bytes) -> list[dict]:
    """Parse JSON records from a Data Portability archive object."""
    candidates: list[bytes] = []

    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            candidates = [
                archive.read(name)
                for name in archive.namelist()
                if name.lower().endswith(".json")
            ]
    except zipfile.BadZipFile:
        candidates = [content]

    records = []
    for raw in candidates:
        try:
            data = json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue

        if isinstance(data, dict):
            data = data.get("events", data.get("items", [data]))

        if isinstance(data, list):
            records.extend(
                item for item in data if isinstance(item, dict)
            )

    return records


def parse_youtube_history(data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Parse Google Takeout YouTube watch-history JSON
    into Drifter's normalized event format.
    """

    events = []

    for item in data:
        if not isinstance(item, dict):
            continue

        title = item.get("title")

        # Ignore entries without a title
        if not title:
            continue

        # Google Takeout commonly stores:
        # "time": "2025-01-01T12:34:56.000Z"
        raw_time = item.get("time")

        if not raw_time:
            continue

        try:
            timestamp = datetime.fromisoformat(
                raw_time.replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            continue

        # YouTube URL
        url = None

        subtitles = item.get("subtitles")

        if subtitles and isinstance(subtitles, list):
            first_subtitle = subtitles[0]

            if isinstance(first_subtitle, dict):
                url = first_subtitle.get("url")

        # Remove "Watched " prefix
        clean_title = title

        if clean_title.lower().startswith("watched "):
            clean_title = clean_title[8:]

        event = {
            "timestamp": timestamp,
            "source": "youtube",
            "title": clean_title,
            "artist": None,
            "url": url,
            "duration": None,
            "metadata": {
                "original_title": title,
                "header": item.get("header"),
                "products": item.get("products"),
                "subtitles": subtitles,
            },
        }

        events.append(event)

    return events


def create_event_hash(event: dict[str, Any], user_id: int | None = None) -> str:
    """
    Create a deterministic hash for deduplication.
    """

    raw = "|".join(
        [
            str(user_id or ""),
            str(event.get("source", "")),
            str(event.get("timestamp", "")),
            str(event.get("title", "")),
            str(event.get("url", "")),
        ]
    )

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()