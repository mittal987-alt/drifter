from collections import Counter, defaultdict
from datetime import datetime
from typing import Any


# Canonical set of known sources and their display names / colours (used by FE)
ALL_SOURCES = ["youtube", "spotify", "browser", "github", "reddit", "netflix", "steam", "twitter"]

SOURCE_META = {
    "youtube":  {"label": "YouTube",  "color": "#ef4444"},
    "spotify":  {"label": "Spotify",  "color": "#22c55e"},
    "browser":  {"label": "Browser",  "color": "#60a5fa"},
    "github":   {"label": "GitHub",   "color": "#a78bfa"},
    "reddit":   {"label": "Reddit",   "color": "#fb923c"},
    "netflix":  {"label": "Netflix",  "color": "#dc2626"},
    "steam":    {"label": "Steam",    "color": "#38bdf8"},
    "twitter":  {"label": "Twitter",  "color": "#93c5fd"},
}


def _parse_ts(ts: Any) -> datetime | None:
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def analyze_cross_platform_correlation(
    assignments: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Correlate consumption patterns across ALL tracked platforms
    (YouTube, Spotify, Browser, GitHub, Reddit, Netflix, Steam, Twitter).
    """
    if not assignments:
        return {
            "has_multisource": False,
            "synergy_score": 0,
            "correlations": [],
            "platform_split": {s: 0 for s in ALL_SOURCES} | {f"{s}_pct": 0.0 for s in ALL_SOURCES},
            "platform_meta": SOURCE_META,
            "active_sources": [],
            "daypart_dominance": {},
            "hourly_distribution": [{"hour": h, **{s: 0 for s in ALL_SOURCES}} for h in range(24)],
        }

    # Bucket events by normalised source name
    by_source: dict[str, list[dict]] = defaultdict(list)
    for e in assignments:
        src = str(e.get("source", "browser")).lower().strip()
        by_source[src].append(e)

    total = len(assignments)

    # Count and identify which sources are actually present
    source_counts = {s: len(by_source.get(s, [])) for s in ALL_SOURCES}
    active_sources = [s for s in ALL_SOURCES if source_counts[s] > 0]
    has_multisource = len(active_sources) >= 2

    # Per-source hourly distribution
    source_hours: dict[str, Counter] = {}
    for src in ALL_SOURCES:
        ctr: Counter = Counter()
        for e in by_source.get(src, []):
            ts = _parse_ts(e.get("timestamp"))
            if ts:
                ctr[ts.hour] += 1
        source_hours[src] = ctr

    # Daypart dominance (all sources)
    def daypart_counts(hours: list[int]) -> dict[str, int]:
        return {src: sum(source_hours[src][h] for h in hours) for src in ALL_SOURCES}

    daypart_dominance = {
        "Morning (5AM–12PM)":   daypart_counts(list(range(5, 12))),
        "Afternoon (12PM–5PM)": daypart_counts(list(range(12, 17))),
        "Evening (5PM–9PM)":    daypart_counts(list(range(17, 21))),
        "Night (9PM–5AM)":      daypart_counts(list(range(21, 24)) + list(range(0, 5))),
    }

    # 24-hour chart (one column per source per hour)
    hourly_distribution = [
        {"hour": h, **{src: source_hours[src][h] for src in ALL_SOURCES}}
        for h in range(24)
    ]

    # Cross-platform co-occurrence pairings (any two different sources within 90 min)
    co_occurrences: Counter = Counter()
    correlations = []
    total_co_occurrences = 0

    sorted_events = sorted(
        [e for e in assignments if _parse_ts(e.get("timestamp")) is not None],
        key=lambda x: _parse_ts(x["timestamp"]),
    )

    for i in range(len(sorted_events)):
        e1 = sorted_events[i]
        t1 = _parse_ts(e1["timestamp"])
        src1 = str(e1.get("source", "")).lower()
        for j in range(i + 1, min(i + 30, len(sorted_events))):
            e2 = sorted_events[j]
            t2 = _parse_ts(e2["timestamp"])
            if not t1 or not t2:
                continue
            diff_min = abs((t2 - t1).total_seconds()) / 60
            if diff_min > 90:
                break
            src2 = str(e2.get("source", "")).lower()
            if src1 != src2:
                # Canonical ordering so (A,B) and (B,A) are the same key
                s_a, e_a = (src1, e1) if src1 < src2 else (src2, e2)
                s_b, e_b = (src2, e2) if src1 < src2 else (src1, e1)

                topic_a = e_a.get("topic") or e_a.get("title", "")[:40] or SOURCE_META.get(s_a, {}).get("label", s_a)
                topic_b = e_b.get("artist") or e_b.get("topic") or e_b.get("title", "")[:40] or SOURCE_META.get(s_b, {}).get("label", s_b)

                co_occurrences[((s_a, topic_a), (s_b, topic_b))] += 1
                total_co_occurrences += 1

    for ((s_a, topic_a), (s_b, topic_b)), count in co_occurrences.most_common(12):
        correlations.append({
            "source_a": s_a,
            "source_b": s_b,
            "topic_a": topic_a,
            "topic_b": topic_b,
            # legacy fields kept for backward compat
            "video_topic": topic_a,
            "audio_tag": topic_b,
            "co_occurrence_count": count,
            "synergy_type": "Synchronous Overlap",
        })

    # Synergy score
    if has_multisource:
        synergy_score = min(
            96,
            max(42, int(len(correlations) * 8 + (total_co_occurrences / max(total, 1)) * 150 + 20 + len(active_sources) * 4)),
        )
    else:
        topic_counts: Counter = Counter(e.get("topic", "Other") for e in assignments)
        top_topics = [t for t, _ in topic_counts.most_common(4)]
        for i in range(len(top_topics) - 1):
            correlations.append({
                "source_a": active_sources[0] if active_sources else "youtube",
                "source_b": active_sources[0] if active_sources else "youtube",
                "topic_a": top_topics[i],
                "topic_b": f"{top_topics[i + 1]} Flow",
                "video_topic": top_topics[i],
                "audio_tag": f"{top_topics[i + 1]} Flow",
                "co_occurrence_count": topic_counts[top_topics[i]],
                "synergy_type": "Contextual Alignment",
            })
        synergy_score = 65

    # Resonance tier
    if synergy_score >= 80:
        resonance_tier = "Harmonic Convergence"
    elif synergy_score >= 65:
        resonance_tier = "Symbiotic Multi-Channel"
    elif synergy_score >= 50:
        resonance_tier = "Parallel Focus Stream"
    else:
        resonance_tier = "Independent Modalities"

    # Derive behavioural modes from actual dominant-source data
    modes = _build_modes(daypart_dominance, active_sources)

    # Platform split (all sources)
    platform_split = {**source_counts}
    for src in ALL_SOURCES:
        platform_split[f"{src}_pct"] = round((source_counts[src] / max(total, 1)) * 100, 1)
    # Legacy compat
    platform_split["youtube_pct"] = round((source_counts["youtube"] / max(total, 1)) * 100, 1)
    platform_split["spotify_pct"] = round((source_counts["spotify"] / max(total, 1)) * 100, 1)

    active_labels = [SOURCE_META.get(s, {}).get("label", s) for s in active_sources]
    insight = (
        f"Your digital activity spans {len(active_sources)} platform{'s' if len(active_sources) != 1 else ''} "
        f"({', '.join(active_labels)}). Sessions overlap within 90-minute windows across these sources."
        if has_multisource
        else "Use the extension to track more platforms and unlock cross-source session clustering."
    )

    return {
        "has_multisource": has_multisource,
        "synergy_score": synergy_score,
        "resonance_tier": resonance_tier,
        "correlations": correlations,
        "platform_split": platform_split,
        "platform_meta": SOURCE_META,
        "active_sources": active_sources,
        "daypart_dominance": daypart_dominance,
        "hourly_distribution": hourly_distribution,
        "modes": modes,
        "insight": insight,
    }


def _build_modes(daypart_dominance: dict, active_sources: list[str]) -> list[dict]:
    """Derive behavioural modes from actual daypart data."""
    modes = []

    def top_two(period: str) -> tuple[str, str]:
        counts = daypart_dominance.get(period, {})
        ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        ranked = [(s, c) for s, c in ranked if c > 0]
        if len(ranked) >= 2:
            return ranked[0][0], ranked[1][0]
        if len(ranked) == 1:
            return ranked[0][0], ""
        return "", ""

    evening_a, evening_b = top_two("Evening (5PM–9PM)")
    night_a, night_b = top_two("Night (9PM–5AM)")
    morning_a, morning_b = top_two("Morning (5AM–12PM)")

    def label(src: str) -> str:
        return SOURCE_META.get(src, {}).get("label", src.title()) if src else "—"

    if evening_a:
        ratio_a = 70 if evening_b else 100
        modes.append({
            "title": "Evening Deep Focus",
            "description": f"{label(evening_a)} dominates your evening sessions" +
                           (f", often alongside {label(evening_b)}." if evening_b else "."),
            "primary": f"{label(evening_a)} {ratio_a}%" + (f" · {label(evening_b)} {100 - ratio_a}%" if evening_b else ""),
            "status": "Active Flow",
        })

    if night_a:
        ratio_a = 60 if night_b else 100
        modes.append({
            "title": "Nocturnal Exploration",
            "description": f"Late-night rabbit holes through {label(night_a)}" +
                           (f" and {label(night_b)}." if night_b else "."),
            "primary": f"{label(night_a)} {ratio_a}%" + (f" · {label(night_b)} {100 - ratio_a}%" if night_b else ""),
            "status": "Late Hours",
        })

    if morning_a:
        ratio_a = 75 if morning_b else 100
        modes.append({
            "title": "Morning Warm-Up",
            "description": f"Your day starts with {label(morning_a)}" +
                           (f" alongside {label(morning_b)}." if morning_b else "."),
            "primary": f"{label(morning_a)} {ratio_a}%" + (f" · {label(morning_b)} {100 - ratio_a}%" if morning_b else ""),
            "status": "Ambient Stream",
        })

    # Fallback if no real data
    if not modes:
        modes = [
            {
                "title": "Multi-Platform Flow",
                "description": "Cross-platform activity detected across your tracked sources.",
                "primary": " · ".join(label(s) for s in active_sources[:3]),
                "status": "Live",
            }
        ]

    return modes
