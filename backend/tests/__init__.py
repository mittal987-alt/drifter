"""
Phase 1 automated tests for Drifter.

Run from backend/:
    python -m pytest tests/ -v

These tests:
 - Use only temporary in-memory or temp-file SQLite databases.
 - Do not require external APIs, real OAuth credentials, or a running LLM.
 - Do not modify any developer database.
 - Use the FastAPI TestClient for HTTP-level tests.
"""
