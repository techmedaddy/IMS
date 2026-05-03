from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from aiokafka import AIOKafkaProducer
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from ims.api.throughput import ThroughputCounter
from ims.config import get_settings
from ims.db.mongo import create_mongo_client, signals_collection
from ims.db.postgres import create_engine, create_sessionmaker, init_db
from ims.db.redis import create_redis


async def _log_throughput(app: FastAPI) -> None:
    while True:
        await asyncio.sleep(5)
        count = await app.state.ingest_counter.snapshot_and_reset()
        rate = count / 5
        print(f"[api] ingest throughput: {rate:.1f} signals/sec")


async def _drain_fallback_buffer(app: FastAPI) -> None:
    settings = app.state.settings
    redis = app.state.redis
    producer = app.state.kafka_producer
    
    while True:
        await asyncio.sleep(1)
        try:
            # Drain up to 100 messages at a time
            for _ in range(100):
                raw = await redis.lpop("buffer:signals")
                if not raw:
                    break
                
                payload = json.loads(raw)
                component_id = payload.get("component_id", "")
                await producer.send_and_wait(
                    settings.kafka_topic_signals,
                    raw.encode("utf-8") if isinstance(raw, str) else raw,
                    key=component_id.encode("utf-8"),
                )
        except Exception as exc:
            print(f"[api] Error draining fallback buffer: {exc}")
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    engine = create_engine(settings)
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)
    await init_db(engine)

    app.state.redis = create_redis(settings)
    app.state.mongo_client = create_mongo_client(settings)
    app.state.signals_collection = signals_collection(app.state.mongo_client, settings)

    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    app.state.templates = Jinja2Templates(directory=str(templates_dir))

    await app.state.signals_collection.create_index([("component_id", 1), ("ts", -1)])
    await app.state.signals_collection.create_index([("work_item_id", 1), ("ts", -1)])

    app.state.kafka_producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap)
    await app.state.kafka_producer.start()

    app.state.ingest_counter = ThroughputCounter()
    app.state.throughput_task = asyncio.create_task(_log_throughput(app))
    app.state.drain_task = asyncio.create_task(_drain_fallback_buffer(app))

    try:
        yield
    finally:
        app.state.throughput_task.cancel()
        app.state.drain_task.cancel()
        await app.state.kafka_producer.stop()
        await app.state.redis.close()
        app.state.mongo_client.close()
        await engine.dispose()


app = FastAPI(title="IMS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


from ims.api.routes.health import router as health_router  # noqa: E402
from ims.api.routes.metrics import router as metrics_router  # noqa: E402
from ims.api.routes.fragments import router as fragments_router  # noqa: E402
from ims.api.routes.incidents import router as incidents_router  # noqa: E402
from ims.api.routes.signals import router as signals_router  # noqa: E402

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(signals_router, prefix="/api", tags=["signals"])
app.include_router(incidents_router, prefix="/api", tags=["incidents"])
app.include_router(metrics_router, prefix="/api", tags=["metrics"])
app.include_router(fragments_router, tags=["fragments"])
