from __future__ import annotations

import json
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer
from fastapi import APIRouter, Depends, HTTPException, Request
from redis.asyncio import Redis

from ims.api.deps import get_producer, get_redis, get_settings
from ims.api.rate_limit import enforce_rate_limit
from ims.api.schemas import SignalIn, SignalQueuedOut
from ims.config import Settings


router = APIRouter()


@router.post("/signals", status_code=202, response_model=SignalQueuedOut)
async def ingest_signal(
    signal: SignalIn,
    request: Request,
    settings: Settings = Depends(get_settings),
    redis: Redis = Depends(get_redis),
    producer: AIOKafkaProducer = Depends(get_producer),
) -> SignalQueuedOut:
    await enforce_rate_limit(request=request, redis=redis, settings=settings)

    now = datetime.now(timezone.utc)
    payload = signal.model_dump(mode="json", exclude_none=True)
    payload["ts"] = payload.get("ts") or now.isoformat()
    payload["received_at"] = now.isoformat()
    
    import uuid
    event_id = signal.event_id or str(uuid.uuid4())
    payload["event_id"] = event_id

    import asyncio
    max_retries = 3
    base_delay = 0.1
    
    for attempt in range(max_retries):
        try:
            await producer.send_and_wait(
                settings.kafka_topic_signals,
                json.dumps(payload).encode("utf-8"),
                key=signal.component_id.encode("utf-8"),
            )
            break
        except Exception as exc:
            if attempt == max_retries - 1:
                # Fallback to Redis buffer if Kafka is unreachable after retries
                print(f"[api] Kafka send failed after retries, falling back to Redis buffer: {exc}")
                await redis.rpush("buffer:signals", json.dumps(payload))
            else:
                await asyncio.sleep(base_delay * (2 ** attempt))

    await request.app.state.ingest_counter.inc(1)
    return SignalQueuedOut(status="queued", queued_at=now, event_id=event_id)
