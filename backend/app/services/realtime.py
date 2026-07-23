"""Minimal WebSocket pub/sub hub replacing Convex's automatic reactive
query subscriptions.

Convex re-ran subscribed queries and pushed new results to every connected
client automatically. There is no direct equivalent for a hand-rolled
FastAPI + SQL backend, so real-time UI updates instead become explicit:
whenever a router mutates data that another screen cares about, it calls
`hub.publish(topic, message)` and any client subscribed to that topic
receives it immediately over `/ws`.

This in-process implementation is sufficient for a single backend replica.
Running more than one API replica (e.g. behind a load balancer, or in
Kubernetes with >1 pod) requires a shared backplane - swap the in-memory
`_subscribers` dict for Redis Pub/Sub (`redis.asyncio`) or Postgres
`LISTEN/NOTIFY` without changing the public `publish`/`subscribe` contract."""

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, topic: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._subscribers[topic].add(websocket)

    async def disconnect(self, topic: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._subscribers[topic].discard(websocket)

    async def publish(self, topic: str, message: dict) -> None:
        for websocket in list(self._subscribers.get(topic, ())):
            try:
                await websocket.send_json(message)
            except Exception:  # noqa: BLE001 - drop dead connections silently
                await self.disconnect(topic, websocket)


hub = RealtimeHub()
