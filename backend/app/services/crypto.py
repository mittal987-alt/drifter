"""
crypto.py — Authenticated encryption for sensitive credentials at rest.

Uses cryptography.fernet.Fernet (AES-128-CBC + HMAC-SHA256 authenticated encryption).
Supports:
  - Key versioning (prefix 'v1:')
  - Transparent decryption of legacy plaintext tokens (safe migration)
  - Safe error handling (never crashes on invalid ciphertext; does not expose tokens in exceptions)
  - Key derivation from application secret if dedicated TOKEN_ENCRYPTION_KEY is unset
"""

import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

# Key version prefix
KEY_VERSION_PREFIX = "v1:"


def get_fernet_key() -> bytes:
    """
    Derive or retrieve a valid 32-byte url-safe base64-encoded Fernet key.
    Prefers TOKEN_ENCRYPTION_KEY from settings/environment.
    Falls back to a key derived from SESSION_SECRET with a domain separation salt.
    """
    raw_key = getattr(settings, "TOKEN_ENCRYPTION_KEY", None)
    if raw_key and len(raw_key.strip()) > 0:
        cleaned = raw_key.strip().encode("utf-8")
        # If it's already a valid Fernet key (32 bytes base64 encoded = 44 chars)
        try:
            Fernet(cleaned)
            return cleaned
        except Exception:
            # Derive 32 bytes via SHA-256
            digest = hashlib.sha256(cleaned).digest()
            return base64.urlsafe_b64encode(digest)

    # Derive deterministic key from SESSION_SECRET with domain separation
    secret = settings.SESSION_SECRET.encode("utf-8")
    salt = b"drifter-token-encryption-salt-v1"
    derived = hashlib.pbkdf2_hmac("sha256", secret, salt, 100000)
    return base64.urlsafe_b64encode(derived)


_cached_fernet: Optional[Fernet] = None
_cached_key: Optional[bytes] = None


def _get_cipher() -> Fernet:
    global _cached_fernet, _cached_key
    current_key = get_fernet_key()
    if _cached_fernet is None or _cached_key != current_key:
        _cached_key = current_key
        _cached_fernet = Fernet(current_key)
    return _cached_fernet


def encrypt_token(plain_text: Optional[str]) -> Optional[str]:
    """
    Encrypt a provider token with authenticated encryption.
    Prepends key version prefix (e.g. 'v1:<token>').
    Returns None if plain_text is None or empty.
    """
    if not plain_text:
        return plain_text

    # If it is already encrypted with our version prefix, do not re-encrypt
    if plain_text.startswith(KEY_VERSION_PREFIX):
        return plain_text

    cipher = _get_cipher()
    encrypted_bytes = cipher.encrypt(plain_text.encode("utf-8"))
    return f"{KEY_VERSION_PREFIX}{encrypted_bytes.decode('utf-8')}"


def decrypt_token(cipher_text: Optional[str]) -> Optional[str]:
    """
    Decrypt a stored token.
    If the token does NOT start with a known version prefix (e.g. 'v1:'),
    it is treated as a legacy plaintext token and returned as-is (safe transition).
    Never logs or prints the token value on failure.
    """
    if not cipher_text:
        return cipher_text

    if not cipher_text.startswith(KEY_VERSION_PREFIX):
        # Legacy unencrypted token
        return cipher_text

    payload = cipher_text[len(KEY_VERSION_PREFIX):]
    try:
        cipher = _get_cipher()
        decrypted_bytes = cipher.decrypt(payload.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt provider token: invalid key or corrupted ciphertext.")
        raise ValueError("Provider token decryption failed.")
    except Exception as exc:
        logger.error("Unexpected error during token decryption: %s", type(exc).__name__)
        raise ValueError("Provider token decryption failed.")
