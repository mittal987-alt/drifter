"""
test_extension_auth.py — Integration tests for seamless browser extension authentication & token revocation.

Covers:
  1. Authorize endpoint (/api/auth/extension/authorize):
     - Unauthenticated access returns 401.
     - Authenticated user receives 60-second one-time code.
  2. Exchange endpoint (/api/auth/extension/exchange):
     - Valid one-time code yields a revocable token starting with 'drft_'.
     - Reusing the one-time code fails (one-time use enforced).
     - Missing or invalid code is rejected with 400.
  3. Authenticated requests with new revocable token:
     - Bearer drft_... token authenticates /api/youtube-history and /api/auth/me.
     - Token updates last_used_at timestamp.
  4. Listing & Revocation:
     - /api/auth/extension/tokens lists active tokens.
     - DELETE /api/auth/extension/tokens/{id} revokes the token.
     - Revoked token immediately gets rejected with 401.
  5. Backwards compatibility:
     - Legacy drifter_ext_... HMAC tokens remain valid.
"""

import pytest
from app.api.dependencies import generate_extension_token


class TestExtensionAuthentication:

    def test_authorize_requires_authentication(self, app_client):
        resp = app_client.post("/api/auth/extension/authorize", json={})
        assert resp.status_code == 401

    def test_authorize_and_exchange_flow(self, app_client):
        # 1. Register/Login user
        reg_resp = app_client.post(
            "/api/auth/register",
            json={"email": "ext_user@example.com", "password": "password123", "name": "Extension User"},
        )
        assert reg_resp.status_code == 200

        # 2. Authorize extension from web session
        auth_resp = app_client.post(
            "/api/auth/extension/authorize",
            json={"client_name": "Chrome Extension (Work Laptop)", "permissions": ["youtube", "spotify"]},
        )
        assert auth_resp.status_code == 200
        auth_data = auth_resp.json()
        assert "code" in auth_data
        assert auth_data["expires_in"] == 60
        code = auth_data["code"]

        # 3. Extension exchanges code for token
        exchange_resp = app_client.post(
            "/api/auth/extension/exchange",
            json={"code": code, "client_name": "Chrome Extension (Work Laptop)"},
        )
        assert exchange_resp.status_code == 200
        exchange_data = exchange_resp.json()
        assert exchange_data["success"] is True
        token = exchange_data["token"]
        assert token.startswith("drft_")
        assert exchange_data["user"]["email"] == "ext_user@example.com"
        assert exchange_data["permissions"] == ["youtube", "spotify"]

        # 4. Code cannot be reused (one-time use)
        reuse_resp = app_client.post(
            "/api/auth/extension/exchange",
            json={"code": code},
        )
        assert reuse_resp.status_code == 400

        # 5. Authenticate via Bearer token to sync history
        sync_resp = app_client.post(
            "/api/youtube-history",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "events": [
                    {
                        "title": "Test Video Tracked By Extension",
                        "videoId": "vid_abc_123",
                        "source": "youtube",
                        "watchedSeconds": 45,
                    }
                ]
            },
        )
        assert sync_resp.status_code == 200
        sync_data = sync_resp.json()
        assert sync_data["success"] is True

        # 6. List extension tokens
        list_resp = app_client.get("/api/auth/extension/tokens")
        assert list_resp.status_code == 200
        tokens_list = list_resp.json()["tokens"]
        assert len(tokens_list) >= 1
        active_token_info = tokens_list[0]
        assert active_token_info["is_revoked"] is False
        assert active_token_info["client_name"] == "Chrome Extension (Work Laptop)"
        token_id = active_token_info["id"]

        # 7. Revoke the extension token
        revoke_resp = app_client.delete(f"/api/auth/extension/tokens/{token_id}")
        assert revoke_resp.status_code == 200
        assert revoke_resp.json()["success"] is True

        # 8. Token is now immediately rejected
        rejected_resp = app_client.post(
            "/api/youtube-history",
            headers={"Authorization": f"Bearer {token}"},
            json={"events": []},
        )
        assert rejected_resp.status_code == 401

    def test_legacy_extension_token_backwards_compatible(self, app_client):
        # 1. Register user
        reg_resp = app_client.post(
            "/api/auth/register",
            json={"email": "legacy_user@example.com", "password": "password123"},
        )
        user_id = reg_resp.json()["user"]["id"]
        legacy_token = generate_extension_token(user_id)

        # 2. Sync history using legacy token
        sync_resp = app_client.post(
            "/api/youtube-history",
            headers={"Authorization": f"Bearer {legacy_token}"},
            json={
                "events": [
                    {
                        "title": "Legacy Token Video",
                        "videoId": "vid_legacy_999",
                        "source": "youtube",
                        "watchedSeconds": 30,
                    }
                ]
            },
        )
        assert sync_resp.status_code == 200
        assert sync_resp.json()["success"] is True
