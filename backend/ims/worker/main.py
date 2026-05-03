from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ims.cache import active_incident_key, cache_incident, incident_snapshot
from ims.config import Settings, get_settings
from ims.db.models import IncidentEvent, SignalAggregate, WorkItem, WorkItemState
import pymongo.errors
from ims.db.mongo import create_mongo_client, init_mongo, signals_collection
from ims.db.postgres import create_engine, create_sessionmaker, init_db, session_scope
from ims.db.redis import create_redis
from ims.domain.alerts import alert_strategy_for_component_type, severity_for_component_type


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
    mongo_docs: list[dict[str, Any]]


async def _flush_loop(
    settings: Settings, sessionmaker: async_sessionmaker[AsyncSession], redis: Redis, buffer: AggregationBuffer, signals_collection
):
    while True:
        await asyncio.sleep(5)
        async with buffer.lock:
            processed = buffer.processed
            buffer.processed = 0
            mongo_batch = buffer.mongo_docs
            buffer.mongo_docs = []

        rate = processed / 5
        try:
            open_incidents = int(await redis.scard(settings.dashboard_active_set))
        except Exception:  # noqa: BLE001
            open_incidents = -1
        print(f"[worker] processed_throughput={rate:.1f} signals/sec open_incidents={open_incidents}")

        if mongo_batch:
            try:
                await signals_collection.insert_many(mongo_batch, ordered=False)
            except pymongo.errors.BulkWriteError:
                # Ignore duplicate key errors for idempotency
                pass
            except Exception as exc:
                print(f"[worker] Mongo batch insert failed: {exc}")

        # Removed SignalAggregate postgres insert


async def _sla_check_loop(
    settings: Settings, sessionmaker: async_sessionmaker[AsyncSession], redis: Redis
):
    """Periodically check for SLA breaches and auto-escalate."""
    while True:
        await asyncio.sleep(60)
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.sla_breach_minutes)
            async with session_scope(sessionmaker) as session:
                result = await session.execute(
                    select(WorkItem)
                    .where(WorkItem.state.in_([WorkItemState.OPEN, WorkItemState.INVESTIGATING]))
                    .where(WorkItem.start_time < cutoff)
                )
                breached = result.scalars().all()

                for incident in breached:
                    escalated = False
                    if incident.severity != "P0":
                        incident.severity = "P0"
                        escalated = True

                    session.add(IncidentEvent(
                        work_item_id=incident.id,
                        event_type="SLA_BREACH",
                        detail=f"SLA breached: open for >{settings.sla_breach_minutes}min"
                              + (" — escalated to P0" if escalated else ""),
                    ))
                    incident.updated_at = datetime.now(timezone.utc)
                    await session.flush()

                    snapshot = incident_snapshot(incident)
                    await cache_incident(redis, settings, snapshot)
                    await redis.publish("channel:incidents:updates", json.dumps(snapshot))

            if breached:
                print(f"[worker] SLA check: {len(breached)} incident(s) breached")
        except Exception as exc:
            print(f"[worker] SLA check error: {exc}")


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
            # DB-level guard: check if an active incident already exists
            existing = (await session.execute(
                select(WorkItem)
                .where(WorkItem.component_id == component_id)
                .where(WorkItem.state != WorkItemState.CLOSED)
            )).scalar_one_or_none()
            
            if existing:
                return existing
                
            session.add(incident)
            from sqlalchemy.exc import IntegrityError
            try:
                await session.flush()
            except IntegrityError:
                await session.rollback()
                # Uniqueness constraint violated, meaning another worker created it
                existing = (await session.execute(
                    select(WorkItem)
                    .where(WorkItem.component_id == component_id)
                    .where(WorkItem.state != WorkItemState.CLOSED)
                )).scalar_one_or_none()
                if existing:
                    return existing
                raise  # Re-raise if it's some other integrity error

            # Audit log: CREATED event
            session.add(IncidentEvent(
                work_item_id=incident.id,
                event_type="CREATED",
                new_state=WorkItemState.OPEN.value,
                detail=f"Incident created for {component_id} ({component_type})",
            ))
            await session.flush()
            return incident

    incident = await _retry(_op)

    await signals.update_many(
        {"component_id": component_id, "ts": {"$gte": window_start}},
        {"$set": {"work_item_id": str(incident.id)}},
    )

    await redis.set(active_incident_key(settings, component_id), str(incident.id), ex=24 * 3600)
    snapshot = incident_snapshot(incident)
    await cache_incident(redis, settings, snapshot)
    await redis.publish("channel:incidents:updates", json.dumps(snapshot))

    alert = alert_strategy_for_component_type(component_type)
    alert.dispatch(component_id=component_id, component_type=component_type, incident_id=str(incident.id))
    return incident


