import hashlib
import html
import json
import re
import zipfile
from datetime import datetime
from io import BytesIO
from typing import Any


def parse_flexible_timestamp(val: Any) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val

    s = str(val).strip()
    s = re.sub(r"\bSept\b", "Sep", s, flags=re.IGNORECASE)

    try:
        return datetime.fromisoformat(
            s.replace("Z", "+00:00")
        ).replace(tzinfo=None)
    except Exception:
        pass

    clean_s = re.sub(
        r"\s+(?:IST|UTC|GMT|EDT|EST|CDT|CST|MDT|MST|PDT|PST|BST|CEST|CET|WEST|WET)(?:[+-]\d{1,2}:?\d{2})?$",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()
    clean_s = re.sub(
        r"\s+GMT[+-]\d{1,2}(?::?\d{2})?$",
        "",
        clean_s,
        flags=re.IGNORECASE,
    ).strip()

    formats = [
        "%d %b %Y, %H:%M:%S",
        "%d %b %Y, %I:%M:%S %p",
        "%b %d, %Y, %I:%M:%S %p",
        "%b %d, %Y, %H:%M:%S",
        "%d %B %Y, %H:%M:%S",
        "%B %d, %Y, %I:%M:%S %p",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",
        "%d %b %Y, %H:%M",
        "%d %b %Y, %I:%M %p",
        "%b %d, %Y, %I:%M %p",
        "%b %d, %Y, %H:%M",
        "%d-%b-%Y %H:%M:%S",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(clean_s, fmt)
        except ValueError:
            pass

    return None


def parse_youtube_html(html_str: str) -> list[dict[str, Any]]:
    cell_pattern = re.compile(
        r'<div[^>]*class="[^"]*content-cell[^"]*"[^>]*>(.*?)</div>',
        re.DOTALL | re.IGNORECASE,
    )
    cells = cell_pattern.findall(html_str)

    if not cells:
        cells = re.findall(
            r'(Watched\s+<a\s+href="[^"]*(?:youtube\.com/watch|youtu\.be)[^"]*">.*?)(?=(?:Watched\s+<a|<div|$))',
            html_str,
            re.DOTALL | re.IGNORECASE,
        )

    items = []
    for cell in cells:
        link_match = re.search(
            r'<a\s+href="([^"]*(?:youtube\.com/watch|youtu\.be)[^"]*)"[^>]*>(.*?)</a>',
            cell,
            re.IGNORECASE | re.DOTALL,
        )
        if not link_match:
            continue

        video_url = link_match.group(1).strip()
        raw_title = html.unescape(
            re.sub(r"<[^>]+>", "", link_match.group(2))
        ).strip()
        if not raw_title:
            continue

        channel_match = re.search(
            r'<a\s+href="([^"]*(?:youtube\.com/channel/|youtube\.com/@|youtube\.com/user/)[^"]*)"[^>]*>(.*?)</a>',
            cell,
            re.IGNORECASE | re.DOTALL,
        )
        channel_name = None
        channel_url = None
        if channel_match:
            channel_url = channel_match.group(1).strip()
            channel_name = html.unescape(
                re.sub(r"<[^>]+>", "", channel_match.group(2))
            ).strip()

        parts = re.split(r"<br\s*/?>", cell, flags=re.IGNORECASE)
        date_str = ""
        for part in reversed(parts):
            clean = re.sub(r"<[^>]+>", "", part).strip()
            if re.search(r"\d{4}", clean):
                date_str = clean
                break

        timestamp = None
        if date_str:
            timestamp = parse_flexible_timestamp(date_str)

        if not timestamp:
            timestamp = datetime.utcnow()

        item: dict[str, Any] = {
            "title": raw_title,
            "time": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "titleUrl": video_url,
            "header": "YouTube",
        }
        if channel_name:
            item["subtitles"] = [
                {
                    "name": channel_name,
                    "url": channel_url,
                }
            ]
        items.append(item)

    return items


def parse_youtube_history(
    data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    events = []

    for item in data:
        if not isinstance(item, dict):
            continue

        title = item.get("title") or item.get("name")
        raw_time = (
            item.get("time")
            or item.get("timestamp")
            or item.get("date")
        )

        if not title or not raw_time:
            continue

        timestamp = parse_flexible_timestamp(raw_time)

        if not timestamp:
            continue

        clean_title = title

        if clean_title.lower().startswith("watched "):
            clean_title = clean_title[8:].strip()

        url = item.get("titleUrl") or item.get("url")

        subtitles = item.get("subtitles")
        artist = None

        if isinstance(subtitles, list) and subtitles:
            first = subtitles[0]
            if isinstance(first, dict):
                if not url:
                    url = first.get("url")
                artist = first.get("name")

        events.append(
            {
                "timestamp": timestamp,
                "source": "youtube",
                "title": clean_title,
                "artist": artist,
                "url": url,
                "duration": None,
                "metadata": {
                    "original_title": title,
                    "header": item.get("header"),
                    "products": item.get("products"),
                    "subtitles": subtitles,
                },
            }
        )

    return events


def create_event_hash(event: dict[str, Any]) -> str:
    raw = "|".join(
        [
            str(event.get("source", "")),
            str(event.get("timestamp", "")),
            str(event.get("title", "")),
            str(event.get("url", "")),
        ]
    )

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def load_youtube_history_file(
    filename: str,
    content: bytes,
) -> list[dict[str, Any]]:
    """
    Load YouTube history from:
    - JSON file
    - HTML file
    - Google Takeout ZIP (containing JSON or HTML)
    """

    lower_name = filename.lower()

    # ---------------------------------------------------------
    # Direct JSON
    # ---------------------------------------------------------

    if lower_name.endswith(".json"):
        try:
            data = json.loads(content.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"Invalid JSON file: {exc}")

        if not isinstance(data, list):
            raise ValueError(
                "YouTube history JSON must contain an array."
            )

        return data

    # ---------------------------------------------------------
    # Direct HTML
    # ---------------------------------------------------------

    if lower_name.endswith((".html", ".htm")):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace")

        items = parse_youtube_html(text)
        if not items:
            raise ValueError(
                "Could not extract any YouTube history records from the HTML file."
            )
        return items

    # ---------------------------------------------------------
    # ZIP
    # ---------------------------------------------------------

    if lower_name.endswith(".zip"):
        try:
            archive = zipfile.ZipFile(BytesIO(content))
        except zipfile.BadZipFile:
            raise ValueError(
                "The uploaded file is not a valid ZIP archive."
            )

        all_names = archive.namelist()

        # 1. Look for JSON files
        json_files = [
            name
            for name in all_names
            if name.lower().endswith(".json")
        ]

        preferred_json = [
            name
            for name in json_files
            if (
                "watch-history" in name.lower()
                or "watch_history" in name.lower()
                or "history" in name.lower()
            )
        ]

        candidates_json = preferred_json or json_files

        for json_name in candidates_json:
            try:
                raw = archive.read(json_name)
                data = json.loads(raw.decode("utf-8-sig"))

                if isinstance(data, list) and len(data) > 0:
                    if any(
                        isinstance(item, dict)
                        and ("title" in item or "name" in item)
                        and (
                            "time" in item
                            or "timestamp" in item
                            or "date" in item
                        )
                        for item in data[:100]
                    ):
                        return data
            except Exception:
                continue

        # 2. Look for HTML files (e.g. watch-history.html)
        html_files = [
            name
            for name in all_names
            if name.lower().endswith((".html", ".htm"))
        ]

        preferred_html = [
            name
            for name in html_files
            if (
                "watch-history" in name.lower()
                or "watch_history" in name.lower()
                or "history" in name.lower()
            )
        ]

        candidates_html = preferred_html or html_files

        for html_name in candidates_html:
            try:
                raw = archive.read(html_name)
                try:
                    text = raw.decode("utf-8-sig")
                except UnicodeDecodeError:
                    text = raw.decode(
                        "latin-1", errors="replace"
                    )

                items = parse_youtube_html(text)
                if items:
                    return items
            except Exception:
                continue

        raise ValueError(
            "Could not find a valid YouTube watch-history file (JSON or HTML) inside the ZIP."
        )

    raise ValueError(
        "Unsupported file type. Upload a .json, .html, or .zip file."
    )