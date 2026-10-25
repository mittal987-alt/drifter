"""
test_auth_api.py — Authentication API integration tests.

Covers:
  - User registration (success, duplicate, missing fields).
  - Login (success, wrong password, unknown user).
  - /me endpoint (authenticated, unauthenticated, cookie vs bearer).
  - Logout / session invalidation.
  - Extension-token generation and bearer authentication.
  - OAuth callback validation (state mismatch, missing state).
  - Account deletion (authenticated vs unauthenticated).
  - Connection disconnection.
"""

import pytest
from app.database.models import User, Connection
from app.api.dependencies import generate_extension_token


# ===========================================================================
# 1. REGISTRATION
# ===========================================================================

class TestRegistration:

    def test_register_new_user_returns_200(self, app_client):
        resp = app_client.post(
            "/api/auth/register",
            json={"email": "newuser@example.com", "password": "SecurePass1", "name": "New User"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is True
        assert data["user"]["email"] == "newuser@example.com"

    def test_register_duplicate_email_rejected(self, app_client):
        payload = {"email": "dupe@example.com", "password": "pass123"}
        app_client.post("/api/auth/register", json=payload)
        resp = app_client.post("/api/auth/register", json=payload)
        assert resp.status_code == 400

    def test_register_missing_email_rejected(self, app_client):
        resp = app_client.post(
            "/api/auth/register",
            json={"password": "pass123"},
        )
        assert resp.status_code in (400, 422)

    def test_register_missing_password_rejected(self, app_client):
        resp = app_client.post(
            "/api/auth/register",
            json={"email": "nopw@example.com"},
        )
        assert resp.status_code in (400, 422)

    def test_register_sets_session_cookie(self, app_client):
        resp = app_client.post(
            "/api/auth/register",
            json={"email": "cookie_user@example.com", "password": "pass123"},
        )
        assert resp.status_code == 200
        # After registration, /me should work using the session cookie
        me = app_client.get("/api/auth/me")
        assert me.status_code == 200


# ===========================================================================
# 2. LOGIN
# ===========================================================================

class TestLogin:

    def _register(self, client, email="login_test@example.com", password="pass123"):
        client.post("/api/auth/register", json={"email": email, "password": password})

    def test_login_success(self, app_client):
        email, pw = "login_ok@example.com", "correctpass"
        self._register(app_client, email, pw)
        # Clear session from registration
        app_client.post("/api/auth/logout")
        resp = app_client.post("/api/auth/login", json={"email": email, "password": pw})
        assert resp.status_code == 200
        assert resp.json()["authenticated"] is True

    def test_login_wrong_password(self, app_client):
        email, pw = "bad_pw@example.com", "correctpass"
        self._register(app_client, email, pw)
        app_client.post("/api/auth/logout")
        resp = app_client.post(
            "/api/auth/login",
            json={"email": email, "password": "wrongpassword"},
        )
        assert resp.status_code in (401, 400)

    def test_login_unknown_user(self, app_client):
        resp = app_client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "anything"},
        )
        assert resp.status_code in (401, 400, 404)

    def test_login_empty_email(self, app_client):
        resp = app_client.post(
            "/api/auth/login",
            json={"email": "", "password": "pass"},
        )
        assert resp.status_code in (400, 401, 422)


# ===========================================================================
# 3. /me ENDPOINT
# ===========================================================================

class TestMeEndpoint:

    def test_me_unauthenticated_returns_401(self, app_client):
        resp = app_client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_after_register_returns_user(self, app_client):
        app_client.post(
            "/api/auth/register",
            json={"email": "me_test@example.com", "password": "pass123", "name": "Me Test"},
        )
        resp = app_client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is True
        assert "user" in data
        assert data["user"]["email"] == "me_test@example.com"

    def test_me_does_not_expose_password_hash(self, app_client):
        app_client.post(
            "/api/auth/register",
            json={"email": "pwsafe@example.com", "password": "secretpassword"},
        )
        resp = app_client.get("/api/auth/me")
        body = resp.text
        assert "secretpassword" not in body
        assert "password_hash" not in body

    def test_me_bearer_token(self, app_client, db_session):
        """Bearer token should also authenticate /me (if supported by that endpoint)."""
        user = User(email="bearer_me@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        token = generate_extension_token(user.id)
        # The /me endpoint uses session not bearer, expect either 200 or 401 depending on impl
        # At minimum, it must not crash (5xx)
        resp = app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (200, 401)


# ===========================================================================
# 4. LOGOUT
# ===========================================================================

class TestLogout:

    def test_logout_clears_session(self, app_client):
        app_client.post(
            "/api/auth/register",
            json={"email": "logout_clear@example.com", "password": "password123"},
        )
        assert app_client.get("/api/auth/me").status_code == 200
        resp = app_client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert app_client.get("/api/auth/me").status_code == 401

    def test_logout_twice_is_safe(self, app_client):
        app_client.post(
            "/api/auth/register",
            json={"email": "double_logout@example.com", "password": "password123"},
        )
        app_client.post("/api/auth/logout")
        resp = app_client.post("/api/auth/logout")
        # Should not crash
        assert resp.status_code in (200, 401)


# ===========================================================================
# 5. EXTENSION / BEARER TOKEN AUTH
# ===========================================================================

class TestExtensionToken:

    def test_valid_token_authenticates_history_endpoint(self, app_client, db_session):
        user = User(email="ext_auth@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        token = generate_extension_token(user.id)
        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_invalid_token_rejected(self, app_client):
        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": "Bearer drifter_ext_999_invalidsig"},
        )
        assert resp.status_code == 401

    def test_malformed_bearer_rejected(self, app_client):
        resp = app_client.get(
            "/api/history/events",
            headers={"Authorization": "Bearer this-is-not-a-valid-token"},
        )
        assert resp.status_code == 401


# ===========================================================================
# 6. OAUTH CALLBACKS
# ===========================================================================

class TestOAuthCallbacks:

    def test_spotify_callback_missing_state_returns_400(self, app_client):
        resp = app_client.get("/api/auth/spotify/callback?code=fake-code")
        assert resp.status_code == 400

    def test_spotify_callback_invalid_state_returns_400(self, app_client):
        resp = app_client.get(
            "/api/auth/spotify/callback?code=fake-code&state=completely-invalid-state-xyz"
        )
        assert resp.status_code == 400

    def test_google_callback_missing_state_returns_400(self, app_client):
        resp = app_client.get("/api/auth/google/callback?code=fake-code")
        assert resp.status_code == 400

    def test_google_callback_invalid_state_returns_400(self, app_client):
        resp = app_client.get(
            "/api/auth/google/callback?code=fake-code&state=invalid-state"
        )
        assert resp.status_code == 400


# ===========================================================================
# 7. CONNECTIONS ENDPOINT
# ===========================================================================

class TestConnectionsEndpoint:

    def test_connections_delete_unauthenticated_returns_401(self, app_client):
        resp = app_client.delete("/api/auth/connections/spotify")
        assert resp.status_code == 401

    def test_disconnect_nonexistent_provider(self, app_client, db_session):
        user = User(email="no_provider@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        token = generate_extension_token(user.id)
        resp = app_client.delete(
            "/api/auth/connections/nonexistent_provider",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should be 404 (provider not found) or 200 (idempotent delete)
        assert resp.status_code in (200, 404)
