from __future__ import annotations

from redis.asyncio import Redis
from redis.asyncio import from_url

from ims.config import Settings


def create_redis(settings: Settings) -> Redis:
    return from_url(settings.redis_url, decode_responses=True)
