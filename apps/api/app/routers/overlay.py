"""Overlay proxy endpoints: SPC outlooks, WPC ERO, WPC Hazards.

SPC categorical outlooks → proxied GeoJSON (features carry official 'fill'/'stroke' colors).
WPC ERO Day 1/2        → proxied GeoJSON (dn 1-4 = Marginal/Slight/Moderate/High).
WPC Hazards (Day 3-7)  → proxied PNG image (WPC servers lack CORS headers).

All upstream sources (spc.noaa.gov, wpc.ncep.noaa.gov) are slow — often 8-9s per
request. Everything below goes through `cache_or_fetch`, and a background loop
(see `refresh_overlay_caches`, wired up in app.deps.lifespan) keeps every key
warm on a cadence just under its TTL so a user click is always a cache hit.
"""
from __future__ import annotations

import asyncio
import base64

import httpx
from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import Response

from app.cache import Cache, cache_or_fetch
from app.config import Settings
from app.deps import CacheDep, HttpDep, SettingsDep
from app.logging import log

router = APIRouter(prefix="/api/v1/overlay", tags=["overlay"])

SPC_TTL_S = 5 * 60
WPC_TTL_S = 5 * 60
# Refresh just under the TTL so the cache never goes cold between user requests.
OVERLAY_REFRESH_INTERVAL_S = 4 * 60

# Standard CONUS extent for WPC image products:
# [top-left, top-right, bottom-right, bottom-left] as [lon, lat]
_CONUS = [[-130.0, 55.0], [-60.0, 55.0], [-60.0, 20.0], [-130.0, 20.0]]

_ERO_GEOJSON_URLS = {
    1: "https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day1_Latest.geojson",
    2: "https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day2_Latest.geojson",
}

_WPC_HAZARDS_URL = "https://www.wpc.ncep.noaa.gov/threats/final/hazards_d3_7_contours.png"


# ── Upstream fetchers (shared by the route handlers and the pre-warm loop) ──

async def _fetch_spc_geojson(http: httpx.AsyncClient, settings: Settings, day: int):
    url = f"https://www.spc.noaa.gov/products/outlook/day{day}otlk_cat.lyr.geojson"
    r = await http.get(url, headers={"User-Agent": settings.user_agent})
    r.raise_for_status()
    return r.json()


async def _fetch_wpc_ero_geojson(http: httpx.AsyncClient, settings: Settings, day: int):
    url = _ERO_GEOJSON_URLS[day]
    r = await http.get(url, headers={"User-Agent": settings.user_agent})
    r.raise_for_status()
    return r.json()


async def _fetch_wpc_hazards_image(http: httpx.AsyncClient, settings: Settings):
    r = await http.get(_WPC_HAZARDS_URL, headers={"User-Agent": settings.user_agent})
    r.raise_for_status()
    return {
        "content_b64": base64.b64encode(r.content).decode("ascii"),
        "content_type": r.headers.get("content-type", "image/png"),
    }


# ── SPC categorical outlooks ─────────────────────────────────────────────────

@router.get("/spc-day{day}")
async def spc_day(
    day: int = Path(..., ge=1, le=3),
    http: HttpDep = ...,
    cache: CacheDep = ...,
    settings: SettingsDep = ...,
):
    key = f"overlay:spc-day{day}"
    try:
        return await cache_or_fetch(cache, key, SPC_TTL_S, lambda: _fetch_spc_geojson(http, settings, day))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPC fetch failed: {e}") from e


# ── WPC Excessive Rainfall Outlook (ERO) ─────────────────────────────────────

@router.get("/wpc-ero-day{day}")
async def wpc_ero_day(
    day: int = Path(..., ge=1, le=2),
    http: HttpDep = ...,
    cache: CacheDep = ...,
    settings: SettingsDep = ...,
):
    """Return metadata directing the frontend to the GeoJSON proxy for this day."""
    return {
        "type": "geojson_proxy",
        "geojson_path": f"/api/v1/overlay/wpc-ero-day{day}/geojson",
        "label": f"WPC Excessive Rainfall Outlook – Day {day}",
    }


@router.get("/wpc-ero-day{day}/geojson", include_in_schema=False)
async def wpc_ero_day_geojson(
    day: int = Path(..., ge=1, le=2),
    http: HttpDep = ...,
    cache: CacheDep = ...,
    settings: SettingsDep = ...,
):
    key = f"overlay:wpc-ero-day{day}-geojson"
    try:
        return await cache_or_fetch(cache, key, WPC_TTL_S, lambda: _fetch_wpc_ero_geojson(http, settings, day))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WPC ERO Day {day} fetch failed: {e}") from e


# ── WPC Weather Hazards (Day 3-7) ─────────────────────────────────────────────

@router.get("/wpc-hazards")
async def wpc_hazards_meta():
    return {
        "type": "image_proxy",
        "image_path": "/api/v1/overlay/wpc-hazards/image",
        "bounds": _CONUS,
        "label": "WPC Weather Hazards (Day 3–7)",
    }


@router.get("/wpc-hazards/image", include_in_schema=False)
async def wpc_hazards_image(http: HttpDep, cache: CacheDep, settings: SettingsDep):
    key = "overlay:wpc-hazards-image"
    try:
        data = await cache_or_fetch(cache, key, WPC_TTL_S, lambda: _fetch_wpc_hazards_image(http, settings))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WPC Hazards fetch failed: {e}") from e
    return Response(
        content=base64.b64decode(data["content_b64"]),
        media_type=data["content_type"],
        headers={"Cache-Control": "public, max-age=300"},
    )


# ── Background pre-warm ───────────────────────────────────────────────────────

async def refresh_overlay_caches(http: httpx.AsyncClient, cache: Cache, settings: Settings) -> None:
    """Populate every overlay cache entry. Run on a loop so user requests always
    land on a warm cache instead of waiting ~8-9s on NOAA."""

    async def safe(label: str, coro):
        try:
            await coro
        except Exception as e:
            log.warning("overlay_prewarm_failed", overlay=label, error=str(e))

    await asyncio.gather(
        *[
            safe(f"spc-day{d}", cache_or_fetch(cache, f"overlay:spc-day{d}", SPC_TTL_S, lambda d=d: _fetch_spc_geojson(http, settings, d)))
            for d in (1, 2, 3)
        ],
        *[
            safe(
                f"wpc-ero-day{d}",
                cache_or_fetch(cache, f"overlay:wpc-ero-day{d}-geojson", WPC_TTL_S, lambda d=d: _fetch_wpc_ero_geojson(http, settings, d)),
            )
            for d in (1, 2)
        ],
        safe("wpc-hazards", cache_or_fetch(cache, "overlay:wpc-hazards-image", WPC_TTL_S, lambda: _fetch_wpc_hazards_image(http, settings))),
    )
