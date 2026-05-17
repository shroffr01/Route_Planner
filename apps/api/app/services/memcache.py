"""Process-local LRU+TTL cache. Used as a no-config fallback when Redis is offline."""
from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any


class MemCache:
    def __init__(self, max_entries: int = 2048) -> None:
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._max = max_entries

    def get(self, key: str) -> Any | None:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl_s: int) -> None:
        self._store[key] = (time.time() + ttl_s, value)
        self._store.move_to_end(key)
        while len(self._store) > self._max:
            self._store.popitem(last=False)


_global = MemCache()


async def mem_cache_or_fetch(
    key: str,
    ttl_s: int,
    fetch: Callable[[], Awaitable[Any]],
) -> Any:
    hit = _global.get(key)
    if hit is not None:
        return hit
    value = await fetch()
    _global.set(key, value, ttl_s)
    return value
