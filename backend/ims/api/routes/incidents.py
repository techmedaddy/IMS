from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorCollection
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ims.api.deps import get_db, get_redis, get_settings, get_signals_collection
from ims.api.schemas import IncidentDetailOut, IncidentEventOut, IncidentOut, NoteIn, RCAIn, TransitionIn
from ims.cache import incident_snapshot
from ims.config import Settings
from ims.db.models import IncidentEvent, WorkItem
from ims.services.incidents import get_incident, list_cached_incidents, list_signals, transition_incident, upsert_rca

import json

router = APIRouter()

@router.get("/incidents", response_model=list[IncidentOut])
async def list_incidents(
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
) -> list[IncidentOut]:
    return await list_cached_incidents(settings, redis)


@router.get("/incidents/{incident_id}", response_model=IncidentDetailOut)
async def incident_detail(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    signals: AsyncIOMotorCollection = Depends(get_signals_collection),
) -> IncidentDetailOut:
    result = await db.execute(
        select(WorkItem)
        .where(WorkItem.id == incident_id)
        .options(selectinload(WorkItem.rca), selectinload(WorkItem.events))
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found")

    normalized_signals = await list_signals(signals, incident_id, limit=200)

    rca_out: dict[str, Any] | None = None
    if incident.rca is not None:
        rca_out = {
            "start_time": incident.rca.start_time.isoformat(),
            "end_time": incident.rca.end_time.isoformat(),
            "root_cause_category": incident.rca.root_cause_category,
            "fix_applied": incident.rca.fix_applied,
            "prevention_steps": incident.rca.prevention_steps,
            "submitted_at": incident.rca.submitted_at.isoformat(),
        }

    timeline = [
        IncidentEventOut(
            id=e.id,
            work_item_id=e.work_item_id,
            event_type=e.event_type,
            prev_state=e.prev_state,
            new_state=e.new_state,
            actor=e.actor,
            detail=e.detail,
            timestamp=e.timestamp,
        )
        for e in incident.events
    ]

    return IncidentDetailOut(
        incident=IncidentOut.model_validate(incident_snapshot(incident)),
        signals=normalized_signals,
        rca=rca_out,
        timeline=timeline,
    )


@router.get("/incidents/{incident_id}/events", response_model=list[IncidentEventOut])
async def list_events(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[IncidentEventOut]:
    result = await db.execute(
        select(IncidentEvent)
        .where(IncidentEvent.work_item_id == incident_id)
        .order_by(IncidentEvent.timestamp)
    )
    return [
        IncidentEventOut(
            id=e.id,
            work_item_id=e.work_item_id,
            event_type=e.event_type,
            prev_state=e.prev_state,
            new_state=e.new_state,
            actor=e.actor,
            detail=e.detail,
            timestamp=e.timestamp,
        )
        for e in result.scalars().all()
    ]


@router.post("/incidents/{incident_id}/notes", response_model=IncidentEventOut)
async def add_note(
    incident_id: uuid.UUID,
    body: NoteIn,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> IncidentEventOut:
    event = IncidentEvent(
        work_item_id=incident_id,
        event_type="NOTE_ADDED",
        actor="operator",
        detail=body.text,
    )
    db.add(event)
    await db.flush()

    await redis.publish("channel:incidents:updates", json.dumps({
        "type": "note_added",
        "incident_id": str(incident_id),
        "detail": body.text,
    }))

    return IncidentEventOut(
        id=event.id,
        work_item_id=event.work_item_id,
        event_type=event.event_type,
        prev_state=event.prev_state,
        new_state=event.new_state,
        actor=event.actor,
        detail=event.detail,
        timestamp=event.timestamp,
    )


@router.post("/incidents/{incident_id}/transition", response_model=IncidentOut)
async def transition_incident_route(
    incident_id: uuid.UUID,
    body: TransitionIn,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    snapshot = await transition_incident(
        settings=settings, redis=redis, db=db, incident_id=incident_id, to_state=body.to_state
    )
    return IncidentOut.model_validate(snapshot)


@router.post("/incidents/{incident_id}/rca", response_model=IncidentOut)
async def submit_rca(
    incident_id: uuid.UUID,
    body: RCAIn,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    snapshot = await upsert_rca(settings=settings, redis=redis, db=db, incident_id=incident_id, body=body)
    return IncidentOut.model_validate(snapshot)
