import logging
import os
import re
from collections import Counter
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS

logger = logging.getLogger(__name__)

# Expanded stop words to clean up ad codes, video metadata, and formatting artifacts
EXTRA_STOP_WORDS = {
    "en", "dr", "16x9", "16", "9", "uv", "acq", "fbigs", "cvs", "mai", "080326",
    "promoaug26geet", "video", "ad", "ads", "shortened", "pro", "competitor", "packed",
    "connectors", "official", "hd", "4k", "full", "free", "card", "online", "borrow",
    "anytime", "anywhere", "promo", "1080x1920", "1920x1080", "1x1", "4x5", "9x16",
    "ab9", "watched", "youtube", "in", "out", "the", "a", "an", "and", "or", "of",
    "to", "for", "with", "on", "at", "uac", "etf", "geeteg", "geeteg26", "campaign",
    "null", "fb", "fbigs", "dv1", "alt", "bundle", "p3", "431", "1a", "1b", "784", "m0",
    "shorts", "reva", "ch", "version", "ep", "episode", "season", "part", "vol",
    "karo", "hai", "ka", "ki", "ke", "ko", "se", "aur", "ye", "wo", "trailer",
    "teaser", "music", "song", "lyric", "lyrics", "status", "video"
}

ALL_STOP_WORDS = list(ENGLISH_STOP_WORDS.union(EXTRA_STOP_WORDS))

# Smart category mappings for clean human-readable titles
CATEGORY_MAPPINGS = [
    (re.compile(r"\b(azure|aws|gcp|cloud|scale|devops|docker|k8s|kubernetes|server|database|sql)\b", re.I), "Cloud & Infrastructure"),
    (re.compile(r"\b(finance|credit|invest|stocks?|trading|crypto|bank|money|upstox|slice|commerce|shopping|bonds|price|graph)\b", re.I), "Finance & Investing"),
    (re.compile(r"\b(ai|llm|gpt|gemini|openai|agents?|python|py|coding|react|javascript|typescript|software|developer|machine learning|classroom|code|ch|p6|0s|ag)\b", re.I), "AI & Software Engineering"),
    (re.compile(r"\b(music|songs?|spotify|soundtrack|album|track|artist|audio|soundscape|beats|phonk|soda|vibe|yaari|mcdowell|kartik)\b", re.I), "Music & Audio"),
    (re.compile(r"\b(cricket|ipl|bcci|match|wicket|kohli|rohit|dhoni|aus|ind|odi|t20|test match|highlights)\b", re.I), "Cricket & Sports"),
    (re.compile(r"\b(film|movie|cinema|trailer|documentary|entertainment|podcast|show|media|hindi|house|netflix|actor|actress)\b", re.I), "Entertainment & Media"),
    (re.compile(r"\b(gaming|game|gameplay|playthrough|esports|stream|ps5|xbox|gta)\b", re.I), "Gaming"),
    (re.compile(r"\b(career|job|interview|hiring|resume|salary|naukri)\b", re.I), "Career & Professional"),
    (re.compile(r"\b(health|fitness|workout|wellness|diet|nutrition|veggies|fruits?|exercise)\b", re.I), "Health & Lifestyle"),
]

ASPECT_RATIO_RE = re.compile(r"^\d+x\d+$", re.IGNORECASE)


def clean_term(term: str) -> str:
    """Clean individual term from punctuation/digits."""
    term = re.sub(r"[^a-zA-Z0-9\s]", " ", term)
    return " ".join(term.split()).title()


def is_valid_term(term: str) -> bool:
    """Check if candidate term is a meaningful topic keyword."""
    if not term or len(term) < 3:
        return False
    if term.isdigit():
        return False
    if ASPECT_RATIO_RE.match(term):
        return False
    if sum(c.isalpha() for c in term) < 3:
        return False
    if term.lower() in EXTRA_STOP_WORDS:
        return False
    return True


def clean_title_for_topic(title: str) -> str:
    """Clean a raw title to extract its primary subject phrase."""
    # Remove common video suffixes
    text = title.split("|")[0].split(" - ")[0].split("—")[0].split("ft.")[0].split("feat.")[0].strip()
    text = re.sub(r"\[.*?\]|\(.*?\)", "", text).strip()
    words = [w for w in text.split() if w.lower() not in EXTRA_STOP_WORDS]
    if not words:
        words = text.split()
    return " ".join(words[:4]).title()


def classify_single_event(title: str, artist: str | None = None) -> str:
    """
    Categorize a single event based on rule matching or key phrase extraction.
    Used when HDBSCAN clusters an event as unassigned/noise (-1).
    """
    combined = f"{title or ''} {artist or ''}".strip()
    if not combined:
        return "Other"

    # 1. Match category rules
    for pattern, cat_name in CATEGORY_MAPPINGS:
        if pattern.search(combined):
            return cat_name

    # 2. Extract clean coherent title phrase (never join unrelated single words with '&')
    clean = clean_title_for_topic(title)
    if clean and len(clean) >= 3 and clean.lower() not in ("other", "video", "watched", "null"):
        return clean

    return "General Exploration"


