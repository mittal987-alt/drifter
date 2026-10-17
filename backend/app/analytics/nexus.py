from collections import Counter
from datetime import datetime
import hashlib
import math
import random
from typing import Any


def _slugify(text: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in text.lower()).strip("_")


# Domain ontology mapping for high-serendipity bridge synthesis
DOMAIN_PATTERNS: dict[str, dict[str, Any]] = {
    "music": {
        "keywords": ["music", "spotify", "techno", "ambient", "rock", "jazz", "lofi", "soundtrack", "audio", "song", "album"],
        "descriptor": "Acoustic & Sonic Aesthetics",
    },
    "coding": {
        "keywords": ["code", "coding", "python", "javascript", "typescript", "rust", "github", "react", "backend", "frontend", "programming", "software", "dev"],
        "descriptor": "Algorithmic Architecture & Systems",
    },
    "gaming": {
        "keywords": ["gaming", "game", "steam", "rpg", "fps", "playstation", "nintendo", "xbox", "speedrun", "esports"],
        "descriptor": "Interactive Mechanics & Worldbuilding",
    },
    "science": {
        "keywords": ["physics", "quantum", "astronomy", "space", "biology", "neuroscience", "math", "chemistry", "universe", "cosmos"],
        "descriptor": "Empirical Dynamics & Natural Laws",
    },
    "philosophy": {
        "keywords": ["philosophy", "stoicism", "ethics", "epistemology", "mind", "consciousness", "existential", "psychology", "thought"],
        "descriptor": "Cognitive Models & Ontological Inquiry",
    },
    "video": {
        "keywords": ["film", "cinema", "documentary", "netflix", "animation", "anime", "video", "director", "cinematography"],
        "descriptor": "Narrative Synthesis & Visual Form",
    },
    "ai": {
        "keywords": ["ai", "machine learning", "llm", "neural", "deep learning", "gpt", "transformer", "diffusion", "vision"],
        "descriptor": "Synthetic Cognition & Emergent Vectors",
    },
}


def _classify_topic(topic: str) -> str:
    topic_lower = topic.lower()
    for domain, meta in DOMAIN_PATTERNS.items():
        if any(kw in topic_lower for kw in meta["keywords"]):
            return domain
    return "general"


