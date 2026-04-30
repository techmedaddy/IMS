from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from redis.asyncio import Redis

from ims.config import Settings
from ims.db.models import WorkItem


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def incident_snapshot(incident: WorkItem) -> dict[str, Any]:
    return {
        "id": str(incident.id),
        "component_id": incident.component_id,
        "component_type": incident.component_type,
        "severity": incident.severity,
        "state": incident.state.value,
        "start_time": _dt(incident.start_time),
        "end_time": _dt(incident.end_time),
        "mttr_seconds": incident.mttr_seconds,
        "created_at": _dt(incident.created_at),
        "updated_at": _dt(incident.updated_at),
    }


def incident_key(settings: Settings, incident_id: uuid.UUID | str) -> str:
    return f"{settings.dashboard_incident_prefix}{incident_id}"


def active_incident_key(settings: Settings, component_id: str) -> str:
    return f"{settings.active_incident_prefix}{component_id}"


async def cache_incident(redis: Redis, settings: Settings, snapshot: dict[str, Any]) -> None:
    incident_id = snapshot["id"]
    pipe = redis.pipeline()
    pipe.set(incident_key(settings, incident_id), json.dumps(snapshot))
    pipe.sadd(settings.dashboard_active_set, incident_id)
    await pipe.execute()


async def remove_active_incident(redis: Redis, settings: Settings, incident_id: uuid.UUID | str) -> None:
    incident_id_str = str(incident_id)
    pipe = redis.pipeline()
    pipe.srem(settings.dashboard_active_set, incident_id_str)
    await pipe.execute()
