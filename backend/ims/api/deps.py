from __future__ import annotations

from collections.abc import AsyncGenerator

from aiokafka import AIOKafkaProducer
from fastapi import Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ims.config import Settings


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_mongo_client(request: Request) -> AsyncIOMotorClient:
    return request.app.state.mongo_client


def get_signals_collection(request: Request) -> AsyncIOMotorCollection:
    return request.app.state.signals_collection


def get_producer(request: Request) -> AIOKafkaProducer:
    return request.app.state.kafka_producer


def get_sessionmaker(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.sessionmaker


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    sessionmaker = get_sessionmaker(request)
    async with sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except:  # noqa: E722
            await session.rollback()
            raise
