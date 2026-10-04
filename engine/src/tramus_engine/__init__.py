"""Tramus engine: video decoding, mouse tracking, zone analysis, storage and the local API."""

# Release builds stamp the real version here (scripts/set-version.mjs, run by the Release
# workflow). The desktop app overrides what analyses and exports record with its full version
# (build number included) via TRAMUS_APP_VERSION; see services/system.py.
__version__ = "0.0.0-dev"
