from __future__ import annotations

import time

from fastapi import HTTPException, Request
from redis.asyncio import Redis

from ims.config import Settings


async def enforce_rate_limit(*, request: Request, redis: Redis, settings: Settings) -> None:
    now_sec = int(time.time())
    ip = request.client.host if request.client else "unknown"

    ip_key = f"rl:ip:{ip}:{now_sec}"
    global_key = f"rl:global:{now_sec}"

    pipe = redis.pipeline()
    pipe.incr(ip_key)
    pipe.expire(ip_key, 2)
    pipe.incr(global_key)
    pipe.expire(global_key, 2)

    ip_count, _ip_ttl, global_count, _global_ttl = await pipe.execute()

    if ip_count > settings.rate_limit_per_sec_per_ip or global_count > settings.rate_limit_per_sec_global:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