def _generate_bridge_metadata(topic_a: str, topic_b: str, seed_num: int) -> dict[str, Any]:
    """Generate rich, deterministic cross-domain synthesis for any two topics."""
    d_a = _classify_topic(topic_a)
    d_b = _classify_topic(topic_b)

    # Use hash of sorted topics for deterministic variation
    pair_key = "-".join(sorted([topic_a.lower(), topic_b.lower()]))
    h = int(hashlib.md5(pair_key.encode()).hexdigest(), 16) + seed_num

    # Title & Thesis Synthesizer
    prefixes = [
        "The Intersection of",
        "Algorithmic Synthesis:",
        "Neural Crossings:",
        "Dialectic Frontier:",
        "Resonant Architecture:",
        "Systems Convergence:",
    ]
    connectors = [
        "through the lens of",
        "as applied to",
        "bridged with",
        "synthesized through",
        "reimagined with",
    ]

    prefix = prefixes[h % len(prefixes)]
    connector = connectors[(h >> 2) % len(connectors)]

    # Domain-specific curated syntheses
    specialized_bridges: dict[tuple[str, str], dict[str, Any]] = {
        ("coding", "music"): {
            "title": f"Live Coding & Generative Sonic Algorithms",
            "tagline": f"Bridging {topic_a} and {topic_b} through algorithmic composition and digital signal processing.",
            "friction": "Fluid Synthesis",
            "narrative": (
                f"Your attention oscillates between computational precision ({topic_a}) and auditory flow ({topic_b}). "
                f"At this nexus lies the realm of generative audio synthesis, live-coding performance (like TidalCycles and Sonic Pi), "
                f"and algorithmic sound design. What seems like analytical engineering on one side and aesthetic recreation on the other "
                f"are two expressions of mathematical symmetry."
            ),
            "watch": [
                {"title": "The Art of Live Coding: Algorithms in Sound", "query": f"{topic_a} {topic_b} live coding generative audio", "duration": "24 min"},
                {"title": "Fourier Transforms & Acoustic Information Theory", "query": "fourier transform music visualizer physics", "duration": "18 min"},
            ],
            "read": [
                {"title": "The Audio Programming Book", "author": "Richard Boulanger & Victor Lazzarini", "type": "Foundational Text"},
                {"title": "Aesthetics of Generative Systems", "author": "Research Collective", "type": "Essay"},
            ],
            "build": {
                "title": "Build a Web Audio Generative Synthesizer",
                "description": f"Write an interactive browser sequencer that compiles code changes into dynamic harmonic soundscapes inspired by {topic_b}.",
                "difficulty": "Intermediate",
            },
            "sonic_vibe": "Ambient IDM & Minimalist Glitch Techno",
        },
        ("ai", "philosophy"): {
            "title": "Machine Consciousness & Cybernetic Epistemology",
            "tagline": f"Exploring where {topic_a} tests the outer boundaries of {topic_b}.",
            "friction": "Deep Philosophical Frontier",
            "narrative": (
                f"Your curiosity draws a direct vector between synthetic intelligence ({topic_a}) and foundational inquiry ({topic_b}). "
                f"This nexus investigates how high-dimensional latent representations parallel philosophical concepts of qualia, "
                f"functionalism, and the extended mind thesis. Your exploration is not just technical—it is deeply ontological."
            ),
            "watch": [
                {"title": "Large Language Models & the Philosophy of Mind", "query": "philosophy of mind artificial neural networks debate", "duration": "45 min"},
                {"title": "Cybernetics: Norbert Wiener to Modern Transformers", "query": "cybernetics history feedback loops systems theory", "duration": "32 min"},
            ],
            "read": [
                {"title": "Superintelligence & The Hard Problem", "author": "Nick Bostrom & David Chalmers", "type": "Seminal Debate"},
                {"title": "Vehicles: Experiments in Synthetic Psychology", "author": "Valentino Braitenberg", "type": "Classic Paper"},
            ],
            "build": {
                "title": "Create a Socratic Dialogue Simulator",
                "description": f"Prompt-engineer an LLM dialectic engine that stress-tests {topic_b} arguments through autonomous adversary agents.",
                "difficulty": "Weekend Project",
            },
            "sonic_vibe": "Drone Ambient & Meditative Neo-Classical",
        },
        ("coding", "gaming"): {
            "title": "Procedural Reality & Physics Simulation Architecture",
            "tagline": f"Synthesizing {topic_a} logic with the immersive worlds of {topic_b}.",
            "friction": "Natural Harmonic Synergy",
            "narrative": (
                f"You bridge the raw mechanics of implementation ({topic_a}) with interactive agency ({topic_b}). "
                f"The sweet spot of this intersection is deterministic simulation, spatial partitioning algorithms (Octrees/BVH), "
                f"and shader mathematics. You don't just consume experiences; your mind seeks to deconstruct the rendering loop beneath."
            ),
            "watch": [
                {"title": "Building Procedural Worlds in Real Time", "query": f"procedural generation {topic_a} game engine architecture", "duration": "38 min"},
                {"title": "Mathematical Magic of Shaders and Signed Distance Fields", "query": "raymarching signed distance fields shaders inigo quilez", "duration": "28 min"},
            ],
            "read": [
                {"title": "Game Engine Architecture", "author": "Jason Gregory", "type": "Industry Bible"},
                {"title": "Procedural Content Generation in Games", "author": "Noor Shaker et al.", "type": "Research Monograph"},
            ],
            "build": {
                "title": "Custom WebGL Cellular Automata Engine",
                "description": "Construct a GPU-accelerated Conway's Game of Life or procedural terrain generator directly in Three.js.",
                "difficulty": "Intermediate",
            },
            "sonic_vibe": "Cyberpunk Darksynth & Lo-Fi Chiptunes",
        },
        ("science", "music"): {
            "title": "Harmonic Resonance & Waveform Physics",
            "tagline": f"Unveiling the mathematical laws of vibration linking {topic_a} to {topic_b}.",
            "friction": "Elegant Resonance",
            "narrative": (
                f"Connecting {topic_a} with {topic_b} reveals that music is empirical acoustics while science is the study of universal harmonics. "
                f"From orbital resonances in astrophysics to quantum harmonic oscillators, frequency is the base currency of both disciplines."
            ),
            "watch": [
                {"title": "The Physics of Sound and Cymatics", "query": "cymatics sound frequency vibration physics documentary", "duration": "22 min"},
                {"title": "Music of the Spheres: Orbital Resonance", "query": "orbital resonance planetary motion harmonic ratios", "duration": "19 min"},
            ],
            "read": [
                {"title": "This Is Your Brain on Music", "author": "Daniel J. Levitin", "type": "Cognitive Science"},
                {"title": "The Geometry of Musical Chords", "author": "Dmitri Tymoczko (Science 2006)", "type": "Mathematical Paper"},
            ],
            "build": {
                "title": "Audio Spectrum Waveform Visualizer",
                "description": "Build an HTML5 Canvas oscillograph that maps live microphone input into Lissajous orbital curves.",
                "difficulty": "Easy to Moderate",
            },
            "sonic_vibe": "Microtonal Ambient & Modular Synthesis",
        },
    }

    # Match direct pair or reverse pair
    direct_key = (d_a, d_b)
    rev_key = (d_b, d_a)

    if direct_key in specialized_bridges:
        return specialized_bridges[direct_key]
    if rev_key in specialized_bridges:
        return specialized_bridges[rev_key]

    # Universal generative fallback for any topic combination
    friction_types = [
        "Counter-Intuitive Synergy",
        "High Friction / High Reward",
        "Uncharted Horizon",
        "Cross-Disciplinary Bridge",
        "Emergent Synthesis",
    ]
    friction = friction_types[h % len(friction_types)]

    title = f"{topic_a} × {topic_b}: {prefix} {topic_a} {connector} {topic_b}"
    if len(title) > 60:
        title = f"{topic_a} × {topic_b} Nexus"

    tagline = f"A cross-disciplinary curiosity gateway uniting {topic_a} and {topic_b}."
    narrative = (
        f"Your digital exploration demonstrates a unique duality: focused attention on **{topic_a}** alongside continuous curiosity in **{topic_b}**. "
        f"While these domains might inhabit different platforms or genres, the cognitive bridge between them represents your personal intellectual signature. "
        f"By purposefully applying the structural principles of {topic_a} to the creative canvas of {topic_b}, you unlock insights invisible to single-domain specialists."
    )

    watch_items = [
        {"title": f"Exploring the Interface of {topic_a} and {topic_b}", "query": f"{topic_a} {topic_b} documentary deep dive", "duration": f"{20 + (h % 25)} min"},
        {"title": f"Paradigm Shifts in Modern {topic_a}", "query": f"{topic_a} future trends innovations lecture", "duration": f"{15 + (h % 20)} min"},
    ]

    read_items = [
        {"title": f"Systems Thinking & Cross-Disciplinary Synthesis", "author": "Donella Meadows", "type": "Foundational Framework"},
        {"title": f"The Structure of Scientific Revolutions", "author": "Thomas Kuhn", "type": "Epistemology"},
    ]

    build_idea = {
        "title": f"The {topic_a}-{topic_b} Hybrid Notebook",
        "description": f"Create an interactive exploratory markdown journal or interactive prototype that maps how mental models from {topic_a} resolve problems in {topic_b}.",
        "difficulty": "Reflective Project",
    }

    vibes = [
        "Warm Analog Tape & Downtempo Beats",
        "Deep Focus Dark Ambient & Binaural Tones",
        "Futuristic Synthwave & Driving Arpeggios",
        "Nordic Neo-Classical & Delicate Strings",
    ]

    return {
        "title": title,
        "tagline": tagline,
        "friction": friction,
        "narrative": narrative,
        "watch": watch_items,
        "read": read_items,
        "build": build_idea,
        "sonic_vibe": vibes[h % len(vibes)],
    }


