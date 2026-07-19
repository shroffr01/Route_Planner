"""Thin Redis cache wrapper. Failures fall through to the upstream — caching is never on the critical path."""
from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable
from typing import Any

import redis.asyncio as aioredis

from app.logging import log

# How long to stop retrying Redis after a connection failure. Without this,
# every cache miss re-attempts a connection — and a failed TCP connect can
# take seconds (e.g. ~4s on Windows for a refused localhost connection),
# which serializes on the event loop and turns a handful of cache lookups
# into many extra seconds of latency.
RECONNECT_BACKOFF_S = 30.0
CONNECT_TIMEOUT_S = 0.5


class Cache:
    def __init__(self, url: str) -> None:
        self._url = url
        self._client: aioredis.Redis | None = None
        self._retry_at: float = 0.0

    async def client(self) -> aioredis.Redis | None:
        if self._client is None:
            now = time.monotonic()
            if now < self._retry_at:
                return None
            try:
                self._client = aioredis.from_url(
                    self._url,
                    decode_responses=True,
                    socket_connect_timeout=CONNECT_TIMEOUT_S,
                    socket_timeout=CONNECT_TIMEOUT_S,
                )
                await self._client.ping()
            except Exception as e:
                log.warning("redis_unavailable", error=str(e))
                self._client = None
                self._retry_at = now + RECONNECT_BACKOFF_S
        return self._client

    async def get_json(self, key: str) -> Any | None:
        client = await self.client()
        if client is None:
            return None
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception as e:
            log.warning("redis_get_failed", key=key, error=str(e))
            return None

    async def set_json(self, key: str, value: Any, ttl_s: int) -> None:
        client = await self.client()
        if client is None:
            return
        try:
            await client.set(key, json.dumps(value, default=str), ex=ttl_s)
        except Exception as e:
            log.warning("redis_set_failed", key=key, error=str(e))


async def cache_or_fetch(
    cache: Cache,
    key: str,
    ttl_s: int,
    fetch: Callable[[], Awaitable[Any]],
) -> Any:
    """Get-or-set helper. Two-tier: process-local LRU first, then Redis. If both miss,
    call fetch() and populate both. Local LRU makes repeat queries instant even when
    Redis is offline."""
    from app.services.memcache import _global as _mem

    local = _mem.get(key)
    if local is not None:
        return local

    hit = await cache.get_json(key)
    if hit is not None:
        _mem.set(key, hit, ttl_s)
        log.debug("cache_hit_redis", key=key)
        return hit

    value = await fetch()
    _mem.set(key, value, ttl_s)
    await cache.set_json(key, value, ttl_s)
    return value
