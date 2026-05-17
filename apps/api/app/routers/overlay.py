"""Overlay proxy endpoints: SPC outlooks, WPC ERO, WPC Hazards.

SPC categorical outlooks → proxied GeoJSON (features carry official 'fill'/'stroke' colors).
WPC ERO Day 1/2        → proxied GeoJSON (dn 1-4 = Marginal/Slight/Moderate/High).
WPC Hazards (Day 3-7)  → proxied PNG image (WPC servers lack CORS headers).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import Response

from app.cache import cache_or_fetch
from app.deps import CacheDep, HttpDep, SettingsDep

router = APIRouter(prefix="/api/v1/overlay", tags=["overlay"])

SPC_TTL_S = 5 * 60
WPC_TTL_S = 5 * 60

# Standard CONUS extent for WPC image products:
# [top-left, top-right, bottom-right, bottom-left] as [lon, lat]
_CONUS = [[-130.0, 55.0], [-60.0, 55.0], [-60.0, 20.0], [-130.0, 20.0]]

_ERO_GEOJSON_URLS = {
    1: "https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day1_Latest.geojson",
    2: "https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day2_Latest.geojson",
}


# ── SPC categorical outlooks ─────────────────────────────────────────────────

@router.get("/spc-day{day}")
async def spc_day(
    day: int = Path(..., ge=1, le=3),
    http: HttpDep = ...,
    cache: CacheDep = ...,
    settings: SettingsDep = ...,
):
    url = f"https://www.spc.noaa.gov/products/outlook/day{day}otlk_cat.lyr.geojson"
    key = f"overlay:spc-day{day}"

    async def fetch():
        r = await http.get(url, headers={"User-Agent": settings.user_agent})
        r.raise_for_status()
        return r.json()

    try:
        return await cache_or_fetch(cache, key, SPC_TTL_S, fetch)
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
    url = _ERO_GEOJSON_URLS[day]
    key = f"overlay:wpc-ero-day{day}-geojson"

    async def fetch():
        r = await http.get(url, headers={"User-Agent": settings.user_agent})
        r.raise_for_status()
        return r.json()

    try:
        return await cache_or_fetch(cache, key, WPC_TTL_S, fetch)
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
async def wpc_hazards_image(http: HttpDep, settings: SettingsDep):
    try:
        r = await http.get(
            "https://www.wpc.ncep.noaa.gov/threats/final/hazards_d3_7_contours.png",
            headers={"User-Agent": settings.user_agent},
        )
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WPC Hazards fetch failed: {e}") from e
    return Response(
        content=r.content,
        media_type=r.headers.get("content-type", "image/png"),
        headers={"Cache-Control": "public, max-age=300"},
    )
