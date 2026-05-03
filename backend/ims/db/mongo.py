from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection

from ims.config import Settings


def create_mongo_client(settings: Settings) -> AsyncIOMotorClient:
    return AsyncIOMotorClient(settings.mongo_uri)


def signals_collection(client: AsyncIOMotorClient, settings: Settings) -> AsyncIOMotorCollection:
    return client[settings.mongo_db]["signals"]

async def init_mongo(client: AsyncIOMotorClient, settings: Settings) -> None:
    db = client[settings.mongo_db]
    await db.signals.create_index("event_id", unique=True, sparse=True)