async def run_worker() -> None:
    settings = get_settings()

    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    await init_db(engine)

    redis = create_redis(settings)
    mongo_client = create_mongo_client(settings)
    await init_mongo(mongo_client, settings)
    signals = signals_collection(mongo_client, settings)

    dlq_producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap)
    await dlq_producer.start()

    consumer = AIOKafkaConsumer(
        settings.kafka_topic_signals,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id=settings.kafka_consumer_group,
        enable_auto_commit=True,
    )
    await consumer.start()

    buffer = AggregationBuffer(lock=asyncio.Lock(), processed=0, mongo_docs=[])
    flush_task = asyncio.create_task(_flush_loop(settings, sessionmaker, redis, buffer, signals))
    sla_task = asyncio.create_task(_sla_check_loop(settings, sessionmaker, redis))

    try:
        async for msg in consumer:
            raw_value = msg.value
            try:
                data = json.loads(raw_value.decode("utf-8"))
            except Exception as exc:  # noqa: BLE001
                await dlq_producer.send_and_wait(
                    settings.kafka_topic_dlq,
                    json.dumps(
                        {
                            "error": "json_decode_failed",
                            "reason": str(exc),
                            "raw": raw_value.decode("utf-8", errors="replace"),
                        }
                    ).encode("utf-8"),
                )
                continue
            component_id = str(data.get("component_id", "")).strip()
            component_type = str(data.get("component_type", "")).strip()
            if not component_id or not component_type:
                await dlq_producer.send_and_wait(
                    settings.kafka_topic_dlq,
                    json.dumps(
                        {
                            "error": "missing_fields",
                            "raw": data,
                        }
                    ).encode("utf-8"),
                )
                continue

            ts = _parse_dt(data.get("ts"))
            active_id = await redis.get(active_incident_key(settings, component_id))

            event_id = data.get("event_id")

            doc = {
                "event_id": event_id,
                "component_id": component_id,
                "component_type": component_type,
                "ts": ts,
                "message": data.get("message"),
                "payload": data.get("payload"),
                "received_at": _parse_dt(data.get("received_at")),
                "work_item_id": active_id,
            }
            async with buffer.lock:
                buffer.mongo_docs.append(doc)
                buffer.processed += 1

            bucket = ts.replace(second=0, microsecond=0).isoformat()
            metric_key = f"metrics:signals:{bucket}"
            
            # Latency tracking
            received_at = doc["received_at"]
            latency_ms = int((datetime.now(timezone.utc) - received_at).total_seconds() * 1000)
            latency_sum_key = f"metrics:latency_sum:{bucket}"
            latency_count_key = f"metrics:latency_count:{bucket}"

            # Debounce counters
            count_key = f"debounce:count:{component_id}"
            created_key = f"debounce:created:{component_id}"

            pipe = redis.pipeline()
            pipe.incr(metric_key)
            pipe.expire(metric_key, 3600 * 2)  # Keep metrics for 2 hours
            
            pipe.incrby(latency_sum_key, latency_ms)
            pipe.expire(latency_sum_key, 3600 * 2)
            pipe.incr(latency_count_key)
            pipe.expire(latency_count_key, 3600 * 2)
            
            pipe.incr(count_key)
            pipe.expire(count_key, settings.debounce_window_seconds)
            results = await pipe.execute()
            count = results[-2]  # The result of the incr(count_key)
            if count % 20 == 0 or count >= settings.debounce_threshold:
                print(f"[debug] {component_id} count={count}")

            if count >= settings.debounce_threshold:
                created = await redis.set(created_key, "1", ex=settings.debounce_window_seconds, nx=True)
                print(f"[debug] {component_id} threshold met! created={created}")
                if created:
                    try:
                        await _create_work_item(
                            settings=settings,
                            sessionmaker=sessionmaker,
                            redis=redis,
                            signals=signals,
                            component_id=component_id,
                            component_type=component_type,
                        )
                    except Exception as exc:  # noqa: BLE001
                        await dlq_producer.send_and_wait(
                            settings.kafka_topic_dlq,
                            json.dumps(
                                {
                                    "error": "create_work_item_failed",
                                    "reason": str(exc),
                                    "raw": data,
                                }
                            ).encode("utf-8"),
                        )
    finally:
        flush_task.cancel()
        await consumer.stop()
        await dlq_producer.stop()
        await redis.close()
        mongo_client.close()
        await engine.dispose()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
