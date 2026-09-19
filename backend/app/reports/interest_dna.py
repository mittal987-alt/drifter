from collections import Counter
from datetime import datetime
import hashlib
import math
from typing import Any


def _parse_ts(ts: Any) -> datetime | None:
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def generate_interest_dna(
    assignments: list[dict[str, Any]],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate the user's personal 'Interest DNA' profile with normalized 0-100 metrics,
    archetype title, fingerprint hash, and visual signature tokens for export.
    """
    total = len(assignments)
    if total == 0:
        return {
            "dna_id": "DRIFT-0000-INIT",
            "archetype": "The Blank Canvas",
            "subtitle": "Awaiting initial digital traces to reveal attention geometry.",
            "metrics": {
                "curiosity_entropy": 50,
                "drift_velocity": 50,
                "deep_dive_index": 50,
                "nocturnal_quotient": 50,
            },
            "primary_markers": ["Exploration", "Curiosity", "Discovery"],
            "palette": ["#75d6c2", "#a7b8ff", "#f2b56b"],
        }

    # 1. Topic Entropy (Breadth)
    topic_counts = Counter(e.get("topic", "Other") for e in assignments)
    shannon_entropy = 0.0
    for count in topic_counts.values():
        p = count / total
        shannon_entropy -= p * math.log2(p)
    max_entropy = math.log2(max(len(topic_counts), 2))
    entropy_score = min(98, max(20, int((shannon_entropy / max(max_entropy, 0.001)) * 100)))

    # 2. Drift Velocity
    evolution = analysis.get("evolution", {})
    monthly_drift = evolution.get("monthly_drift", {})
    drift_vals = [float(v) for v in monthly_drift.values() if isinstance(v, (int, float))]
    avg_drift = sum(drift_vals) / len(drift_vals) if drift_vals else 0.25
    drift_score = min(98, max(22, int(avg_drift * 120)))

    # 3. Deep Dive Index
    behavior = analysis.get("behavior", {})
    rabbit_holes = behavior.get("rabbit_holes", [])
    rabbit_hole_events = sum(
        h.get("event_count", 4) if isinstance(h, dict) else 4
        for h in rabbit_holes
    )
    deep_dive_score = min(98, max(25, int((rabbit_hole_events / max(total, 1)) * 220 + 35)))

    # 4. Nocturnal Quotient
    night_events = 0
    for e in assignments:
        ts = _parse_ts(e.get("timestamp"))
        if ts and (ts.hour >= 23 or ts.hour < 5):
            night_events += 1
    nocturnal_score = min(98, max(15, int((night_events / max(total, 1)) * 250 + 15)))

    # Generate deterministic fingerprint DNA ID
    raw_str = f"{total}-{entropy_score}-{drift_score}-{deep_dive_score}-{nocturnal_score}"
    dna_hash = hashlib.sha256(raw_str.encode()).hexdigest().upper()
    dna_id = f"DRIFT-{dna_hash[:4]}-{dna_hash[4:8]}"

    # Archetype determination & trait profiling
    archetype_profiles = {
        "The Midnight Architect": {
            "superpower": "Extreme late-night conceptual clarity and structural systems thinking.",
            "vulnerability": "Risk of exhausting circadian rhythms on hyper-focused rabbit holes.",
            "peak_hours": "11:00 PM – 4:00 AM",
            "complementary": "The Kinetic Nomad",
        },
        "The Quantum Polymath": {
            "superpower": "Effortless cross-pollination across radically distinct domains.",
            "vulnerability": "Context-switching overload before extracting vertical domain mastery.",
            "peak_hours": "2:00 PM – 8:00 PM",
            "complementary": "The Recursive Specialist",
        },
        "The Recursive Specialist": {
            "superpower": "Unflinching single-topic immersion straight to ground-truth primitives.",
            "vulnerability": "Tunnel vision ignoring peripheral technological breakthroughs.",
            "peak_hours": "9:00 AM – 3:00 PM",
            "complementary": "The Quantum Polymath",
        },
        "The Kinetic Nomad": {
            "superpower": "Rapid environmental scanning and lightning curiosity pivot speed.",
            "vulnerability": "Difficulty sustaining multi-month single-topic retention.",
            "peak_hours": "5:00 PM – 11:00 PM",
            "complementary": "The Midnight Architect",
        },
        "The Harmonic Synthesizer": {
            "superpower": "Calibrated balance between deep analysis, broad scanning, and steady cadence.",
            "vulnerability": "May hesitate to plunge into chaotic, radical paradigm shifts.",
            "peak_hours": "10:00 AM – 6:00 PM",
            "complementary": "The Quantum Polymath",
        },
    }

    if nocturnal_score >= 65 and deep_dive_score >= 60:
        archetype = "The Midnight Architect"
        subtitle = "Master of nocturnal deep dives and intricate structural curiosities."
    elif entropy_score >= 70 and drift_score >= 60:
        archetype = "The Quantum Polymath"
        subtitle = "Traverses across unrelated intellectual galaxies with effortless speed."
    elif deep_dive_score >= 70:
        archetype = "The Recursive Specialist"
        subtitle = "Drills straight through the surface down to the foundational primitives."
    elif drift_score >= 70:
        archetype = "The Kinetic Nomad"
        subtitle = "Constantly reinventing attention horizons; never captive to one lane."
    else:
        archetype = "The Harmonic Synthesizer"
        subtitle = "Maintains a balanced equilibrium between depth, breadth, and exploration."

    traits = archetype_profiles.get(archetype, archetype_profiles["The Harmonic Synthesizer"])

    top_markers = [t for t, _ in topic_counts.most_common(3)]
    while len(top_markers) < 3:
        top_markers.append("Curiosity")

    return {
        "dna_id": dna_id,
        "archetype": archetype,
        "subtitle": subtitle,
        "total_events": total,
        "metrics": {
            "curiosity_entropy": entropy_score,
            "drift_velocity": drift_score,
            "deep_dive_index": deep_dive_score,
            "nocturnal_quotient": nocturnal_score,
        },
        "traits": traits,
        "primary_markers": top_markers,
        "palette": ["#f2b56b", "#75d6c2", "#a7b8ff"],
        "generated_at": datetime.utcnow().strftime("%Y.%m.%d"),
    }
