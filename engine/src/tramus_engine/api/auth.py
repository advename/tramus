"""Token authentication for the HTTP API and the WebSocket.

Every `/api` route requires the token via the `X-Tramus-Token` header (JSON/JPEG requests) or a
`?token=` query parameter (`<img src>` and the WebSocket URL, which can't set headers). The
engine binds to 127.0.0.1 only; the random per-process token is the actual protection since CORS
allows any origin (the renderer runs on a Vite dev URL or `file://`).
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Header, HTTPException, Query, WebSocket, WebSocketException, status


def make_verify_token(token: str) -> Callable[..., None]:
    """A FastAPI dependency: raises 401 unless the request carries the correct token."""

    def verify_token(
        x_tramus_token: str | None = Header(default=None, alias="X-Tramus-Token"),
        token_qs: str | None = Query(default=None, alias="token"),
    ) -> None:
        if (x_tramus_token or token_qs) != token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token."
            )

    return verify_token


def make_verify_ws_token(token: str) -> Callable[[WebSocket], Coroutine[Any, Any, None]]:
    """A FastAPI dependency for the `/api/events` WebSocket route: closes the connection with
    policy-violation (1008) before accepting it if the token is missing or wrong."""

    async def verify_ws_token(websocket: WebSocket) -> None:
        provided = websocket.headers.get("x-tramus-token") or websocket.query_params.get("token")
        if provided != token:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return verify_ws_token
