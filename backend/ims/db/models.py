from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ims.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkItemState(str, enum.Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class WorkItem(Base):
    __tablename__ = "work_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id: Mapped[str] = mapped_column(String(200), index=True)
    component_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(5), index=True)
    state: Mapped[WorkItemState] = mapped_column(Enum(WorkItemState), index=True, default=WorkItemState.OPEN)

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mttr_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    rca: Mapped["RCA | None"] = relationship(back_populates="work_item", uselist=False)
    events: Mapped[list["IncidentEvent"]] = relationship(back_populates="work_item", order_by="IncidentEvent.timestamp")


class RCA(Base):
    __tablename__ = "rcas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_items.id", ondelete="CASCADE"), unique=True, index=True
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    root_cause_category: Mapped[str] = mapped_column(String(200))
    fix_applied: Mapped[str] = mapped_column(Text)
    prevention_steps: Mapped[str] = mapped_column(Text)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    work_item: Mapped[WorkItem] = relationship(back_populates="rca")


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_items.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(50))  # STATE_CHANGE, RCA_SUBMITTED, CREATED, NOTE_ADDED, SLA_BREACH
    prev_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actor: Mapped[str] = mapped_column(String(100), default="system")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    work_item: Mapped[WorkItem] = relationship(back_populates="events")


class SignalAggregate(Base):
    __tablename__ = "signal_aggregates"

    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    component_type: Mapped[str] = mapped_column(String(50), primary_key=True)
    count: Mapped[int] = mapped_column(BigInteger, nullable=False)
