from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.reports.utils import parse_ts


def generate_focus_pulse(
    assignments: list[dict[str, Any]],
    days_back: int = 112,  # 16 weeks default
) -> dict[str, Any]:
    """
    Generate weekly activity heatmap, streak telemetry, and diurnal focus matrices
    from historical event logs.
    """
    # Fix #6: use timezone-aware now; compute once and reuse for both windowing and heatmap
    now = datetime.now(timezone.utc).date()
    window_start = now - timedelta(days=days_back - 1)

    # Fix #4: window all telemetry to the same days_back range as the heatmap
    windowed = [
        ev for ev in assignments
        if (ts := parse_ts(ev.get("timestamp"))) and ts.date() >= window_start
    ]
    total_events = len(windowed)

    # 1. Group events by date and extract diurnal patterns
    events_by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    day_of_week_counts: Counter[str] = Counter()
    hour_counts: Counter[int] = Counter()
    night_events_count = 0
    weekend_events_count = 0

    # 7 days x 4 blocks matrix
    # blocks: morning (5-11), afternoon (12-16), evening (17-22), night (23-4)
    matrix_grid: dict[str, dict[str, int]] = {
        d: {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
        for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    }

    day_abbrs = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for event in windowed:
        ts = parse_ts(event.get("timestamp"))
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

        # Matrix block — night boundary: 23:00, consistent with rest of codebase (Fix #3)
        if 5 <= hour < 12:
            matrix_grid[dow_abbr]["morning"] += 1
        elif 12 <= hour < 17:
            matrix_grid[dow_abbr]["afternoon"] += 1
        elif 17 <= hour < 23:
            matrix_grid[dow_abbr]["evening"] += 1
        else:
            matrix_grid[dow_abbr]["night"] += 1

    # 2. Build continuous day-by-day heatmap calendar grid
    # `now` already defined above (Fix #6 — no second utcnow() call needed)
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
            # Fix #7: is_future removed — curr never exceeds now in this loop
        })
        curr += timedelta(days=1)

    # 3. Calculate Streaks
    # Fix #1a: use a set for O(1) membership tests instead of list scan
    sorted_active_dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in all_dates_with_events])
    active_date_set: set = set(sorted_active_dates)
    current_streak = 0
    longest_streak = 0

    if sorted_active_dates:
        # Fix #1b: anchor from the last known active date, not unconditionally from
        # today/yesterday — avoids returning 0 when the most recent activity is 2+ days ago.
        last_active = sorted_active_dates[-1]
        anchor = last_active if (now - last_active).days <= 1 else None

        if anchor is not None:
            check_date = anchor
            while check_date in active_date_set:
                current_streak += 1
                check_date -= timedelta(days=1)

        # Longest streak
        temp_streak = 1
        longest_streak = 1
        for i in range(1, len(sorted_active_dates)):
            if sorted_active_dates[i] == sorted_active_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            else:
                temp_streak = 1

    # 4. Telemetry summaries
    peak_day = day_of_week_counts.most_common(1)[0][0] if day_of_week_counts else "Unknown"

    peak_hour = hour_counts.most_common(1)[0][0] if hour_counts else 14
    if 5 <= peak_hour < 12:
        peak_block = "Morning (5 AM - 12 PM)"
    elif 12 <= peak_hour < 17:
        peak_block = "Afternoon (12 PM - 5 PM)"
    elif 17 <= peak_hour < 23:
        peak_block = "Evening (5 PM - 11 PM)"
    else:
        peak_block = "Night (11 PM - 5 AM)"

    weekend_pct = round((weekend_events_count / max(total_events, 1)) * 100, 1)
    nocturnal_pct = round((night_events_count / max(total_events, 1)) * 100, 1)

    # Flatten matrix for the heatmap table
    # Fix #5: removed dead max_block_val (was computed but never used for normalisation)
    matrix_list = [
        {
            "day": dow,
            "morning": blocks["morning"],
            "afternoon": blocks["afternoon"],
            "evening": blocks["evening"],
            "night": blocks["night"],
            "total": sum(blocks.values()),
        }
        for dow, blocks in matrix_grid.items()
    ]

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
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
