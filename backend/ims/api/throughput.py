from __future__ import annotations

import asyncio


class ThroughputCounter:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._count = 0

    async def inc(self, n: int = 1) -> None:
        async with self._lock:
            self._count += n

    async def snapshot_and_reset(self) -> int:
        async with self._lock:
            value = self._count
            self._count = 0
            return value
