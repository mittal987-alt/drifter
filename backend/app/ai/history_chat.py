from collections import Counter, defaultdict
from datetime import datetime
import os
import re
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
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y",
        ):
            try:
                return datetime.strptime(cleaned.split("+")[0].strip(), fmt)
            except Exception:
                continue
    return None


def answer_history_chat(
    question: str,
    chat_history: list[dict[str, str]] | None,
    events: list[dict[str, Any]],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Synthesize an intelligent, comprehensive response to natural language queries
    about the user's history, topic shifts, rabbit holes, obsessions, and media habits.
    """
    q_lower = question.lower().strip()
    total_events = len(events)

    # Extract topic distributions
    topic_counts = Counter()
    assignments = analysis.get("assignments") or events
    for e in assignments:
        t = e.get("topic", "Other")
        if t not in ("Other", "Unassigned", "Unknown"):
            topic_counts[t] += 1
        elif not topic_counts:
            topic_counts[t] += 1

    top_topics = [t for t, _ in topic_counts.most_common(8)]
    dominant_topic = top_topics[0] if top_topics else "General Exploration"

    evolution = analysis.get("evolution", {})
    behavior = analysis.get("behavior", {})

    rising = [
        item.get("topic")
        for item in evolution.get("rising", [])
        if isinstance(item, dict) and item.get("topic") not in ("Other", "Unassigned", "Unknown")
    ]
    fading = [
        item.get("topic")
        for item in evolution.get("fading", [])
        if isinstance(item, dict) and item.get("topic") not in ("Other", "Unassigned", "Unknown")
    ]
    emerging = [
        item.get("topic")
        for item in evolution.get("emerging", [])
        if isinstance(item, dict) and item.get("topic") not in ("Other", "Unassigned", "Unknown")
    ]
    rabbit_holes = behavior.get("rabbit_holes", [])
    time_of_day = behavior.get("time_of_day", {})

    # Check for external LLM API keys if configured
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if (openai_key or gemini_key) and total_events > 0:
        try:
            return _call_external_llm(question, chat_history, events, analysis, openai_key, gemini_key)
        except Exception:
            pass

    return _synthesize_local_response(
        q_lower=q_lower,
        question=question,
        events=assignments,
        analysis=analysis,
        topic_counts=topic_counts,
        top_topics=top_topics,
        dominant_topic=dominant_topic,
        rising=rising,
        fading=fading,
        emerging=emerging,
        rabbit_holes=rabbit_holes,
        time_of_day=time_of_day,
    )


def _call_external_llm(
    question: str,
    chat_history: list[dict[str, str]] | None,
    events: list[dict[str, Any]],
    analysis: dict[str, Any],
    openai_key: str | None,
    gemini_key: str | None,
) -> dict[str, Any]:
    import httpx

    top_topics = analysis.get("top_topics", [])[:8]
    evolution = analysis.get("evolution", {})
    recent_sample = [
        f"- {e.get('title')} ({e.get('topic')}, {e.get('timestamp')})"
        for e in events[-20:]
    ]

    context_prompt = (
        f"You are Drifter AI, an intelligent memory and attention analyst for personal browsing/listening history.\n"
        f"Total events analyzed: {len(events)}.\n"
        f"Top topics: {[t.get('topic') for t in top_topics]}.\n"
        f"Rising topics: {[r.get('topic') for r in evolution.get('rising', [])]}.\n"
        f"Fading topics: {[f.get('topic') for f in evolution.get('fading', [])]}.\n"
        f"Recent 20 traces:\n" + "\n".join(recent_sample) + "\n\n"
        f"Answer the user's question accurately, concisely, and insightfully based on their data."
    )

    if gemini_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": context_prompt + "\n\nUser Question: " + question}]}
            ]
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                reply = data["candidates"][0]["content"]["parts"][0]["text"]
                return {
                    "reply": reply,
                    "suggested_queries": [
                        "What is my fastest growing interest?",
                        "Show me my late night rabbit holes",
                        "When is my attention most focused?",
                    ],
                    "referenced_topics": [t.get("topic") for t in top_topics[:3]],
                }

    if openai_key:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {openai_key}"}
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": context_prompt},
                {"role": "user", "content": question},
            ],
            "max_tokens": 400,
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                reply = data["choices"][0]["message"]["content"]
                return {
                    "reply": reply,
                    "suggested_queries": [
                        "What was my biggest obsession this year?",
                        "What genres dominate my mornings?",
                        "What am I likely to explore next?",
                    ],
                    "referenced_topics": [t.get("topic") for t in top_topics[:3]],
                }

    raise RuntimeError("External LLM not available")


def _synthesize_local_response(
    q_lower: str,
    question: str,
    events: list[dict[str, Any]],
    analysis: dict[str, Any],
    topic_counts: Counter,
    top_topics: list[str],
    dominant_topic: str,
    rising: list[str],
    fading: list[str],
    emerging: list[str],
    rabbit_holes: list[Any],
    time_of_day: dict[str, Any],
) -> dict[str, Any]:
    total = len(events)
    if total == 0:
        return {
            "reply": (
                "I don't see any recorded history traces yet.\n\n"
                "Once you connect your YouTube or Spotify accounts, or upload an archive file, "
                "I will analyze your interest clusters, drift velocity, and listening patterns!"
            ),
            "suggested_queries": [
                "How do I import history?",
                "What can Drifter tell me?",
            ],
            "referenced_topics": [],
        }

    # ------------------------------------------------------------
    # 1. BIGGEST OBSESSION / TOP INTEREST / CENTER OF GRAVITY
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["biggest obsession", "obsession", "obsessed", "favorite", "main interest", "top topic", "center of gravity", "most watched", "most played"]):
        dom_count = topic_counts.get(dominant_topic, 0)
        dom_pct = round((dom_count / max(total, 1)) * 100)

        # Get matching top traces
        matching_titles = [
            e.get("title", "")
            for e in events
            if e.get("topic") == dominant_topic and e.get("title")
        ]

        reply = (
            f"Your absolute biggest obsession is **{dominant_topic}**!\n\n"
            f"• **Dominance**: Accounts for **{dom_count}** of your {total} traces (**{dom_pct}%** of all recorded activity).\n"
        )
        if matching_titles:
            sample = list(dict.fromkeys(matching_titles))[:3]
            reply += f"• **Key Highlights**:\n"
            for t in sample:
                reply += f"  - *{t}*\n"

        if len(top_topics) > 1:
            reply += f"\nYour runner-up curiosities are **{', '.join(top_topics[1:4])}**."

        return {
            "reply": reply,
            "suggested_queries": [
                "What topics are rising right now?",
                "Show my late-night rabbit holes",
                "Predict what I'll explore next",
            ],
            "referenced_topics": top_topics[:3],
        }

    # ------------------------------------------------------------
    # 2. LATE-NIGHT / RABBIT HOLES / BINGING
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["rabbit hole", "binge", "deep dive", "late night", "midnight", "night"]):
        # Find night events (11 PM - 5 AM)
        night_events = []
        for e in events:
            ts = _parse_timestamp(e.get("timestamp"))
            if ts and (ts.hour >= 23 or ts.hour < 5):
                night_events.append(e)

        night_topics = Counter(e.get("topic", "Other") for e in night_events if e.get("topic") not in ("Other", "Unassigned", "Unknown"))
        top_night = [t for t, _ in night_topics.most_common(3)]

        if rabbit_holes:
            first_hole = rabbit_holes[0]
            hole_topic = first_hole.get("topic") or first_hole.get("dominant_topic") or first_hole.get("name") or "various topics"
            count = first_hole.get("event_count") or first_hole.get("count") or "multiple"
            duration = f" spanning ~{round(float(first_hole.get('duration_minutes', 30)))}m" if first_hole.get("duration_minutes") else ""
            reply = (
                f"You have fallen into **{len(rabbit_holes)} distinct rabbit holes** in your recorded history.\n\n"
                f"• **Deepest Session**: Centered on **{hole_topic}** with **{count} consecutive events**{duration}.\n"
                + (f"• **Late-Night Traces**: You logged **{len(night_events)} traces** between 11 PM and 5 AM, favoring *{', '.join(top_night)}*." if night_events else "")
            )
        elif night_events:
            reply = (
                f"You have **{len(night_events)} late-night traces** logged between 11:00 PM and 5:00 AM.\n\n"
                f"• **Nocturnal Focus**: Your midnight curiosity centers mostly on **{top_night[0] if top_night else dominant_topic}**"
                + (f" and *{top_night[1]}*" if len(top_night) > 1 else "")
                + f".\n• While you explore at night, your sessions are focused rather than sprawling multi-hour loops."
            )
        else:
            reply = (
                f"Your activity is well-balanced throughout standard daytime hours, with minimal nocturnal binge sessions. "
                f"Your attention remains steady around **{dominant_topic}**."
            )

        return {
            "reply": reply,
            "suggested_queries": [
                "What was my biggest obsession?",
                "What topics are rising right now?",
                "What hours am I most active?",
            ],
            "referenced_topics": (top_night or top_topics)[:2],
        }

    # ------------------------------------------------------------
    # 3. RISING / EMERGING / NEW DIRECTIONS
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["rising", "growing", "new direction", "emerging", "spike", "trending", "gaining"]):
        candidates = rising or emerging or [t for t in top_topics if t != dominant_topic]

        if candidates:
            fastest = candidates[0]
            reply = (
                f"Your fastest growing curiosity right now is **{fastest}**!\n\n"
            )
            if emerging and fastest in emerging:
                reply += f"• **Status**: Newly emerging interest cluster detected in your recent activity.\n"
            else:
                reply += f"• **Status**: Accelerating velocity in your recent timeline.\n"

            if len(candidates) > 1:
                reply += f"• **Other Rising Directions**: {', '.join(f'**{c}**' for c in candidates[1:4])}.\n"

            reply += f"\nYour attention is actively pivoting toward these themes compared to previous periods."
        else:
            reply = f"Your attention distribution is currently focused around **{dominant_topic}**, with steady recurrence across recent history."

        return {
            "reply": reply,
            "suggested_queries": [
                "What interests am I losing touch with?",
                "Predict what I will explore next",
                "What was my biggest obsession?",
            ],
            "referenced_topics": (candidates or top_topics)[:3],
        }

    # ------------------------------------------------------------
    # 4. FADING / DECLINING INTERESTS
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["fading", "losing", "declining", "drop", "less", "stopped", "cooled"]):
        if fading:
            reply = (
                f"You are spending noticeably less time with **{fading[0]}** compared to earlier periods.\n\n"
                + (f"• **Other Cool-Down Areas**: {', '.join(f'*{f}*' for f in fading[1:3])}.\n" if len(fading) > 1 else "")
                + "This represents a natural drift as your attention makes room for newer curiosities."
            )
        else:
            reply = "None of your core interests show a steep decline yet—your exploration profile is maintaining continuous engagement across discovered topics."

        return {
            "reply": reply,
            "suggested_queries": [
                "What topics are rising right now?",
                "What was my biggest obsession?",
                "What is my drift velocity?",
            ],
            "referenced_topics": fading[:3] or top_topics[:2],
        }

    # ------------------------------------------------------------
    # 5. PREDICTIONS / FUTURE HORIZON
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["predict", "next", "future", "what will i", "recommend", "forecast", "horizon"]):
        from app.prediction.next_interest import predict_next_interests
        preds_data = predict_next_interests(assignments=events, analysis=analysis)
        preds = preds_data.get("predictions", [])
        if preds:
            top_p = preds[0]
            reply = (
                f"Based on your Markov transition graph and momentum velocity, your highest-probability next curiosity is **{top_p['topic']}** "
                f"({top_p['confidence']}% confidence · {top_p['horizon']}).\n\n"
                f"**Why**: {top_p['rationale']}\n\n"
                f"**Suggested Starter Queries**:\n"
            )
            for seed in top_p.get("seed_keywords", [])[:3]:
                reply += f"• *{seed}*\n"
            if len(preds) > 1:
                reply += f"\nSecondary projected path: **{preds[1]['topic']}** ({preds[1]['confidence']}% confidence)."
            return {
                "reply": reply,
                "suggested_queries": [
                    f"How has {top_p['topic']} trended recently?",
                    "What are my rising interests?",
                    "What was my biggest obsession?",
                ],
                "referenced_topics": [p["topic"] for p in preds[:3]],
            }

    # ------------------------------------------------------------
    # 6. DRIFT / EVOLUTION / CHANGE OVER TIME
    # ------------------------------------------------------------
    if any(k in q_lower for k in ["drift", "velocity", "trajectory", "change over time", "evolution", "shift", "movement"]):
        monthly_drift = evolution.get("monthly_drift", {})
        drift_vals = [float(v) for v in monthly_drift.values() if isinstance(v, (int, float))]
        latest_val = drift_vals[-1] if drift_vals else analysis.get("overview", {}).get("current_drift", 0.0)

        speed = "rapid acceleration" if latest_val > 0.5 else ("active shifting" if latest_val > 0.25 else "thematic stability")
        reply = (
            f"Your attention drift is currently showing **{speed}** with a measured drift score of **{latest_val:.3f}**.\n\n"
            f"• **Center of Gravity**: {dominant_topic}\n"
            f"• **Rising**: {', '.join(rising[:2]) if rising else 'Stable focus'}\n"
            f"• **Fading**: {', '.join(fading[:2]) if fading else 'No steep drop-offs'}\n\n"
            f"This score measures how much your attention topology has migrated away from your early baseline."
        )
        return {
            "reply": reply,
            "suggested_queries": [
                "What was my biggest obsession?",
                "What topics are rising right now?",
                "Predict what I will explore next",
            ],
            "referenced_topics": (rising + fading)[:2] or top_topics[:2],
        }

    # ------------------------------------------------------------
    # 7. SPECIFIC SEARCH IN EVENT TITLES / ARTISTS / TOPICS
    # ------------------------------------------------------------
    tokens = [w for w in re.findall(r"\b\w{3,}\b", q_lower) if w not in ["what", "when", "where", "which", "about", "show", "tell", "have", "been", "with", "this", "that", "does", "your", "from"]]
    matched_events = []
    if tokens:
        for ev in reversed(events):
            text = f"{ev.get('title', '')} {ev.get('artist', '')} {ev.get('topic', '')}".lower()
            if any(token in text for token in tokens):
                matched_events.append(ev)
                if len(matched_events) >= 5:
                    break

    if matched_events:
        reply = f"I found **{len(matched_events)} matching traces** in your history:\n\n"
        for ev in matched_events[:4]:
            t = ev.get("title", "Untitled activity")
            top = ev.get("topic", "General")
            ts = str(ev.get("timestamp", ""))[:10]
            reply += f"• **{t}** — *{top}* ({ts})\n"

        matched_topics = list(set(e.get("topic") for e in matched_events if e.get("topic") not in ("Other", "Unassigned", "Unknown")))
        return {
            "reply": reply,
            "suggested_queries": [
                f"What is my biggest obsession?",
                "What topics are rising right now?",
                "Predict what I will explore next",
            ],
            "referenced_topics": matched_topics[:3] or top_topics[:2],
        }

    # ------------------------------------------------------------
    # DEFAULT COMPREHENSIVE OVERVIEW
    # ------------------------------------------------------------
    dom_count = topic_counts.get(dominant_topic, 0)
    dom_pct = round((dom_count / max(total, 1)) * 100)

    reply = (
        f"Across your **{total:,} recorded traces**, your primary attention anchor is **{dominant_topic}** ({dom_pct}% of activity).\n\n"
        + (f"• **Active Topic Clusters**: {', '.join(f'**{t}**' for t in top_topics[:4])}\n" if len(top_topics) > 1 else "")
        + (f"• **Emerging / Rising**: {', '.join(rising or emerging)}\n" if (rising or emerging) else "")
        + f"• **Peak Activity**: Most active during **{_get_peak_period(time_of_day)}**.\n\n"
        f"Ask me about any specific topic, rabbit hole, or curiosity shift!"
    )
    return {
        "reply": reply,
        "suggested_queries": [
            "What was my biggest obsession?",
            "Show my late-night rabbit holes",
            "What topics are rising right now?",
        ],
        "referenced_topics": top_topics[:3],
    }


def _get_peak_period(time_of_day: dict[str, Any]) -> str:
    if not time_of_day:
        return "evening"
    best_period = "evening"
    best_val = -1
    for p, v in time_of_day.items():
        val = _extract_num(v)
        if val > best_val:
            best_val = val
            best_period = p
    return best_period.title()


def _extract_num(v: Any) -> int:
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict):
        return sum(_extract_num(x) for x in v.values())
    return 1