def generate_curiosity_nexus(
    assignments: list[dict[str, Any]],
    analysis: dict[str, Any],
    topic_a: str | None = None,
    topic_b: str | None = None,
) -> dict[str, Any]:
    """
    Curiosity Nexus: Discovers unexpected crossovers and synthesizes AI bridge
    recommendations between divergent interest clusters in the user's attention graph.
    """
    # 1. Gather all unique topics from assignments and top_topics
    topic_counts = Counter(
        e.get("topic", "Other")
        for e in assignments
        if e.get("topic") and e.get("topic") not in ("Other", "Unassigned", "Unknown", "General")
    )

    available_topics = [
        {"topic": topic, "count": count}
        for topic, count in topic_counts.most_common(20)
    ]

    # If user has very few topics, supply clean defaults
    if len(available_topics) < 2:
        available_topics = [
            {"topic": "Web Development", "count": 12},
            {"topic": "Electronic Music", "count": 8},
            {"topic": "Artificial Intelligence", "count": 6},
            {"topic": "Philosophy of Mind", "count": 4},
        ]

    # 2. Extract 2D topic centers from interest map if available
    interest_map = analysis.get("visualizations", {}).get("interest_map", {})
    topic_centers = interest_map.get("topic_centers", [])
    center_coords: dict[str, tuple[float, float]] = {}
    for tc in topic_centers:
        if isinstance(tc, dict) and "topic" in tc and "x" in tc and "y" in tc:
            center_coords[tc["topic"]] = (float(tc["x"]), float(tc["y"]))

    # 3. Compute pairwise distances / divergence
    topic_list = [item["topic"] for item in available_topics]
    divergence_pairs: list[dict[str, Any]] = []

    for i in range(len(topic_list)):
        for j in range(i + 1, len(topic_list)):
            t1, t2 = topic_list[i], topic_list[j]
            # Calculate distance if 2D coordinates exist
            if t1 in center_coords and t2 in center_coords:
                x1, y1 = center_coords[t1]
                x2, y2 = center_coords[t2]
                dist = math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
                normalized_score = min(98, max(65, int(dist * 25 + 65)))
            else:
                # Deterministic hash distance based on character divergence
                pair_h = int(hashlib.sha256(f"{t1}-{t2}".encode()).hexdigest(), 16)
                normalized_score = 75 + (pair_h % 22)

            divergence_pairs.append({
                "topic_a": t1,
                "topic_b": t2,
                "serendipity_score": normalized_score,
            })

    divergence_pairs.sort(key=lambda p: p["serendipity_score"], reverse=True)

    # 4. Resolve active topic_a and topic_b
    if not topic_a or not topic_b or topic_a == topic_b:
        # Default to highest serendipity pair
        top_pair = divergence_pairs[0] if divergence_pairs else {"topic_a": topic_list[0], "topic_b": topic_list[1], "serendipity_score": 92}
        selected_a = top_pair["topic_a"]
        selected_b = top_pair["topic_b"]
        serendipity_val = top_pair["serendipity_score"]
    else:
        selected_a = topic_a
        selected_b = topic_b
        # Lookup or calculate serendipity
        found = next((p for p in divergence_pairs if (p["topic_a"] == selected_a and p["topic_b"] == selected_b) or (p["topic_a"] == selected_b and p["topic_b"] == selected_a)), None)
        if found:
            serendipity_val = found["serendipity_score"]
        else:
            seed_h = int(hashlib.md5(f"{selected_a}-{selected_b}".encode()).hexdigest(), 16)
            serendipity_val = 80 + (seed_h % 18)

    # 5. Synthesize bridge metadata
    bridge_meta = _generate_bridge_metadata(selected_a, selected_b, seed_num=serendipity_val)

    # 6. Precalculate Top 4 Suggested Bridge Presets for quick switching
    suggested_presets = []
    for pair in divergence_pairs[:4]:
        meta = _generate_bridge_metadata(pair["topic_a"], pair["topic_b"], pair["serendipity_score"])
        suggested_presets.append({
            "topic_a": pair["topic_a"],
            "topic_b": pair["topic_b"],
            "title": meta["title"],
            "serendipity_score": pair["serendipity_score"],
            "friction": meta["friction"],
        })

    # Event samples for selected topics
    samples_a = [e.get("title", "") for e in assignments if e.get("topic") == selected_a][:3]
    samples_b = [e.get("title", "") for e in assignments if e.get("topic") == selected_b][:3]

    return {
        "status": "READY",
        "topic_a": selected_a,
        "topic_b": selected_b,
        "serendipity_score": serendipity_val,
        "friction": bridge_meta["friction"],
        "bridge_title": bridge_meta["title"],
        "tagline": bridge_meta["tagline"],
        "narrative": bridge_meta["narrative"],
        "recommendations": {
            "watch": bridge_meta["watch"],
            "read": bridge_meta["read"],
            "build": bridge_meta["build"],
            "sonic_vibe": bridge_meta["sonic_vibe"],
        },
        "samples": {
            "topic_a": samples_a,
            "topic_b": samples_b,
        },
        "available_topics": available_topics,
        "suggested_presets": suggested_presets,
        "generated_at": datetime.utcnow().isoformat(),
    }
