from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorCollection
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from ims.api.deps import get_db, get_redis, get_settings, get_signals_collection
from ims.api.schemas import IncidentOut, RCAIn
from ims.cache import incident_snapshot
from ims.config import Settings
from ims.db.models import WorkItemState
from ims.services.incidents import get_incident, list_cached_incidents, list_signals, transition_incident, upsert_rca


router = APIRouter(prefix="/fragments")


def _fmt_dt_local(dt: datetime) -> str:
    # HTML datetime-local expects no timezone; treat values as UTC for this assignment.
    dt_utc = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt_utc.isoformat(timespec="minutes")


def _parse_form_dt(value: str | None) -> datetime | None:
    if not value or not value.strip():
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _next_state(state: WorkItemState) -> WorkItemState | None:
    return {
        WorkItemState.OPEN: WorkItemState.INVESTIGATING,
        WorkItemState.INVESTIGATING: WorkItemState.RESOLVED,
        WorkItemState.RESOLVED: WorkItemState.CLOSED,
    }.get(state)


@router.get("/incidents")
async def incidents_fragment(
    request: Request,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
):
    templates = request.app.state.templates
    incidents = await list_cached_incidents(settings, redis)
    return templates.TemplateResponse("incidents_list.html", {"request": request, "incidents": incidents})


@router.get("/incidents/{incident_id}")
async def incident_fragment(
    request: Request,
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    signals: AsyncIOMotorCollection = Depends(get_signals_collection),
):
    templates = request.app.state.templates

    incident = await get_incident(db, incident_id)
    incident_view = IncidentOut.model_validate(incident_snapshot(incident))
    signals_out = await list_signals(signals, incident_id, limit=200)

    rca = incident.rca
    rca_defaults = {
        "start_time": _fmt_dt_local(incident_view.start_time),
        "end_time": _fmt_dt_local(datetime.now(timezone.utc)),
        "root_cause_category": rca.root_cause_category if rca else "",
        "fix_applied": rca.fix_applied if rca else "",
        "prevention_steps": rca.prevention_steps if rca else "",
    }

    return templates.TemplateResponse(
        "incident_detail.html",
        {
            "request": request,
            "incident": incident_view,
            "signals": signals_out,
            "next_state": _next_state(incident_view.state),
            "rca": rca,
            "rca_defaults": rca_defaults,
        },
    )


@router.post("/incidents/{incident_id}/transition")
async def transition_fragment(
    request: Request,
    incident_id: uuid.UUID,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
    signals: AsyncIOMotorCollection = Depends(get_signals_collection),
):
    form = await request.form()
    to_state_raw = form.get("to_state")
    if not to_state_raw:
        raise HTTPException(status_code=400, detail="Missing to_state")

    try:
        to_state = WorkItemState(str(to_state_raw))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid to_state") from exc

    await transition_incident(settings=settings, redis=redis, db=db, incident_id=incident_id, to_state=to_state)
    return await incident_fragment(request, incident_id, db, signals)


@router.post("/incidents/{incident_id}/rca")
async def rca_fragment(
    request: Request,
    incident_id: uuid.UUID,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
    signals: AsyncIOMotorCollection = Depends(get_signals_collection),
):
    form = await request.form()

    body = RCAIn(
        start_time=_parse_form_dt(form.get("start_time")),
        end_time=_parse_form_dt(form.get("end_time")),
        root_cause_category=form.get("root_cause_category"),
        fix_applied=form.get("fix_applied"),
        prevention_steps=form.get("prevention_steps"),
    )
    await upsert_rca(settings=settings, redis=redis, db=db, incident_id=incident_id, body=body)
    return await incident_fragment(request, incident_id, db, signals)
