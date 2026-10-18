"""
test_pipeline.py — Analysis pipeline unit tests.

Verifies:
  - prepare_events handles dict input (the pre-existing AttributeError bug fix).
  - prepare_events handles ORM-like objects.
  - Deduplication works correctly.
  - Ad/promotional titles are filtered out.
  - Empty events return empty result.
  - build_interest_analysis handles empty events gracefully.
"""

import pytest
from datetime import datetime

from app.services.analysis_pipeline import (
    prepare_events,
    clean_title,
    build_event_text,
    is_ad_or_promotional,
    _EventAdapter,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_dict_event(**overrides):
    base = {
        "id": 1,
        "title": "Python FastAPI Tutorial",
        "source": "youtube",
        "timestamp": datetime(2025, 1, 15, 10, 0, 0).isoformat(),
        "artist": None,
        "url": "https://youtube.com/watch?v=abc",
        "duration": 600.0,
        "event_hash": "abc123",
    }
    base.update(overrides)
    return base


class FakeOrmEvent:
    """Simulate a SQLAlchemy HistoryEvent ORM object."""
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", 1)
        self.title = kwargs.get("title", "Test Title")
        self.source = kwargs.get("source", "youtube")
        self.timestamp = kwargs.get("timestamp", datetime(2025, 1, 15))
        self.artist = kwargs.get("artist", None)
        self.url = kwargs.get("url", None)
        self.duration = kwargs.get("duration", None)
        self.event_hash = kwargs.get("event_hash", "hash1")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestCleanTitle:
    def test_removes_watched_prefix(self):
        assert clean_title("Watched Python Tutorial") == "Python Tutorial"

    def test_normalises_whitespace(self):
        assert clean_title("  hello   world  ") == "hello world"

    def test_empty_returns_empty_string(self):
        assert clean_title("") == ""
        assert clean_title(None) == ""


class TestIsAdOrPromotional:
    def test_detects_ad_signatures(self):
        assert is_ad_or_promotional("promoaug Campaign Video")
        assert is_ad_or_promotional("video ad 30s")

    def test_normal_titles_are_not_ads(self):
        assert not is_ad_or_promotional("Python FastAPI Tutorial")
        assert not is_ad_or_promotional("Premier League Highlights 2025")


class TestEventAdapter:
    def test_dict_input(self):
        d = _make_dict_event(title="Hello World")
        adapter = _EventAdapter(d)
        assert adapter.title == "Hello World"
        assert adapter.source == "youtube"

    def test_orm_input(self):
        orm = FakeOrmEvent(title="My ORM Title", source="spotify")
        adapter = _EventAdapter(orm)
        assert adapter.title == "My ORM Title"
        assert adapter.source == "spotify"


class TestPrepareEvents:
    def test_dict_events_no_attribute_error(self):
        """
        Regression test for the pre-existing AttributeError:
          'dict' object has no attribute 'title'
        """
        events = [
            _make_dict_event(id=1, title="Python FastAPI Tutorial"),
            _make_dict_event(id=2, title="Machine Learning Basics"),
        ]
        result = prepare_events(events)
        assert len(result) == 2
        assert result[0]["title"] == "Python FastAPI Tutorial"

    def test_orm_events_still_work(self):
        events = [
            FakeOrmEvent(id=1, title="Test Video One"),
            FakeOrmEvent(id=2, title="Test Video Two", event_hash="hash2"),
        ]
        result = prepare_events(events)
        assert len(result) == 2

    def test_empty_events_returns_empty_list(self):
        assert prepare_events([]) == []

    def test_deduplication_removes_duplicates(self):
        event = _make_dict_event(id=1, title="Duplicate Video")
        result = prepare_events([event, event, event])
        assert len(result) == 1

    def test_ad_events_are_filtered(self):
        events = [
            _make_dict_event(id=1, title="promoaug Campaign"),
            _make_dict_event(id=2, title="Real Tutorial"),
        ]
        result = prepare_events(events)
        assert len(result) == 1
        assert result[0]["title"] == "Real Tutorial"

    def test_events_with_empty_title_are_filtered(self):
        events = [
            _make_dict_event(id=1, title=""),
            _make_dict_event(id=2, title="   "),
            _make_dict_event(id=3, title="Good Title"),
        ]
        result = prepare_events(events)
        assert len(result) == 1

    def test_result_contains_expected_keys(self):
        events = [_make_dict_event(id=1, title="Test Video")]
        result = prepare_events(events)
        assert result
        keys = result[0].keys()
        for expected_key in ("event_id", "timestamp", "source", "title", "text"):
            assert expected_key in keys


class TestBuildInterestAnalysis:
    def test_empty_events_returns_empty_structure(self):
        from app.services.analytics_service import build_interest_analysis
        result = build_interest_analysis([])
        assert result["cluster_count"] == 0
        assert result["assignments"] == []
        assert "topics" in result
        assert "evolution" in result
