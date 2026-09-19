import sys
from datetime import datetime, timedelta

from app.ai.history_chat import answer_history_chat
from app.reports.year_in_drift import generate_year_in_drift_report
from app.prediction.next_interest import predict_next_interests
from app.analytics.correlation import analyze_cross_platform_correlation
from app.reports.interest_dna import generate_interest_dna
from app.services.analytics_service import build_interest_analysis

# Synthetic multi-source test events
base_time = datetime(2025, 1, 10, 14, 0, 0)
events = []

# YouTube events
for i in range(30):
    t = base_time + timedelta(hours=i * 4)
    topic = "Machine Learning" if i < 15 else "Distributed Systems"
    events.append({
        "id": i + 1,
        "title": f"Video #{i+1} on {topic}",
        "topic": topic,
        "source": "youtube",
        "timestamp": t.isoformat(),
    })

# Spotify events
for i in range(25):
    t = base_time + timedelta(hours=i * 4, minutes=15)
    genre = "Ambient Electronics" if i < 12 else "Phonk & Focus Beats"
    events.append({
        "id": 100 + i,
        "title": f"Track #{i+1} by Artist {i%5}",
        "topic": genre,
        "artist": f"Artist {i%5}",
        "source": "spotify",
        "timestamp": t.isoformat(),
    })

print(f"Synthesized {len(events)} events.")

# Run analysis
analysis = build_interest_analysis(events)
print("build_interest_analysis passed.")

# 1. Test Chat
chat_res = answer_history_chat(
    question="What have I been learning about lately?",
    chat_history=[],
    events=events,
    analysis=analysis,
)
assert "reply" in chat_res and len(chat_res["reply"]) > 10, "Chat reply failed"
print("✓ Feature 1 (AI Chat): Passed. Sample reply:", chat_res["reply"][:80])

# 2. Test Wrapped
wrapped_res = generate_year_in_drift_report(events=events, analysis=analysis)
assert "slides" in wrapped_res and len(wrapped_res["slides"]) >= 4, "Wrapped slides failed"
print("✓ Feature 2 (Year in Drift): Passed. Slides count:", len(wrapped_res["slides"]))

# 3. Test Predictions
pred_res = predict_next_interests(assignments=events, analysis=analysis)
assert "predictions" in pred_res, "Predictions missing"
print("✓ Feature 3 (Predictions): Passed. Candidate count:", len(pred_res["predictions"]))

# 4. Test Correlation
corr_res = analyze_cross_platform_correlation(assignments=events)
assert "synergy_score" in corr_res and "hourly_distribution" in corr_res, "Correlation failed"
print("✓ Feature 4 (Correlation): Passed. Synergy score:", corr_res["synergy_score"], "Resonance:", corr_res.get("resonance_tier"))

# 5. Test Interest DNA
dna_res = generate_interest_dna(assignments=events, analysis=analysis)
assert "dna_id" in dna_res and "traits" in dna_res, "DNA generation failed"
print("✓ Feature 5 (Interest DNA): Passed. Archetype:", dna_res["archetype"], "ID:", dna_res["dna_id"])
print("\nAll 5 feature backends verified successfully!")
