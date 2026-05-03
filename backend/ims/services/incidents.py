from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorCollection
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ims.api.schemas import IncidentOut, RCAIn
from ims.cache import active_incident_key, cache_incident, incident_snapshot, remove_active_incident
from ims.config import Settings
from ims.db.models import RCA, IncidentEvent, WorkItem, WorkItemState
from ims.domain.alerts import severity_rank
from ims.domain.rca import can_close_incident, is_rca_complete
from ims.domain.state_machine import TransitionContext, TransitionError, transition_or_raise


def normalize_signal(doc: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = dict(doc)
    _id = normalized.get("_id")
    if isinstance(_id, ObjectId):
        normalized["_id"] = str(_id)
    ts = normalized.get("ts")
    if isinstance(ts, datetime):
        normalized["ts"] = ts.isoformat()
    return normalized


async def list_cached_incidents(settings: Settings, redis: Redis) -> list[IncidentOut]:
    ids = await redis.smembers(settings.dashboard_active_set)
    if not ids:
        return []

    keys = [f"{settings.dashboard_incident_prefix}{incident_id}" for incident_id in ids]
    raw = await redis.mget(keys)

    incidents: list[IncidentOut] = []
    for item in raw:
        if not item:
            continue
        try:
            data = json.loads(item)
            incidents.append(IncidentOut.model_validate(data))
        except Exception:
            continue

    incidents.sort(key=lambda i: (severity_rank(i.severity), -i.updated_at.timestamp()))
    return incidents


async def get_incident(db: AsyncSession, incident_id: uuid.UUID) -> WorkItem:
    result = await db.execute(
        select(WorkItem).where(WorkItem.id == incident_id).options(selectinload(WorkItem.rca))
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


async def list_signals(signals: AsyncIOMotorCollection, incident_id: uuid.UUID, *, limit: int = 200) -> list[dict[str, Any]]:
    cursor = signals.find({"work_item_id": str(incident_id)}).sort("ts", -1).limit(limit)
    raw_signals = await cursor.to_list(length=limit)
    return [normalize_signal(doc) for doc in raw_signals]


async def transition_incident(
    *,
    settings: Settings,
    redis: Redis,
    db: AsyncSession,
    incident_id: uuid.UUID,
    to_state: WorkItemState,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkItem)
        .where(WorkItem.id == incident_id)
        .options(selectinload(WorkItem.rca))
        .with_for_update()
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    ctx = TransitionContext()
    if to_state == WorkItemState.CLOSED:
        rca = incident.rca
        rca_complete = (
            False
            if rca is None
            else is_rca_complete(
                start_time=rca.start_time,
                end_time=rca.end_time,
                root_cause_category=rca.root_cause_category,
                fix_applied=rca.fix_applied,
                prevention_steps=rca.prevention_steps,
            )
        )
        ctx = TransitionContext(rca_present=rca is not None, rca_complete=rca_complete)

    try:
        transition_or_raise(from_state=incident.state, to_state=to_state, ctx=ctx)
    except TransitionError as exc:
        if to_state == WorkItemState.CLOSED and not can_close_incident(rca_present=ctx.rca_present, rca_complete=ctx.rca_complete):
            raise HTTPException(status_code=400, detail="RCA is missing or incomplete; cannot close incident") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    prev_state = incident.state
    incident.state = to_state
    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Audit log
    db.add(IncidentEvent(
        work_item_id=incident.id,
        event_type="STATE_CHANGE",
        prev_state=prev_state.value,
        new_state=to_state.value,
        detail=f"Transitioned from {prev_state.value} to {to_state.value}",
    ))
    await db.flush()

    snapshot = incident_snapshot(incident)
    if incident.state == WorkItemState.CLOSED:
        await remove_active_incident(redis, settings, incident.id)
        await redis.delete(active_incident_key(settings, incident.component_id))
    else:
        await cache_incident(redis, settings, snapshot)
        await redis.set(active_incident_key(settings, incident.component_id), str(incident.id), ex=24 * 3600)
        
    await redis.publish("channel:incidents:updates", json.dumps(snapshot))

    return snapshot


async def upsert_rca(
    *,
    settings: Settings,
    redis: Redis,
    db: AsyncSession,
    incident_id: uuid.UUID,
    body: RCAIn,
) -> dict[str, Any]:
    result = await db.execute(
        select(WorkItem)
        .where(WorkItem.id == incident_id)
        .options(selectinload(WorkItem.rca))
        .with_for_update()
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc)
    start_time = body.start_time or incident.start_time
    end_time = body.end_time or now

    if not is_rca_complete(
        start_time=start_time,
        end_time=end_time,
        root_cause_category=body.root_cause_category,
        fix_applied=body.fix_applied,
        prevention_steps=body.prevention_steps,
    ):
        raise HTTPException(status_code=400, detail="RCA is incomplete (all fields required; end_time >= start_time)")

    if incident.rca is None:
        incident.rca = RCA(
            work_item_id=incident.id,
            start_time=start_time,
            end_time=end_time,
            root_cause_category=body.root_cause_category or "",
            fix_applied=body.fix_applied or "",
            prevention_steps=body.prevention_steps or "",
            submitted_at=now,
        )
        db.add(incident.rca)
    else:
        incident.rca.start_time = start_time
        incident.rca.end_time = end_time
        incident.rca.root_cause_category = body.root_cause_category or incident.rca.root_cause_category
        incident.rca.fix_applied = body.fix_applied or incident.rca.fix_applied
        incident.rca.prevention_steps = body.prevention_steps or incident.rca.prevention_steps
        incident.rca.submitted_at = now

    incident.end_time = end_time
    incident.mttr_seconds = int((now - incident.start_time).total_seconds())
    incident.updated_at = now
    await db.flush()

    # Audit log
    db.add(IncidentEvent(
        work_item_id=incident.id,
        event_type="RCA_SUBMITTED",
        detail=f"RCA submitted: {body.root_cause_category}",
    ))
    await db.flush()

    snapshot = incident_snapshot(incident)
    await cache_incident(redis, settings, snapshot)
    await redis.publish("channel:incidents:updates", json.dumps(snapshot))
    return snapshot
