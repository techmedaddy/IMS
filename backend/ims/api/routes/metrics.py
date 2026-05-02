from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ims.api.deps import get_db
from ims.db.models import SignalAggregate, WorkItem, WorkItemState


router = APIRouter()


@router.get("/metrics")
async def metrics(db: AsyncSession = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    open_count = (
        await db.execute(
            select(func.count())
            .select_from(WorkItem)
            .where(WorkItem.state.in_([WorkItemState.OPEN, WorkItemState.INVESTIGATING, WorkItemState.RESOLVED]))
        )
    ).scalar_one()

    mttr_avg = (
        await db.execute(
            select(func.avg(WorkItem.mttr_seconds))
            .select_from(WorkItem)
            .where(WorkItem.mttr_seconds.isnot(None))
            .where(WorkItem.updated_at >= one_hour_ago)
        )
    ).scalar_one()

    signals_last_hour = (
        await db.execute(
            select(func.coalesce(func.sum(SignalAggregate.count), 0))
            .select_from(SignalAggregate)
            .where(SignalAggregate.bucket_start >= one_hour_ago)
        )
    ).scalar_one()

    return {
        "now": now.isoformat(),
        "open_incidents": int(open_count or 0),
        "avg_mttr_seconds_last_hour": None if mttr_avg is None else float(mttr_avg),
        "signals_aggregated_last_hour": int(signals_last_hour or 0),
    }

