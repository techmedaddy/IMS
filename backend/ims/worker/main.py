from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from aiokafka import AIOKafkaConsumer
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ims.cache import active_incident_key, cache_incident, incident_snapshot
from ims.config import Settings, get_settings
from ims.db.models import SignalAggregate, WorkItem, WorkItemState
from ims.db.mongo import create_mongo_client, signals_collection
from ims.db.postgres import create_engine, create_sessionmaker, init_db, session_scope
from ims.db.redis import create_redis
from ims.domain.alerts import severity_for_component_type


async def _retry(operation, *, attempts: int = 5, base_delay: float = 0.2):
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await operation()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            await asyncio.sleep(base_delay * (2**attempt))
    raise last_exc or RuntimeError("retry failed")


def _parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


@dataclass
class AggregationBuffer:
    lock: asyncio.Lock
    processed: int
    by_bucket: dict[tuple[datetime, str], int]


async def _flush_loop(settings: Settings, sessionmaker: async_sessionmaker[AsyncSession], buffer: AggregationBuffer):
    while True:
        await asyncio.sleep(5)
        async with buffer.lock:
            processed = buffer.processed
            buffer.processed = 0
            batch = buffer.by_bucket
            buffer.by_bucket = defaultdict(int)

        rate = processed / 5
        print(f"[worker] processed throughput: {rate:.1f} signals/sec")

        if not batch:
            continue

        async def _op():
            async with session_scope(sessionmaker) as session:
                for (bucket_start, component_type), count in batch.items():
                    stmt = insert(SignalAggregate).values(
                        bucket_start=bucket_start,
                        component_type=component_type,
                        count=count,
                    )
                    stmt = stmt.on_conflict_do_update(
                        index_elements=[SignalAggregate.bucket_start, SignalAggregate.component_type],
                        set_={"count": SignalAggregate.count + count},
                    )
                    await session.execute(stmt)

        await _retry(_op)


async def _create_work_item(
    *,
    settings: Settings,
    sessionmaker: async_sessionmaker[AsyncSession],
    redis: Redis,
    signals,
    component_id: str,
    component_type: str,
) -> WorkItem:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=settings.debounce_window_seconds)

    first = await signals.find({"component_id": component_id, "ts": {"$gte": window_start}}).sort("ts", 1).limit(1).to_list(1)
    start_time = first[0]["ts"] if first else window_start
    if not isinstance(start_time, datetime):
        start_time = _parse_dt(start_time)

    incident = WorkItem(
        component_id=component_id,
        component_type=component_type,
        severity=severity_for_component_type(component_type),
        state=WorkItemState.OPEN,
        start_time=start_time,
        created_at=now,
        updated_at=now,
    )

    async def _op():
        async with session_scope(sessionmaker) as session:
            session.add(incident)
            await session.flush()

    await _retry(_op)

    await signals.update_many(
        {"component_id": component_id, "ts": {"$gte": window_start}},
        {"$set": {"work_item_id": str(incident.id)}},
    )

    await redis.set(active_incident_key(settings, component_id), str(incident.id), ex=24 * 3600)
    await cache_incident(redis, settings, incident_snapshot(incident))

    print(f"[worker] ALERT {incident.severity} component={component_id} type={component_type} incident_id={incident.id}")
    return incident


async def run_worker() -> None:
    settings = get_settings()

    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    await init_db(engine)

    redis = create_redis(settings)
    mongo_client = create_mongo_client(settings)
    signals = signals_collection(mongo_client, settings)

    consumer = AIOKafkaConsumer(
        settings.kafka_topic_signals,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id=settings.kafka_consumer_group,
        enable_auto_commit=True,
    )
    await consumer.start()

    buffer = AggregationBuffer(lock=asyncio.Lock(), processed=0, by_bucket=defaultdict(int))
    flush_task = asyncio.create_task(_flush_loop(settings, sessionmaker, buffer))

    try:
        async for msg in consumer:
            data = json.loads(msg.value.decode("utf-8"))
            component_id = str(data.get("component_id", "")).strip()
            component_type = str(data.get("component_type", "")).strip()
            if not component_id or not component_type:
                continue

            ts = _parse_dt(data.get("ts"))
            active_id = await redis.get(active_incident_key(settings, component_id))

            doc = {
                "component_id": component_id,
                "component_type": component_type,
                "ts": ts,
                "message": data.get("message"),
                "payload": data.get("payload"),
                "received_at": _parse_dt(data.get("received_at")),
                "work_item_id": active_id,
            }
            await signals.insert_one(doc)

            async with buffer.lock:
                buffer.processed += 1
                bucket = ts.replace(second=0, microsecond=0)
                buffer.by_bucket[(bucket, component_type.upper())] += 1

            # Debounce counters
            count_key = f"debounce:count:{component_id}"
            created_key = f"debounce:created:{component_id}"

            pipe = redis.pipeline()
            pipe.incr(count_key)
            pipe.expire(count_key, settings.debounce_window_seconds)
            count, _ttl = await pipe.execute()

            if count >= settings.debounce_threshold:
                created = await redis.set(created_key, "1", ex=settings.debounce_window_seconds, nx=True)
                if created:
                    await _create_work_item(
                        settings=settings,
                        sessionmaker=sessionmaker,
                        redis=redis,
                        signals=signals,
                        component_id=component_id,
                        component_type=component_type,
                    )
    finally:
        flush_task.cancel()
        await consumer.stop()
        await redis.close()
        mongo_client.close()
        await engine.dispose()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
