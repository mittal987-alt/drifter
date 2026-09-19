from fastapi import Request

from app.database.database import SessionLocal
from app.database.models import User


def get_current_user_id(
    request: Request,
) -> int:
    """
    Get current logged-in user ID from session.
    If no user session exists, automatically creates a guest user account
    so manual history uploads and dashboard views work seamlessly without forcing Google OAuth.
    """
    user_id = request.session.get("user_id")

    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                return int(user.id)

        # Create guest user if not found or no session
        guest_user = User()
        db.add(guest_user)
        db.commit()
        db.refresh(guest_user)

        request.session["user_id"] = guest_user.id
        return int(guest_user.id)
    finally:
        db.close()