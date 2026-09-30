"""Central translation of OS-level errors into HTTP responses.

Folder/file reads throughout the engine (library scanning, probing, sidecar reading,
thumbnails, …) can fail with `PermissionError` when the OS denies access — most commonly
macOS's per-folder privacy protection for Desktop/Documents/Downloads/removable/network
volumes after the user pressed "Don't Allow" on the access prompt. Routes don't need their own
try/excepts for this: `create_app` registers a single handler here that turns any `PermissionError`
raised while handling a request into `403` with a `detail` written for the end user (see
docs/architecture.md §8).
"""

from __future__ import annotations

import platform

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

_MACOS_PERMISSION_DENIED = (
    "macOS blocked Tramus from reading this folder. Allow access in System Settings → "
    "Privacy & Security → Files and Folders, then try again."
)
_GENERIC_PERMISSION_DENIED = (
    "Tramus doesn't have permission to read this folder. Check the folder's permissions, "
    "then try again."
)


def permission_denied_detail() -> str:
    """User-facing text for a `PermissionError` — a macOS folder-access denial on macOS, a
    plain OS-permissions message elsewhere."""
    return _MACOS_PERMISSION_DENIED if platform.system() == "Darwin" else _GENERIC_PERMISSION_DENIED


def register_exception_handlers(app: FastAPI) -> None:
    """Registers the app-wide exception → HTTP translations. Called once by `create_app`."""

    @app.exception_handler(PermissionError)
    async def _permission_denied(_request: Request, _exc: PermissionError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN, content={"detail": permission_denied_detail()}
        )
