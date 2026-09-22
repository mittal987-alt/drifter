import hashlib
import hmac
from fastapi import Request

from app.config import settings
from app.database.database import SessionLocal
from app.database.models import User


def generate_extension_token(user_id: int) -> str:
    """Generate a signed sync token for the Chrome extension."""
    sig = hmac.new(
        settings.SESSION_SECRET.encode(),
        f"ext_{user_id}".encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"drifter_ext_{user_id}_{sig}"


def verify_extension_token(token: str) -> int | None:
    """Verify an extension sync token and return the associated user_id."""
    if not token:
        return None

    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    if not clean_token.startswith("drifter_ext_"):
        return None

    try:
        parts = clean_token.split("_")
        if len(parts) >= 4:
            user_id = int(parts[2])
            sig = parts[3]
            expected_sig = hmac.new(
                settings.SESSION_SECRET.encode(),
                f"ext_{user_id}".encode(),
                hashlib.sha256,
            ).hexdigest()[:16]
            if hmac.compare_digest(sig, expected_sig):
                return user_id
    except Exception:
        pass
    return None


def get_current_user_id(
    request: Request,
) -> int:
    """
    Get current user ID from Authorization header, X-Sync-Token header, or session.
    If no valid session/token exists, automatically creates/uses a default user account.
    """
    # 1. Check Bearer token / X-Sync-Token header
    auth_header = request.headers.get("authorization") or request.headers.get("x-sync-token")
    if auth_header:
        token_user_id = verify_extension_token(auth_header)
        if token_user_id:
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == token_user_id).first()
                if user:
                    return int(user.id)
                primary_user = db.query(User).order_by(User.id.asc()).first()
                if primary_user:
                    return int(primary_user.id)
            finally:
                db.close()

    # 2. Check session
    user_id = request.session.get("user_id")

    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                return int(user.id)

        # Always fallback to the primary (lowest id) user containing all imported history
        primary_user = db.query(User).order_by(User.id.asc()).first()
        if not primary_user:
            primary_user = User()
            db.add(primary_user)
            db.commit()
            db.refresh(primary_user)

        request.session["user_id"] = primary_user.id
        return int(primary_user.id)
    finally:
        db.close()