from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ims.api.deps import get_db, get_redis
from redis.asyncio import Redis
from ims.db.models import WorkItem, WorkItemState


router = APIRouter()


@router.get("/metrics")
async def metrics(db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)) -> dict:
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

    keys = []
    for i in range(60):
        minute = (now - timedelta(minutes=i)).replace(second=0, microsecond=0)
        keys.append(f"metrics:signals:{minute.isoformat()}")

    redis_counts = await redis.mget(keys)
    signals_last_hour = sum(int(c) for c in redis_counts if c is not None)

    return {
        "now": now.isoformat(),
        "open_incidents": int(open_count or 0),
        "avg_mttr_seconds_last_hour": None if mttr_avg is None else float(mttr_avg),
        "signals_aggregated_last_hour": int(signals_last_hour or 0),
    }


@router.get("/metrics/signal-trend")
async def signal_trend(
    minutes: int = 60,
    redis: Redis = Depends(get_redis),
) -> list[dict]:
    minutes = min(max(minutes, 1), 1440)  # Clamp between 1 and 24 hours
    now = datetime.now(timezone.utc)

    keys = []
    timestamps = []
    for i in range(minutes):
        minute = (now - timedelta(minutes=i)).replace(second=0, microsecond=0)
        keys.append(f"metrics:signals:{minute.isoformat()}")
        timestamps.append(minute)

    counts = await redis.mget(keys)

    # Return oldest-first for charting
    result = []
    for ts, count in zip(reversed(timestamps), reversed(counts)):
        result.append({
            "minute": ts.isoformat(),
            "count": int(count) if count is not None else 0,
        })

    return result
