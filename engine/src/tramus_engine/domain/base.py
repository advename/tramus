"""Shared building blocks for all domain models."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, PlainSerializer


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)


def _to_iso_z(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


UtcDateTime = Annotated[
    datetime,
    AfterValidator(_ensure_utc),
    PlainSerializer(_to_iso_z, return_type=str, when_used="json"),
]
"""A timezone-aware datetime, normalised to UTC and serialised as ISO 8601 with a `Z` suffix."""


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    """Short random identifier for zones, corrections, jobs, templates, …"""
    return uuid.uuid4().hex[:12]


class DomainModel(BaseModel):
    """Base class: snake_case JSON, unknown fields ignored so newer files still load."""

    model_config = ConfigDict(extra="ignore", validate_assignment=True)