def _call_llm_for_cluster_label(representative_titles: list[str]) -> str | None:
    """
    Single LLM call to label a cluster based on representative titles.
    Supports Gemini and OpenAI API keys.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if not (gemini_key or openai_key) or not representative_titles:
        return None

    titles_text = "\n".join(f"- {t}" for t in representative_titles[:8])
    prompt = (
        "You are an expert topic categorization model. Analyze these representative titles from a user's cluster:\n\n"
        f"{titles_text}\n\n"
        "Provide a single, short, coherent topic name (2 to 4 words in Title Case) that accurately describes what these items have in common. "
        "Do NOT mechanically join unrelated words with '&'. Return ONLY the topic name, with no quotes, punctuation, or preamble."
    )

    try:
        import httpx

        if gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}]
            }
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidate = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    clean = re.sub(r'["\'.]', '', candidate).strip()
                    if clean and 2 <= len(clean.split()) <= 5 and "error" not in clean.lower():
                        return clean.title()

        if openai_key:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a concise topic labeling engine."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 20,
            }
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidate = data["choices"][0]["message"]["content"].strip()
                    clean = re.sub(r'["\'.]', '', candidate).strip()
                    if clean and 2 <= len(clean.split()) <= 5 and "error" not in clean.lower():
                        return clean.title()

    except Exception as e:
        logger.debug(f"LLM topic labeling call skipped: {e}")

    return None


def _extract_coherent_local_label(representative_titles: list[str], cluster_id: int) -> str:
    """
    Coherent fallback label extraction:
    - Finds common intact multi-word phrases (bigrams/trigrams) that occur across titles.
    - Or cleans the centroid title's primary subject.
    - Never emits an independent 'Word & Word' term join.
    """
    if not representative_titles:
        return f"Topic {cluster_id + 1}"

    # 1. Look for frequent intact bigrams / trigrams across the representative titles
    ngram_counts: Counter = Counter()
    for title in representative_titles:
        words = [w for w in re.findall(r"\b[a-zA-Z0-9]+\b", title) if w.lower() not in ALL_STOP_WORDS and len(w) > 2]
        for n in (3, 2):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i:i+n]).title()
                ngram_counts[phrase] += 1

    # If an intact phrase occurs in >= 2 titles, use it
    for phrase, count in ngram_counts.most_common(5):
        if count >= 2:
            return phrase

    # 2. Extract clean core subject from the top centroid title
    top_title = representative_titles[0]
    clean = clean_title_for_topic(top_title)
    if clean and len(clean.split()) >= 2:
        return clean

    # 3. If single word from top title, check if valid
    if clean and len(clean) >= 3 and clean.lower() not in ("other", "video", "watched", "null"):
        return clean

    # 4. Final deterministic fallback
    return f"Topic {cluster_id + 1}"


def generate_topic_labels(
    texts: list[str],
    assignments: np.ndarray | list[int],
    embeddings: np.ndarray | None = None,
) -> dict[int, str]:
    """
    Generate clean, coherent, human-readable labels for each cluster.

    Workflow:
    1. First-pass rule matching against CATEGORY_MAPPINGS.
    2. Centroid-based representative title ranking (cosine similarity).
    3. Single LLM call per cluster with representative titles.
    4. Coherent intact phrase fallback (never mechanical 'Word & Word' join).
    """
    labels: dict[int, str] = {}

    if not texts:
        return labels

    cluster_ids = sorted(set(int(x) for x in assignments))

    for cluster_id in cluster_ids:
        if cluster_id == -1:
            labels[cluster_id] = "Other"
            continue

        # Get indices and texts of members in this cluster
        cluster_member_indices = [
            i for i, label in enumerate(assignments)
            if int(label) == cluster_id
        ]

        if not cluster_member_indices:
            labels[cluster_id] = "General Exploration"
            continue

        cluster_texts = [texts[i] for i in cluster_member_indices]

        # ------------------------------------------------------------
        # 1. Check for CATEGORY_MAPPINGS match first
        # ------------------------------------------------------------
        combined_text = " ".join(cluster_texts)
        matched_cat = None
        for pattern, cat_name in CATEGORY_MAPPINGS:
            if pattern.search(combined_text):
                matched_cat = cat_name
                break

        if matched_cat:
            labels[cluster_id] = matched_cat
            print(f"[Topic Labels] Cluster {cluster_id} -> '{matched_cat}' (Category Rule Match)")
            continue

        # ------------------------------------------------------------
        # 2. Compute Centroid & Rank Member Titles by Cosine Similarity
        # ------------------------------------------------------------
        if embeddings is not None and len(embeddings) == len(texts):
            member_embeddings = embeddings[cluster_member_indices]
            centroid = np.mean(member_embeddings, axis=0)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm

            # Dot product gives cosine similarity since member embeddings are L2 normalized
            similarities = np.dot(member_embeddings, centroid)
            ranked_local_indices = np.argsort(similarities)[::-1]
            representative_titles = [cluster_texts[i] for i in ranked_local_indices[:8]]
        else:
            representative_titles = cluster_texts[:8]

        # ------------------------------------------------------------
        # 3. LLM-Assisted Cluster Labeling
        # ------------------------------------------------------------
        llm_label = _call_llm_for_cluster_label(representative_titles)
        if llm_label:
            labels[cluster_id] = llm_label
            print(f"[Topic Labels] Cluster {cluster_id} -> '{llm_label}' (LLM Synthesized) | Titles: {representative_titles[:3]}")
            continue

        # ------------------------------------------------------------
        # 4. Coherent Multi-Word Phrase Fallback
        # ------------------------------------------------------------
        fallback_label = _extract_coherent_local_label(representative_titles, cluster_id)
        labels[cluster_id] = fallback_label
        print(f"[Topic Labels] Cluster {cluster_id} -> '{fallback_label}' (Coherent Phrase Fallback) | Titles: {representative_titles[:3]}")

    return labels