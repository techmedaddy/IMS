from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorCollection
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from ims.api.deps import get_db, get_redis, get_settings, get_signals_collection
from ims.api.schemas import IncidentDetailOut, IncidentOut, RCAIn, TransitionIn
from ims.cache import incident_snapshot
from ims.config import Settings
from ims.services.incidents import get_incident, list_cached_incidents, list_signals, transition_incident, upsert_rca


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
    incident = await get_incident(db, incident_id)
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

    return IncidentDetailOut(
        incident=IncidentOut.model_validate(incident_snapshot(incident)),
        signals=normalized_signals,
        rca=rca_out,
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
