from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any


def _parse_timestamp(ts: Any) -> datetime | None:
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, (int, float)):
        if ts > 1e11:
            return datetime.utcfromtimestamp(ts / 1000.0)
        return datetime.utcfromtimestamp(ts)
    if isinstance(ts, str):
        cleaned = ts.replace("Z", "+00:00").replace("/", "-").strip()
        try:
            return datetime.fromisoformat(cleaned).replace(tzinfo=None)
        except Exception:
            pass
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(cleaned[:19], fmt)
            except Exception:
                continue
    return None


def generate_focus_pulse(
    assignments: list[dict[str, Any]],
    days_back: int = 112,  # 16 weeks default
) -> dict[str, Any]:
    """
    Generate weekly activity heatmap, streak telemetry, and diurnal focus matrices
    from historical event logs.
    """
    total_events = len(assignments)

    # 1. Group events by date and extract diurnal patterns
    events_by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    day_of_week_counts: Counter[str] = Counter()
    hour_counts: Counter[int] = Counter()
    night_events_count = 0
    weekend_events_count = 0

    # 7 days x 4 blocks matrix
    # blocks: morning (5-11), afternoon (12-16), evening (17-20), night (21-4)
    matrix_grid: dict[str, dict[str, int]] = {
        d: {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
        for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    }

    day_abbrs = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for event in assignments:
        ts = _parse_timestamp(event.get("timestamp"))
        if not ts:
            continue

        date_str = ts.strftime("%Y-%m-%d")
        events_by_date[date_str].append(event)

        dow_idx = ts.weekday()
        dow_abbr = day_abbrs[dow_idx]
        dow_name = day_names[dow_idx]
        day_of_week_counts[dow_name] += 1

        hour = ts.hour
        hour_counts[hour] += 1

        if dow_idx in (5, 6):
            weekend_events_count += 1

        if hour >= 23 or hour < 5:
            night_events_count += 1

        # Matrix block
        if 5 <= hour < 12:
            matrix_grid[dow_abbr]["morning"] += 1
        elif 12 <= hour < 17:
            matrix_grid[dow_abbr]["afternoon"] += 1
        elif 17 <= hour < 21:
            matrix_grid[dow_abbr]["evening"] += 1
        else:
            matrix_grid[dow_abbr]["night"] += 1

    # 2. Build continuous day-by-day heatmap calendar grid
    now = datetime.utcnow().date()
    start_date = now - timedelta(days=days_back - 1)

    # Adjust start_date to Monday for clean GitHub-style 7-row columns
    start_offset = start_date.weekday()
    aligned_start = start_date - timedelta(days=start_offset)

    heatmap_cells: list[dict[str, Any]] = []
    curr = aligned_start
    all_dates_with_events = set(events_by_date.keys())

    while curr <= now:
        d_str = curr.strftime("%Y-%m-%d")
        day_events = events_by_date.get(d_str, [])
        count = len(day_events)

        # Level determination
        if count == 0:
            level = 0
        elif count <= 2:
            level = 1
        elif count <= 5:
            level = 2
        elif count <= 10:
            level = 3
        else:
            level = 4

        # Top topic and source breakdown for that day
        top_topic = None
        source_counts: dict[str, int] = {}
        samples: list[str] = []

        if count > 0:
            topics_counter = Counter(e.get("topic") or "Other" for e in day_events)
            top_topic = topics_counter.most_common(1)[0][0]
            for e in day_events:
                src = (e.get("source") or "unknown").lower()
                source_counts[src] = source_counts.get(src, 0) + 1
            samples = [e.get("title", "") for e in day_events[:3] if e.get("title")]

        heatmap_cells.append({
            "date": d_str,
            "day_of_week": curr.weekday(),
            "count": count,
            "level": level,
            "dominant_topic": top_topic,
            "sources": source_counts,
            "samples": samples,
            "is_future": curr > now,
        })
        curr += timedelta(days=1)

    # 3. Calculate Streaks
    sorted_active_dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in all_dates_with_events])
    current_streak = 0
    longest_streak = 0

    if sorted_active_dates:
        # Check current streak starting from today or yesterday
        check_date = now
        if check_date not in sorted_active_dates:
            check_date = now - timedelta(days=1)

        temp_curr = 0
        while check_date in sorted_active_dates:
            temp_curr += 1
            check_date -= timedelta(days=1)
        current_streak = temp_curr

        # Longest streak
        temp_streak = 1
        longest_streak = 1
        for i in range(1, len(sorted_active_dates)):
            if sorted_active_dates[i] == sorted_active_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            elif sorted_active_dates[i] > sorted_active_dates[i - 1] + timedelta(days=1):
                temp_streak = 1

    # 4. Telemetry summaries
    peak_day = day_of_week_counts.most_common(1)[0][0] if day_of_week_counts else "Unknown"

    peak_hour = hour_counts.most_common(1)[0][0] if hour_counts else 14
    if 5 <= peak_hour < 12:
        peak_block = "Morning (5 AM - 12 PM)"
    elif 12 <= peak_hour < 17:
        peak_block = "Afternoon (12 PM - 5 PM)"
    elif 17 <= peak_hour < 21:
        peak_block = "Evening (5 PM - 9 PM)"
    else:
        peak_block = "Night (9 PM - 5 AM)"

    weekend_pct = round((weekend_events_count / max(total_events, 1)) * 100, 1)
    nocturnal_pct = round((night_events_count / max(total_events, 1)) * 100, 1)

    # Flatten normalized matrix for heatmap table
    matrix_list = []
    max_block_val = max((v for row in matrix_grid.values() for v in row.values()), default=1)
    for dow, blocks in matrix_grid.items():
        matrix_list.append({
            "day": dow,
            "morning": blocks["morning"],
            "afternoon": blocks["afternoon"],
            "evening": blocks["evening"],
            "night": blocks["night"],
            "total": sum(blocks.values()),
        })

    return {
        "status": "READY",
        "total_events": total_events,
        "active_days_count": len(all_dates_with_events),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "peak_focus_day": peak_day,
        "peak_focus_block": peak_block,
        "weekend_percentage": weekend_pct,
        "nocturnal_percentage": nocturnal_pct,
        "heatmap": heatmap_cells,
        "matrix": matrix_list,
        "generated_at": datetime.utcnow().isoformat(),
    }
