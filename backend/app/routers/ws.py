"""WebSocket endpoint used for real-time updates (notifications, sample
status changes, instrument QC alerts, etc.) - see app/services/realtime.py
for the pub/sub design rationale."""

import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.security import decode_token
from app.services.realtime import hub

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/notifications")
async def notifications_socket(websocket: WebSocket, token: str) -> None:
    try:
        payload = decode_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    topic = f"notifications:{user_id}"
    await hub.connect(topic, websocket)
    try:
        while True:
            # Clients don't need to send anything; keep the connection open
            # and drop it cleanly if the browser tab closes.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(topic, websocket)
