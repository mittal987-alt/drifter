from collections import Counter
from datetime import datetime
import os
import re
from typing import Any


def _parse_timestamp(ts: Any) -> datetime | None:
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def answer_history_chat(
    question: str,
    chat_history: list[dict[str, str]] | None,
    events: list[dict[str, Any]],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Synthesize an intelligent response to natural language queries about the user's
    history, topic shifts, rabbit holes, and listening/watching habits.
    """
    q_lower = question.lower().strip()
    total_events = len(events)

    top_topics = []
    assignments = analysis.get("assignments") or events
    if assignments:
        counts = Counter(e.get("topic", "Other") for e in assignments)
        top_topics = [t for t, _ in counts.most_common(5)]

    evolution = analysis.get("evolution", {})
    behavior = analysis.get("behavior", {})
    rising = [item.get("topic") for item in evolution.get("rising", []) if isinstance(item, dict)]
    fading = [item.get("topic") for item in evolution.get("fading", []) if isinstance(item, dict)]
    emerging = [item.get("topic") for item in evolution.get("emerging", []) if isinstance(item, dict)]
    rabbit_holes = behavior.get("rabbit_holes", [])
    time_of_day = behavior.get("time_of_day", {})

    # Check for external LLM API keys if configured
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if (openai_key or gemini_key) and total_events > 0:
        try:
            return _call_external_llm(question, chat_history, events, analysis, openai_key, gemini_key)
        except Exception:
            # Fall back to local synthesis engine
            pass

    return _synthesize_local_response(
        q_lower=q_lower,
        question=question,
        events=events,
        analysis=analysis,
        top_topics=top_topics,
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
    top_topics: list[str],
    rising: list[str],
    fading: list[str],
    emerging: list[str],
    rabbit_holes: list[Any],
    time_of_day: dict[str, Any],
) -> dict[str, Any]:
    total = len(events)
    if total == 0:
        return {
            "reply": "I don't see any imported history events yet. Once you connect YouTube or Spotify, or import an archive, I can analyze every obsession, drift, and rabbit hole for you!",
            "suggested_queries": [
                "How do I import history?",
                "What can Drifter tell me?",
            ],
            "referenced_topics": [],
        }

    # 1. Rabbit holes / binging query
    if any(k in q_lower for k in ["rabbit hole", "binge", "deep dive", "late night", "midnight", "obsess"]):
        if rabbit_holes:
            first_hole = rabbit_holes[0]
            hole_topic = first_hole.get("topic") or first_hole.get("name") or "various topics"
            count = first_hole.get("event_count") or first_hole.get("count") or "multiple"
            reply = (
                f"You have fallen into **{len(rabbit_holes)} distinct rabbit holes** in this period. "
                f"Your most intense exploration loop centered on **{hole_topic}** with over {count} consecutive events in a tight session window. "
                f"Late-night activity shows high curiosity spikes during the **{_get_peak_period(time_of_day)}** hours."
            )
        else:
            reply = (
                f"Your consumption is relatively dispersed across your top topics ({', '.join(top_topics[:3]) if top_topics else 'various'}), "
                f"meaning you browse across themes rather than getting stuck in long single-track rabbit holes."
            )
        return {
            "reply": reply,
            "suggested_queries": [
                "What topics are rising right now?",
                "Which interests are fading away?",
                "What are my active hours?",
            ],
            "referenced_topics": top_topics[:2],
        }

    # 2. Rising / emerging / growing interests
    if any(k in q_lower for k in ["rising", "growing", "new", "emerging", "spike", "gaining", "trending"]):
        if rising or emerging:
            items = rising or emerging
            reply = (
                f"Your fastest accelerating interest right now is **{items[0]}**! "
                + (f"Other notable rising topics include **{', '.join(items[1:4])}**. " if len(items) > 1 else "")
                + f"Over the recent period, this cluster has seen a marked uptick in watch and listen frequency."
            )
        else:
            dominant = top_topics[0] if top_topics else "your primary topic"
            reply = f"Your attention distribution is currently stable around **{dominant}**, with consistent engagement across historical periods."
        return {
            "reply": reply,
            "suggested_queries": [
                "What interests am I losing touch with?",
                "Predict what I will explore next",
                "Show my topic transition patterns",
            ],
            "referenced_topics": (rising + emerging)[:3] or top_topics[:2],
        }

    # 3. Fading / declining interests
    if any(k in q_lower for k in ["fading", "losing", "declining", "drop", "less", "stopped"]):
        if fading:
            reply = (
                f"You are spending noticeably less time with **{fading[0]}** compared to prior months. "
                + (f"Other fading areas include **{', '.join(fading[1:3])}**. " if len(fading) > 1 else "")
                + "This is a classic signature of drift: attention shifting toward newer curiosities."
            )
        else:
            reply = "None of your primary topics show a severe decline yet—your core interests are still maintaining steady recurrence."
        return {
            "reply": reply,
            "suggested_queries": [
                "What are my rising interests?",
                "Show my dominant center of gravity",
                "What's my drift score?",
            ],
            "referenced_topics": fading[:3] or top_topics[:2],
        }

    # 4. Weekday vs Weekend Comparison
    if any(k in q_lower for k in ["weekend", "weekday", "saturday", "sunday", "workday", "days of week", "day of week"]):
        day_of_week = behavior.get("day_of_week", {})
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        weekends = ["Saturday", "Sunday"]
        weekday_counts = Counter()
        weekend_counts = Counter()
        for d, topics in day_of_week.items():
            target = weekend_counts if d in weekends else weekday_counts
            if isinstance(topics, dict):
                for top, cnt in topics.items():
                    if top != "Other":
                        target[top] += cnt if isinstance(cnt, int) else 1

        total_wd = sum(weekday_counts.values())
        total_we = sum(weekend_counts.values())
        top_wd = weekday_counts.most_common(2)
        top_we = weekend_counts.most_common(2)
        wd_str = f"**{top_wd[0][0]}**" if top_wd else "focused learning"
        we_str = f"**{top_we[0][0]}**" if top_we else "exploratory media"
        pct_we = round((total_we / max(total_wd + total_we, 1)) * 100)
        reply = (
            f"Your attention shifts distinctly between the workweek and the weekend:\n\n"
            f"• **Weekdays ({total_wd:,} traces)**: Your primary concentration gravitates towards {wd_str}"
            + (f" and *{top_wd[1][0]}*." if len(top_wd) > 1 else ".")
            + f"\n• **Weekends ({total_we:,} traces)**: Your curiosity pivots towards {we_str}"
            + (f" and *{top_we[1][0]}*." if len(top_we) > 1 else ".")
            + f"\n\nYou log approximately {pct_we}% of your overall activity on Saturdays and Sundays."
        )
        return {
            "reply": reply,
            "suggested_queries": [
                "What was my biggest rabbit hole?",
                "What hours am I most active?",
                "Predict what I will explore next",
            ],
            "referenced_topics": [t[0] for t in (top_wd + top_we)[:3]],
        }

    # 5. Cross-Platform / Audio vs Video Synergy
    if any(k in q_lower for k in ["spotify", "youtube", "cross platform", "audio", "music vs video", "listening vs watching", "synergy"]):
        yt_count = sum(1 for e in events if str(e.get("source", "")).lower() == "youtube")
        sp_count = sum(1 for e in events if str(e.get("source", "")).lower() == "spotify")
        if yt_count > 0 and sp_count > 0:
            reply = (
                f"Your digital traces span both **YouTube** ({yt_count:,} events) and **Spotify** ({sp_count:,} events).\n\n"
                f"• **Video Exploration**: Drives your visual and educational deep-dives, centering on {top_topics[0] if top_topics else 'various topics'}.\n"
                f"• **Audio Stream**: Sustains rhythmic background focus and late-night auditory immersion.\n"
                f"• **Synergy**: The two platforms frequently overlap in complementary windows, reflecting synchronized multi-modal attention."
            )
        elif sp_count > 0:
            reply = f"Your logged traces currently center on **Spotify** ({sp_count:,} tracks recorded), highlighting your sonic obsessions and artist fidelity."
        else:
            reply = f"Your traces are currently driven by **YouTube** ({yt_count:,} video traces). Connect Spotify via OAuth to discover cross-platform video and audio synergies!"
        return {
            "reply": reply,
            "suggested_queries": [
                "Show my late night rabbit holes",
                "What topics are rising right now?",
                "How do my weekdays compare to weekends?",
            ],
            "referenced_topics": top_topics[:2],
        }

    # 6. Future Predictions & Recommendations
    if any(k in q_lower for k in ["predict", "next", "future", "what will i explore", "recommend", "horizon", "forecast"]):
        from app.prediction.next_interest import predict_next_interests
        preds_data = predict_next_interests(assignments=events, analysis=analysis)
        preds = preds_data.get("predictions", [])
        if preds:
            top_p = preds[0]
            reply = (
                f"Based on your Markov transition pathways and interest momentum, your most probable next obsession is **{top_p['topic']}** "
                f"({top_p['confidence']}% projected confidence, {top_p['horizon'].lower()}).\n\n"
                f"**Rationale**: {top_p['rationale']}\n\n"
                f"Recommended starter seeds:\n"
            )
            for seed in top_p.get("seed_keywords", [])[:3]:
                reply += f"• *{seed}*\n"
            if len(preds) > 1:
                reply += f"\nSecondary horizon prediction: **{preds[1]['topic']}** ({preds[1]['confidence']}% confidence)."
            return {
                "reply": reply,
                "suggested_queries": [
                    f"How has {top_p['topic']} trended recently?",
                    "What are my rising interests?",
                    "Show my topic transitions",
                ],
                "referenced_topics": [p["topic"] for p in preds[:3]],
            }

    # 7. Drift Velocity & Timeline Trajectory
    if any(k in q_lower for k in ["drift", "velocity", "trajectory", "change over time", "evolution", "shift"]):
        monthly_drift = evolution.get("monthly_drift", {})
        if monthly_drift:
            months = list(monthly_drift.keys())
            latest_month = months[-1]
            latest_val = float(monthly_drift[latest_month])
            speed = "rapid acceleration" if latest_val > 0.4 else ("moderate steady transition" if latest_val > 0.2 else "high thematic stability")
            reply = (
                f"Your attention drift is in **{speed}** with a monthly drift score of **{latest_val:.3f}** in {latest_month}.\n\n"
                f"• **Rising curiosities**: {', '.join(rising[:3]) if rising else 'Thematic stability'}\n"
                f"• **Fading themes**: {', '.join(fading[:3]) if fading else 'No steep declines'}\n\n"
                f"Your attention horizon has evolved smoothly across historical periods, opening new curiosity branches."
            )
        else:
            reply = f"Your attention velocity is currently measured across {len(top_topics)} active clusters, maintaining a balanced interest topology."
        return {
            "reply": reply,
            "suggested_queries": [
                "What is rising right now?",
                "Which interests are fading?",
                "Predict what I will explore next",
            ],
            "referenced_topics": (rising + fading)[:3] or top_topics[:2],
        }

    # 8. Time / Hours / Routine
    if any(k in q_lower for k in ["time", "hour", "morning", "night", "when", "day", "routine", "schedule"]):
        peak = _get_peak_period(time_of_day)
        reply = (
            f"Your curiosity is most active during the **{peak}**. "
            f"Here is how your attention splits across the day:\n"
        )
        for period, count in sorted(time_of_day.items(), key=lambda x: -_extract_num(x[1]))[:4]:
            reply += f"- **{period.title()}**: {count if isinstance(count, int) else 'Active'}\n"
        return {
            "reply": reply,
            "suggested_queries": [
                "What was my biggest rabbit hole?",
                "What is my attention archetype?",
                "Show my YouTube vs Spotify habits",
            ],
            "referenced_topics": top_topics[:2],
        }

    # 5. Specific search or topic query in events
    matched_events = []
    tokens = [w for w in re.findall(r"\b\w{3,}\b", q_lower) if w not in ["what", "when", "where", "which", "about", "show", "tell", "have", "been", "with", "this", "that"]]
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
            t = ev.get("title", "Untitled")
            top = ev.get("topic", "General")
            date_str = str(ev.get("timestamp", ""))[:10]
            reply += f"• **{t}** — *{top}* ({date_str})\n"
        return {
            "reply": reply,
            "suggested_queries": [
                f"How has {matched_events[0].get('topic')} evolved over time?",
                "What are my all-time top topics?",
                "Show my interest predictions",
            ],
            "referenced_topics": list(set(e.get("topic") for e in matched_events if e.get("topic"))),
        }

    # Default summary answer
    dominant = top_topics[0] if top_topics else "Various interests"
    reply = (
        f"Across your **{total:,} recorded traces**, your primary center of gravity is **{dominant}**, "
        + (f"followed closely by **{', '.join(top_topics[1:4])}**. " if len(top_topics) > 1 else "")
        + f"Your interest graph indicates an evolving attention network with {len(top_topics)} distinct topic neighborhoods."
    )
    return {
        "reply": reply,
        "suggested_queries": [
            "What topics are rising right now?",
            "What was my deepest rabbit hole?",
            "Predict what I will drift into next",
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
    return best_period


def _extract_num(v: Any) -> int:
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict):
        return sum(_extract_num(x) for x in v.values())
    return 1
