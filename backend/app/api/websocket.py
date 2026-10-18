"""
WebSocket endpoint for real-time analysis progress with authenticated user-scoping.

Connect:  ws://localhost:8000/ws/analysis?token=<sync_token>
Events:
  - analysis_start          {"type": "analysis_start"}
  - embedding_progress      {"type": "embedding_progress", "progress": 0-100}
  - clustering_done         {"type": "clustering_done"}
  - prediction_done         {"type": "prediction_done"}
  - analysis_done           {"type": "analysis_done"}
  - ping/pong               {"type": "ping"} / {"type": "pong"}
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from itsdangerous import URLSafeTimedSerializer

from app.api.dependencies import verify_extension_token
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """
    Manages active WebSocket connections scoped by authenticated user_id.
    Prevents cross-user data leakage and broadcast pollution.
    """

    def __init__(self) -> None:
        self.user_connections: Dict[int, List[WebSocket]] = {}
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket, user_id: int) -> None:
        await ws.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(ws)
        self.active_connections.append(ws)
        logger.info("WS user=%d connected. user_total=%d all_total=%d",
                    user_id, len(self.user_connections[user_id]), len(self.active_connections))

    def disconnect(self, ws: WebSocket, user_id: Optional[int] = None) -> None:
        if ws in self.active_connections:
            self.active_connections.remove(ws)
        if user_id and user_id in self.user_connections:
            if ws in self.user_connections[user_id]:
                self.user_connections[user_id].remove(ws)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        else:
            # Clean up across any user buckets
            for uid, sockets in list(self.user_connections.items()):
                if ws in sockets:
                    sockets.remove(ws)
                    if not sockets:
                        del self.user_connections[uid]
        logger.info("WS disconnected. remaining_total=%d", len(self.active_connections))

    async def send_to_user(self, user_id: int, message: dict) -> None:
        """Send a JSON message only to the specified user's active sockets."""
        sockets = self.user_connections.get(user_id, [])
        if not sockets:
            return
        data = json.dumps(message)
        dead: List[WebSocket] = []
        for ws in list(sockets):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, message: dict) -> None:
        """Fallback broadcast across all connections."""
        data = json.dumps(message)
        dead: List[WebSocket] = []
        for ws in list(self.active_connections):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_personal(self, ws: WebSocket, message: dict) -> None:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()


def _resolve_ws_user_id(websocket: WebSocket) -> Optional[int]:
    """
    Authenticate WebSocket connection from sync token query parameter,
    Authorization header, or signed session cookie.
    Verifies user is active in the database.
    """
    import base64
    from itsdangerous import TimestampSigner
    from app.database.database import SessionLocal
    from app.database.models import User

    def _verify_user_in_db(uid: int) -> Optional[int]:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == uid).first()
            if user and getattr(user, "is_active", True) is not False:
                return int(user.id)
            return None
        finally:
            db.close()

    # 1. Query param ?token=...
    token = websocket.query_params.get("token")
    if token:
        uid = verify_extension_token(token)
        if uid:
            return _verify_user_in_db(uid)

    # 2. Authorization / X-Sync-Token header
    auth_header = websocket.headers.get("authorization") or websocket.headers.get("x-sync-token")
    if auth_header:
        uid = verify_extension_token(auth_header)
        if uid:
            return _verify_user_in_db(uid)

    # 3. Check session cookie ("drifter_session" or "session")
    session_cookie = websocket.cookies.get("drifter_session") or websocket.cookies.get("session")
    if session_cookie:
        # Starlette SessionMiddleware uses itsdangerous.TimestampSigner + base64 + json
        try:
            signer = TimestampSigner(str(settings.SESSION_SECRET))
            raw_data = signer.unsign(session_cookie.encode("utf-8"), max_age=7 * 24 * 3600)
            data = json.loads(base64.b64decode(raw_data).decode("utf-8"))
            if isinstance(data, dict) and data.get("user_id"):
                return _verify_user_in_db(int(data["user_id"]))
        except Exception:
            pass

        # Fallback to URLSafeTimedSerializer if encoded differently
        try:
            from itsdangerous import URLSafeTimedSerializer
            data = URLSafeTimedSerializer(settings.SESSION_SECRET).loads(session_cookie)
            if isinstance(data, dict) and data.get("user_id"):
                return _verify_user_in_db(int(data["user_id"]))
        except Exception:
            pass

    return None


@router.websocket("/ws/analysis")
async def ws_analysis(websocket: WebSocket):
    user_id = _resolve_ws_user_id(websocket)
    if not user_id:
        # Step 4: reject unauthenticated WebSocket connections
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await manager.send_personal(websocket, {"type": "pong"})
            except asyncio.TimeoutError:
                await manager.send_personal(websocket, {"type": "ping"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.warning("WS error: %s", e)
        manager.disconnect(websocket, user_id)
