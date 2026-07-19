"""FastAPI dependency providers (httpx client, cache, settings)."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI

from app.cache import Cache
from app.config import Settings, get_settings
from app.logging import log


async def _overlay_prewarm_loop(app: FastAPI, settings: Settings) -> None:
    from app.routers.overlay import OVERLAY_REFRESH_INTERVAL_S, refresh_overlay_caches

    while True:
        try:
            await refresh_overlay_caches(app.state.http, app.state.cache, settings)
        except Exception as e:
            log.warning("overlay_prewarm_loop_failed", error=str(e))
        await asyncio.sleep(OVERLAY_REFRESH_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.http = httpx.AsyncClient(
        timeout=settings.http_timeout_s,
        headers={"User-Agent": settings.user_agent},
    )
    app.state.cache = Cache(settings.redis_url)
    prewarm_task = asyncio.create_task(_overlay_prewarm_loop(app, settings))
    try:
        yield
    finally:
        prewarm_task.cancel()
        await app.state.http.aclose()


def get_http(app_state) -> httpx.AsyncClient:  # used via Request below
    return app_state.http


def get_cache(app_state) -> Cache:
    return app_state.cache


# FastAPI-friendly wrappers using Request:
from fastapi import Request


def http_dep(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def cache_dep(request: Request) -> Cache:
    return request.app.state.cache


def settings_dep() -> Settings:
    return get_settings()


HttpDep = Annotated[httpx.AsyncClient, Depends(http_dep)]
CacheDep = Annotated[Cache, Depends(cache_dep)]
SettingsDep = Annotated[Settings, Depends(settings_dep)]
