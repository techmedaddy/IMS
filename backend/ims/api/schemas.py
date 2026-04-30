from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from ims.db.models import WorkItemState


class SignalIn(BaseModel):
    component_id: str = Field(min_length=1, max_length=200)
    component_type: str = Field(min_length=1, max_length=50)
    message: str | None = Field(default=None, max_length=500)
    payload: dict[str, Any] | None = None
    ts: datetime | None = None


class SignalQueuedOut(BaseModel):
    status: str
    queued_at: datetime


class IncidentOut(BaseModel):
    id: uuid.UUID
    component_id: str
    component_type: str
    severity: str
    state: WorkItemState
    start_time: datetime
    end_time: datetime | None
    mttr_seconds: int | None
    created_at: datetime
    updated_at: datetime


class IncidentDetailOut(BaseModel):
    incident: IncidentOut
    signals: list[dict[str, Any]]
    rca: dict[str, Any] | None


class TransitionIn(BaseModel):
    to_state: WorkItemState


class RCAIn(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None
    root_cause_category: str | None = None
    fix_applied: str | None = None
    prevention_steps: str | None = None
