"""
test_history_api.py — History API integration tests.

Covers:
  - GET /api/history/events (pagination, filtering, auth).
  - POST /api/history/import (file types, content parsing, deduplication).
  - DELETE /api/history/events/{id} (owner check, IDOR).
  - DELETE /api/history/clear (auth, CSRF bypass for tokens).
  - Saving events and verifying uniqueness constraint.
"""

import io
import json
import pytest
from datetime import datetime

from app.database.models import User, HistoryEvent
from app.api.dependencies import generate_extension_token


# ===========================================================================
# HELPERS
# ===========================================================================

def _make_user(db_session, email: str) -> tuple:
    user = User(email=email, is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = generate_extension_token(user.id)
    return user, token


def _make_event(db_session, user_id: int, title: str, source: str = "youtube", idx: int = 1) -> HistoryEvent:
    event = HistoryEvent(
        user_id=user_id,
        timestamp=datetime(2025, 1, idx),
        source=source,
        title=title,
        event_hash=f"hash_{user_id}_{idx}_{title[:8]}",
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


# ===========================================================================
# 1. GET HISTORY EVENTS
# ===========================================================================

class TestGetHistoryEvents:

    def test_unauthenticated_returns_401(self, app_client):
        resp = app_client.get("/api/history/events")
        assert resp.status_code == 401

    def test_empty_history_returns_empty_list(self, app_client, db_session):
        user, token = _make_user(db_session, "empty_hist@example.com")
        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert data["events"] == []

    def test_events_scoped_to_user(self, app_client, db_session):
        user_a, tok_a = _make_user(db_session, "hist_a@example.com")
        user_b, tok_b = _make_user(db_session, "hist_b@example.com")
        _make_event(db_session, user_b.id, "User B Video")

        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": f"Bearer {tok_a}"},
        )
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e.get("user_id") != user_b.id for e in events)
        assert len(events) == 0

    def test_pagination_offset(self, app_client, db_session):
        user, token = _make_user(db_session, "paged_hist@example.com")
        for i in range(5):
            _make_event(db_session, user.id, f"Video #{i}", idx=i + 1)

        resp = app_client.get(
            "/api/history/events?limit=3&offset=0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        first_page = resp.json()["events"]
        assert len(first_page) <= 3

        resp2 = app_client.get(
            "/api/history/events?limit=3&offset=3",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 200

    def test_limit_too_large_returns_400(self, app_client, db_session):
        user, token = _make_user(db_session, "lim_test@example.com")
        resp = app_client.get(
            "/api/history/events?limit=999999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_limit_zero_returns_400(self, app_client, db_session):
        user, token = _make_user(db_session, "lim0_test@example.com")
        resp = app_client.get(
            "/api/history/events?limit=0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_source_filter(self, app_client, db_session):
        user, token = _make_user(db_session, "source_filter@example.com")
        _make_event(db_session, user.id, "YouTube Video", source="youtube", idx=1)
        _make_event(db_session, user.id, "Spotify Track", source="spotify", idx=2)

        resp = app_client.get(
            "/api/history/events?source=spotify",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e.get("source") == "spotify" for e in events)


# ===========================================================================
# 2. DELETE SINGLE EVENT
# ===========================================================================

class TestDeleteSingleEvent:

    def test_delete_own_event_succeeds(self, app_client, db_session):
        user, token = _make_user(db_session, "del_own@example.com")
        event = _make_event(db_session, user.id, "My Video To Delete")
        resp = app_client.delete(
            f"/api/history/events/{event.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        # Verify deleted
        remaining = db_session.query(HistoryEvent).filter(HistoryEvent.id == event.id).first()
        assert remaining is None

    def test_delete_other_users_event_returns_404(self, app_client, db_session):
        user_a, tok_a = _make_user(db_session, "del_a@example.com")
        user_b, tok_b = _make_user(db_session, "del_b@example.com")
        event_b = _make_event(db_session, user_b.id, "User B Private Video")

        resp = app_client.delete(
            f"/api/history/events/{event_b.id}",
            headers={"Authorization": f"Bearer {tok_a}"},
        )
        assert resp.status_code == 404
        # Verify not deleted
        still_there = db_session.query(HistoryEvent).filter(HistoryEvent.id == event_b.id).first()
        assert still_there is not None

    def test_delete_nonexistent_event_returns_404(self, app_client, db_session):
        user, token = _make_user(db_session, "del_ghost@example.com")
        resp = app_client.delete(
            "/api/history/events/999999999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_delete_unauthenticated_returns_401(self, app_client):
        resp = app_client.delete("/api/history/events/1")
        assert resp.status_code == 401


# ===========================================================================
# 3. CLEAR ALL HISTORY
# ===========================================================================

class TestClearHistory:

    def test_clear_unauthenticated_returns_401(self, app_client):
        resp = app_client.delete("/api/history/clear")
        assert resp.status_code == 401

    def test_clear_removes_only_own_events(self, app_client, db_session):
        user_a, tok_a = _make_user(db_session, "clear_a@example.com")
        user_b, tok_b = _make_user(db_session, "clear_b@example.com")
        _make_event(db_session, user_a.id, "A Video", idx=1)
        event_b = _make_event(db_session, user_b.id, "B Video", idx=2)

        resp = app_client.delete(
            "/api/history/clear",
            headers={"Authorization": f"Bearer {tok_a}"},
        )
        assert resp.status_code == 200

        # User B's event must still exist
        still_there = db_session.query(HistoryEvent).filter(HistoryEvent.id == event_b.id).first()
        assert still_there is not None
        # User A's events should be gone
        user_a_count = db_session.query(HistoryEvent).filter(HistoryEvent.user_id == user_a.id).count()
        assert user_a_count == 0


# ===========================================================================
# 4. IMPORT FILE UPLOAD
# ===========================================================================

class TestImportFile:

    def _authed_client(self, app_client, email="importer@example.com"):
        app_client.post(
            "/api/auth/register",
            json={"email": email, "password": "pass123"},
        )
        return app_client

    def test_import_unsupported_extension_rejected(self, app_client):
        client = self._authed_client(app_client, "imp_bad_ext@example.com")
        resp = client.post(
            "/api/history/import",
            files={"file": ("malware.exe", b"binary", "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json().get("detail", "")

    def test_import_unauthenticated_returns_401(self, app_client):
        resp = app_client.post(
            "/api/history/import",
            files={"file": ("history.json", b"[]", "application/json")},
        )
        assert resp.status_code == 401

    def test_import_empty_json_array(self, app_client):
        client = self._authed_client(app_client, "imp_empty@example.com")
        resp = client.post(
            "/api/history/import",
            files={"file": ("watch-history.json", b"[]", "application/json")},
        )
        # Empty import is valid — should return 200 with 0 imported
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("imported", 0) == 0

    def test_import_valid_youtube_json(self, app_client):
        client = self._authed_client(app_client, "imp_yt@example.com")
        events = [
            {
                "header": "YouTube",
                "title": "Watched Python Tutorial for Beginners",
                "titleUrl": "https://www.youtube.com/watch?v=abc",
                "time": "2025-01-15T14:30:00Z",
            }
        ]
        content = json.dumps(events).encode()
        resp = client.post(
            "/api/history/import",
            files={"file": ("watch-history.json", content, "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("imported", 0) >= 1

    def test_import_deduplication_prevents_double_import(self, app_client, db_session):
        client = self._authed_client(app_client, "imp_dedup@example.com")
        events = [
            {
                "header": "YouTube",
                "title": "Watched Unique Dedup Video",
                "titleUrl": "https://www.youtube.com/watch?v=dup1",
                "time": "2025-02-10T10:00:00Z",
            }
        ]
        content = json.dumps(events).encode()
        # Import twice
        resp1 = client.post(
            "/api/history/import",
            files={"file": ("watch-history.json", content, "application/json")},
        )
        resp2 = client.post(
            "/api/history/import",
            files={"file": ("watch-history.json", content, "application/json")},
        )
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Second import should have 0 new events (or duplicates > 0)
        data2 = resp2.json()
        assert data2.get("imported", 0) == 0 or data2.get("duplicates", 0) >= 1
