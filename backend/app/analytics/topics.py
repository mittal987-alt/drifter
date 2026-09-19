import re
from collections import Counter
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS

# Expanded stop words to clean up ad codes, video metadata, and formatting artifacts
EXTRA_STOP_WORDS = {
    "en", "dr", "16x9", "16", "9", "uv", "acq", "fbigs", "cvs", "mai", "080326",
    "promoaug26geet", "video", "ad", "ads", "shortened", "pro", "competitor", "packed",
    "connectors", "official", "hd", "4k", "full", "free", "card", "online", "borrow",
    "anytime", "anywhere", "promo", "1080x1920", "1920x1080", "1x1", "4x5", "9x16",
    "ab9", "watched", "youtube", "in", "out", "the", "a", "an", "and", "or", "of",
    "to", "for", "with", "on", "at", "uac", "etf", "geeteg", "geeteg26", "campaign",
    "null", "fb", "fbigs", "dv1", "alt", "bundle", "p3", "431", "1a", "1b", "784", "m0",
    "shorts", "reva", "ch", "version", "ep", "episode", "season", "part", "vol"
}

ALL_STOP_WORDS = list(ENGLISH_STOP_WORDS.union(EXTRA_STOP_WORDS))

# Smart category mappings for clean human-readable titles
CATEGORY_MAPPINGS = [
    (re.compile(r"\b(azure|aws|gcp|cloud|scale|devops|docker|k8s|kubernetes|server|database|sql)\b", re.I), "Cloud & Infrastructure"),
    (re.compile(r"\b(finance|credit|invest|stocks?|trading|crypto|bank|money|upstox|slice|commerce|shopping|bonds|price|graph)\b", re.I), "Finance & Investing"),
    (re.compile(r"\b(ai|llm|gpt|gemini|openai|agents?|python|py|coding|react|javascript|typescript|software|developer|machine learning|classroom|code|ch|p6|0s|ag)\b", re.I), "AI & Software Engineering"),
    (re.compile(r"\b(music|songs?|spotify|soundtrack|album|track|artist|audio|soundscape|beats|phonk|soda|vibe|yaari|mcdowell|kartik)\b", re.I), "Music & Audio"),
    (re.compile(r"\b(film|movie|cinema|trailer|documentary|entertainment|podcast|show|media|hindi|house)\b", re.I), "Entertainment & Media"),
    (re.compile(r"\b(gaming|game|gameplay|playthrough|esports|stream)\b", re.I), "Gaming"),
    (re.compile(r"\b(career|job|interview|hiring|resume|salary|naukri)\b", re.I), "Career & Professional"),
    (re.compile(r"\b(health|fitness|workout|wellness|diet|nutrition|veggies)\b", re.I), "Health & Lifestyle"),
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

    # 2. Key phrase fallback from title
    words = re.findall(r"\b[a-zA-Z0-9]+\b", combined)
    valid_words = [
        w.title() if len(w) > 2 else w.upper()
        for w in words
        if w.lower() not in ALL_STOP_WORDS and is_valid_term(w)
    ]

    if valid_words:
        return " & ".join(valid_words[:2])

    return "General Exploration"


def generate_topic_labels(
    texts: list[str],
    assignments: np.ndarray,
    max_terms: int = 2,
) -> dict[int, str]:
    """
    Generate clean, human-readable labels for each cluster.
    """
    labels: dict[int, str] = {}

    if not texts:
        return labels

    cluster_ids = sorted(set(int(x) for x in assignments))

    for cluster_id in cluster_ids:
        if cluster_id == -1:
            labels[cluster_id] = "Other"
            continue

        cluster_texts = [
            text
            for text, label in zip(texts, assignments)
            if int(label) == cluster_id
        ]

        if not cluster_texts:
            labels[cluster_id] = "General Exploration"
            continue

        # Check for category rule matches first
        combined_text = " ".join(cluster_texts)
        matched_cat = None
        for pattern, cat_name in CATEGORY_MAPPINGS:
            if pattern.search(combined_text):
                matched_cat = cat_name
                break

        try:
            vectorizer = TfidfVectorizer(
                stop_words=ALL_STOP_WORDS,
                max_features=100,
                ngram_range=(1, 2),
                min_df=1,
            )

            matrix = vectorizer.fit_transform(cluster_texts)
            scores = np.asarray(matrix.mean(axis=0)).ravel()
            terms = vectorizer.get_feature_names_out()
            ranked = scores.argsort()[::-1]

            selected_terms: list[str] = []
            for idx in ranked:
                if scores[idx] <= 0:
                    break
                candidate = terms[idx].strip().lower()

                if not is_valid_term(candidate):
                    continue

                # Avoid redundant sub-string overlaps
                if any(candidate in existing or existing in candidate for existing in selected_terms):
                    continue

                selected_terms.append(candidate)
                if len(selected_terms) >= max_terms:
                    break

            if selected_terms:
                formatted_terms = " & ".join(clean_term(t) for t in selected_terms)
                if matched_cat and matched_cat.lower() not in formatted_terms.lower():
                    labels[cluster_id] = f"{matched_cat} ({formatted_terms})"
                else:
                    labels[cluster_id] = formatted_terms
            elif matched_cat:
                labels[cluster_id] = matched_cat
            else:
                labels[cluster_id] = f"Topic {cluster_id + 1}"

        except ValueError:
            labels[cluster_id] = matched_cat or f"Topic {cluster_id + 1}"

    return labels