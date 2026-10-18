"""
test_security.py — Automated security tests for Drifter Phase 2.

Covers:
  1. Authentication & Session Security (unauthenticated access, invalid sessions, logout, CSRF, OAuth state).
  2. Authorization & IDOR Protection (cross-user data isolation, foreign object access, export isolation).
  3. Provider Credentials & Encryption at Rest (Fernet authenticated encryption, key versioning, export redaction).
  4. API Input Validation & Abuse Protection (upload limits, file extension whitelist, pagination bounds).
  5. Privacy & Data Lifecycle (provider disconnection, full account deletion, cascade cleanups).
  6. WebSocket Authentication & Scoping.
"""

import json
import pytest
from datetime import datetime

from app.database.models import User, Connection, HistoryEvent, AnalysisResult, PortabilityExportJob
from app.api.dependencies import generate_extension_token
from app.services.crypto import encrypt_token, decrypt_token, KEY_VERSION_PREFIX


# ===========================================================================
# 1. AUTHENTICATION & SESSION SECURITY
# ===========================================================================

class TestAuthenticationSecurity:
    """Verifies that authentication checks are strictly enforced."""

    def test_unauthenticated_protected_endpoints_rejected(self, app_client):
        """Unauthenticated requests to protected endpoints must return 401."""
        protected_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/history/events"),
            ("DELETE", "/api/history/clear"),
            ("DELETE", "/api/cache/clear"),
            ("GET", "/api/auth/export"),
            ("DELETE", "/api/auth/account"),
            ("GET", "/api/analytics/dashboard"),
            ("GET", "/api/analytics/interests"),
            ("GET", "/api/analytics/predictions"),
            ("POST", "/api/analytics/chat"),
        ]

        for method, path in protected_endpoints:
            if method == "GET":
                resp = app_client.get(path)
            elif method == "DELETE":
                resp = app_client.delete(path)
            elif method == "POST":
                resp = app_client.post(path, json={"message": "hello"})
            assert resp.status_code == 401, f"Expected 401 for {method} {path}, got {resp.status_code}"

    def test_deactivated_user_rejected(self, app_client, db_session):
        """Users marked is_active=False must be rejected with 403 or 401."""
        inactive_user = User(
            email="inactive@example.com",
            name="Inactive User",
            is_active=False,
        )
        db_session.add(inactive_user)
        db_session.commit()
        db_session.refresh(inactive_user)

        token = generate_extension_token(inactive_user.id)
        resp = app_client.get("/api/history/events", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (401, 403), f"Expected 401/403 for inactive user, got {resp.status_code}"

    def test_logout_invalidates_session(self, app_client):
        """Logout must clear the session so subsequent cookie-based requests fail."""
        # 1. Register a new user
        reg_resp = app_client.post(
            "/api/auth/register",
            json={"email": "logout_test@example.com", "password": "password123", "name": "Logout Test"},
        )
        assert reg_resp.status_code == 200

        # 2. Access /api/auth/me via session cookie
        me_resp = app_client.get("/api/auth/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["authenticated"] is True

        # 3. Call logout
        logout_resp = app_client.post("/api/auth/logout")
        assert logout_resp.status_code == 200

        # 4. Access /api/auth/me again — must now be 401
        me_after_resp = app_client.get("/api/auth/me")
        assert me_after_resp.status_code == 401

    def test_csrf_origin_check_blocks_malicious_origin(self, app_client):
        """State-changing requests with cookie authentication from untrusted origins must return 403."""
        # 1. Register user (sets session cookie)
        reg_resp = app_client.post(
            "/api/auth/register",
            json={"email": "csrf_test@example.com", "password": "password123"},
        )
        assert reg_resp.status_code == 200

        # 2. Attempt state-changing DELETE with an attacker Origin
        resp = app_client.delete(
            "/api/history/clear",
            headers={"Origin": "https://attacker-controlled-site.com"},
        )
        assert resp.status_code == 403
        assert "Cross-site request rejected" in resp.json().get("detail", "")

    def test_csrf_token_auth_bypasses_origin_check(self, app_client, db_session):
        """API / Extension requests with Bearer or X-Sync-Token are immune to cross-site cookie CSRF."""
        user = User(email="token_auth_user@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        token = generate_extension_token(user.id)
        resp = app_client.delete(
            "/api/history/clear",
            headers={
                "Authorization": f"Bearer {token}",
                "Origin": "chrome-extension://someextensionid",
            },
        )
        assert resp.status_code == 200

    def test_oauth_state_mismatch_rejected(self, app_client):
        """OAuth callbacks with missing or mismatched state must return 400."""
        # Missing state
        resp1 = app_client.get("/api/auth/spotify/callback?code=fake-code")
        assert resp1.status_code == 400

        # Invalid state
        resp2 = app_client.get("/api/auth/google/callback?code=fake-code&state=invalid-state")
        assert resp2.status_code == 400


# ===========================================================================
# 2. AUTHORIZATION & IDOR ISOLATION
# ===========================================================================

class TestAuthorizationAndIDOR:
    """Verifies that users can only access their own resources (no IDOR)."""

    @pytest.fixture()
    def setup_two_users(self, app_client, db_session):
        user_a = User(email="user_a@example.com", is_active=True)
        user_b = User(email="user_b@example.com", is_active=True)
        db_session.add_all([user_a, user_b])
        db_session.commit()
        db_session.refresh(user_a)
        db_session.refresh(user_b)

        # Add event for User B
        event_b = HistoryEvent(
            user_id=user_b.id,
            timestamp=datetime.utcnow(),
            source="youtube",
            title="User B Private Video",
            event_hash="hash_b_1",
        )
        # Add export job for User B
        job_b = PortabilityExportJob(
            user_id=user_b.id,
            archive_job_id="archive_b_secret_123",
            status="COMPLETE",
            imported=10,
        )
        # Add analysis result for User B
        analysis_b = AnalysisResult(
            user_id=user_b.id,
            source="youtube",
            event_count=10,
            status="READY",
            analysis_json=json.dumps({"interests": ["User B Secret Interest"]}),
        )
        db_session.add_all([event_b, job_b, analysis_b])
        db_session.commit()
        db_session.refresh(event_b)
        db_session.refresh(job_b)
        db_session.refresh(analysis_b)

        token_a = generate_extension_token(user_a.id)
        token_b = generate_extension_token(user_b.id)

        return {
            "user_a_id": user_a.id,
            "user_b_id": user_b.id,
            "token_a": token_a,
            "token_b": token_b,
            "event_b_id": event_b.id,
            "job_b_id": job_b.id,
        }

    def test_user_a_cannot_read_user_b_history(self, app_client, setup_two_users):
        """User A must not see User B's history events."""
        data = setup_two_users
        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": f"Bearer {data['token_a']}"},
        )
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert len(events) == 0  # User A has no events

    def test_user_a_cannot_delete_user_b_event(self, app_client, setup_two_users, db_session):
        """User A must receive 404 when attempting to delete User B's event (IDOR guard)."""
        data = setup_two_users
        event_b_id = data["event_b_id"]

        resp = app_client.delete(
            f"/api/history/events/{event_b_id}",
            headers={"Authorization": f"Bearer {data['token_a']}"},
        )
        assert resp.status_code == 404

        # Verify event still exists in DB
        ev = db_session.query(HistoryEvent).filter(HistoryEvent.id == event_b_id).first()
        assert ev is not None

    def test_user_a_cannot_access_user_b_export_job(self, app_client, setup_two_users):
        """User A must receive 404 when querying User B's export job."""
        data = setup_two_users
        job_b_id = data["job_b_id"]

        resp = app_client.get(
            f"/api/history/google/export/{job_b_id}",
            headers={"Authorization": f"Bearer {data['token_a']}"},
        )
        assert resp.status_code == 404

    def test_user_a_export_excludes_user_b_data(self, app_client, setup_two_users):
        """User A's personal data export must never include User B's data."""
        data = setup_two_users
        resp = app_client.get(
            "/api/auth/export",
            headers={"Authorization": f"Bearer {data['token_a']}"},
        )
        assert resp.status_code == 200
        export = resp.json()
        assert export["user"]["id"] == data["user_a_id"]
        assert len(export["history_events"]) == 0
        assert len(export["analysis_records"]) == 0
        assert len(export["export_jobs"]) == 0


# ===========================================================================
# 3. CREDENTIALS & ENCRYPTION AT REST
# ===========================================================================

class TestCredentialsAndEncryption:
    """Verifies that sensitive provider tokens are encrypted at rest using Fernet."""

    def test_token_encryption_at_rest(self, app_client, db_session):
        """Storing a connection token must persist ciphertext starting with v1:."""
        user = User(email="crypto_user@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        raw_token = "spotify-super-secret-access-token-xyz"
        raw_refresh = "spotify-super-secret-refresh-token-123"

        conn = Connection(
            user_id=user.id,
            provider="spotify",
            access_token=raw_token,
            refresh_token=raw_refresh,
        )
        db_session.add(conn)
        db_session.commit()
        db_session.refresh(conn)

        conn_id = conn.id

        # Verify in-memory model returns plaintext when accessed via SQLAlchemy
        assert conn.access_token == raw_token
        assert conn.refresh_token == raw_refresh

        # Query raw SQL directly to inspect the actual database column
        with db_session.bind.connect() as raw_conn:
            from sqlalchemy import text
            row = raw_conn.execute(
                text("SELECT access_token, refresh_token FROM connections WHERE id = :id"),
                {"id": conn_id},
            ).fetchone()

            assert row is not None
            db_access = row[0]
            db_refresh = row[1]

            # Both must be encrypted at rest and prefixed with v1:
            assert db_access.startswith(KEY_VERSION_PREFIX)
            assert db_refresh.startswith(KEY_VERSION_PREFIX)
            assert raw_token not in db_access
            assert raw_refresh not in db_refresh

    def test_legacy_plaintext_token_compatibility(self):
        """Legacy unencrypted tokens without v1: prefix must decrypt transparently."""
        legacy_plain = "legacy-plaintext-token-from-v0.1"
        decrypted = decrypt_token(legacy_plain)
        assert decrypted == legacy_plain

    def test_crypto_fails_safely_on_corrupted_ciphertext(self):
        """Corrupted ciphertext must raise ValueError and never leak data."""
        with pytest.raises(ValueError, match="Provider token decryption failed"):
            decrypt_token("v1:corrupted-invalid-base64-content")

    def test_export_excludes_sensitive_credentials(self, app_client, db_session):
        """Personal data export must never include raw tokens or password hashes."""
        user = User(
            email="export_sec_test@example.com",
            password_hash="argon2id$hashedpassword",
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        conn = Connection(
            user_id=user.id,
            provider="youtube",
            access_token="sensitive-youtube-access-token",
            refresh_token="sensitive-youtube-refresh-token",
            scope="read",
        )
        db_session.add(conn)
        db_session.commit()

        token = generate_extension_token(user.id)

        resp = app_client.get("/api/auth/export", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        raw_text = resp.text

        # Must NOT leak credentials
        assert "sensitive-youtube-access-token" not in raw_text
        assert "sensitive-youtube-refresh-token" not in raw_text
        assert "argon2id" not in raw_text
        assert "access_token" not in resp.json()["connections"][0]
        assert "refresh_token" not in resp.json()["connections"][0]


# ===========================================================================
# 4. INPUT VALIDATION & ABUSE PROTECTION
# ===========================================================================

class TestInputValidationAndAbuse:
    """Verifies that invalid requests and abuse vectors are rejected."""

    def test_unsupported_file_extension_rejected(self, app_client):
        """Uploading unsupported file types must return 400."""
        reg = app_client.post(
            "/api/auth/register",
            json={"email": "upload_user@example.com", "password": "password123"},
        )
        assert reg.status_code == 200

        files = {"file": ("malicious.exe", b"binarycontent", "application/octet-stream")}
        resp = app_client.post("/api/history/import", files=files)
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]

    def test_pagination_limits_enforced(self, app_client):
        """Pagination limits must enforce bounds (e.g. limit between 1 and 10000)."""
        reg = app_client.post(
            "/api/auth/register",
            json={"email": "paging_user@example.com", "password": "password123"},
        )
        assert reg.status_code == 200

        resp_too_large = app_client.get("/api/history/events?limit=999999")
        assert resp_too_large.status_code == 400
        assert "limit must be between" in resp_too_large.json()["detail"]

        resp_zero = app_client.get("/api/history/events?limit=0")
        assert resp_zero.status_code == 400


# ===========================================================================
# 5. PRIVACY & DATA LIFECYCLE
# ===========================================================================

class TestPrivacyAndLifecycle:
    """Verifies provider disconnection and account deletion workflows."""

    def test_disconnect_provider_removes_tokens(self, app_client, db_session):
        """Disconnecting a provider deletes the stored credentials."""
        user = User(email="disconnect_user@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        conn = Connection(
            user_id=user.id,
            provider="spotify",
            access_token="tok1",
            refresh_token="tok2",
        )
        db_session.add(conn)
        db_session.commit()

        token = generate_extension_token(user.id)
        user_id = user.id

        resp = app_client.delete(
            "/api/auth/connections/spotify",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Verify connection row is deleted
        c = db_session.query(Connection).filter(Connection.user_id == user_id, Connection.provider == "spotify").first()
        assert c is None

    def test_delete_account_removes_all_user_data(self, app_client, db_session):
        """Account deletion permanently deletes user and all associated records."""
        user = User(email="delete_me@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        uid = user.id

        event = HistoryEvent(user_id=uid, timestamp=datetime.utcnow(), source="youtube", title="V", event_hash="dh1")
        conn = Connection(user_id=uid, provider="youtube", access_token="t1")
        analysis = AnalysisResult(user_id=uid, source="youtube", analysis_json="{}")
        job = PortabilityExportJob(user_id=uid, archive_job_id="job_del", status="READY")
        db_session.add_all([event, conn, analysis, job])
        db_session.commit()

        token = generate_extension_token(uid)

        resp = app_client.delete(
            "/api/auth/account",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Verify all records for this user are completely deleted
        assert db_session.query(User).filter(User.id == uid).first() is None
        assert db_session.query(HistoryEvent).filter(HistoryEvent.user_id == uid).count() == 0
        assert db_session.query(Connection).filter(Connection.user_id == uid).count() == 0
        assert db_session.query(AnalysisResult).filter(AnalysisResult.user_id == uid).count() == 0
        assert db_session.query(PortabilityExportJob).filter(PortabilityExportJob.user_id == uid).count() == 0


# ===========================================================================
# 6. WEBSOCKET AUTHENTICATION & SCOPING
# ===========================================================================

class TestWebSocketSecurity:
    """Verifies that WebSocket endpoints reject unauthenticated connections."""

    def test_websocket_unauthenticated_rejected(self, app_client):
        """WebSocket connection without token or valid session must be rejected with 1008 Policy Violation."""
        with pytest.raises(Exception):
            with app_client.websocket_connect("/ws/analysis") as ws:
                ws.send_text(json.dumps({"type": "ping"}))

    def test_websocket_authenticated_with_token(self, app_client, db_session):
        """WebSocket connection with valid extension sync token connects successfully."""
        user = User(email="ws_test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        uid = user.id

        token = generate_extension_token(uid)
        with app_client.websocket_connect(f"/ws/analysis?token={token}") as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg.get("type") == "pong"
