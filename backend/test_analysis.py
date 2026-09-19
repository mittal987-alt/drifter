from app.analytics.embeddings import (
    create_embeddings,
    create_text,
)

from app.analytics.clustering import (
    cluster_embeddings,
)

from app.analytics.topics import (
    generate_topic_labels,
)


texts = [
    create_text("Python FastAPI tutorial"),
    create_text("FastAPI REST API development"),
    create_text("Python backend architecture"),

    create_text("Machine learning introduction"),
    create_text("Neural networks explained"),
    create_text("Deep learning with Python"),

    create_text("Best football goals"),
    create_text("Football match highlights"),
    create_text("Premier League highlights"),
]


embeddings = create_embeddings(texts)

print(
    "Embedding shape:",
    embeddings.shape,
)


assignments = cluster_embeddings(
    embeddings,
    min_cluster_size=2,
)

print(
    "Assignments:",
    assignments,
)


labels = generate_topic_labels(
    texts,
    assignments,
)

print(
    "Topics:"
)

for cluster_id, label in labels.items():
    print(
        cluster_id,
        "→",
        label,
    )