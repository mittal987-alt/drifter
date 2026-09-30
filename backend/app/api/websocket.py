"""
WebSocket endpoint for real-time analysis progress.

Connect:  ws://localhost:8000/ws/analysis
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
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active_connections.append(ws)
        logger.info("WS client connected. total=%d", len(self.active_connections))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active_connections:
            self.active_connections.remove(ws)
        logger.info("WS client disconnected. total=%d", len(self.active_connections))

    async def broadcast(self, message: dict) -> None:
        """Broadcast JSON message to all connected clients."""
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


# Singleton — import and use this across the app
manager = ConnectionManager()


@router.websocket("/ws/analysis")
async def ws_analysis(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await manager.send_personal(websocket, {"type": "pong"})
            except asyncio.TimeoutError:
                # Send keepalive ping
                await manager.send_personal(websocket, {"type": "ping"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning("WS error: %s", e)
        manager.disconnect(websocket)
