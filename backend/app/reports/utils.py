from datetime import datetime, timezone
from typing import Any


def parse_ts(ts: Any) -> datetime | None:
    """
    Parse a timestamp into a naive UTC datetime.

    Accepts:
    - ``datetime`` objects (tzinfo stripped)
    - ISO-8601 strings (with or without trailing Z)
    - Unix epoch integers / floats in seconds or milliseconds
    - Common date-string formats via strptime fallback
    """
    if isinstance(ts, datetime):
        return ts.replace(tzinfo=None)

    if isinstance(ts, (int, float)):
        # Heuristic: values > 1e11 are millisecond-epoch timestamps
        epoch_s = ts / 1000.0 if ts > 1e11 else float(ts)
        try:
            return datetime.fromtimestamp(epoch_s, tz=timezone.utc).replace(tzinfo=None)
        except (OSError, OverflowError, ValueError):
            return None


    if isinstance(ts, str):
        cleaned = ts.replace("Z", "+00:00").replace("/", "-").strip()
        try:
            return datetime.fromisoformat(cleaned).replace(tzinfo=None)
        except Exception:
            pass
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
                    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y"):
            try:
                return datetime.strptime(cleaned.split("+")[0].strip()[:19], fmt)
            except Exception:
                continue

    return None
