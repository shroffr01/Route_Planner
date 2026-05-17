"""Mapbox geocoding wrapper."""
from __future__ import annotations

from urllib.parse import quote

import httpx

from app.cache import Cache, cache_or_fetch
from app.logging import log
from app.models.geo import Place

GEOCODE_TTL_S = 24 * 3600

# Routes are restricted to the contiguous US. Alaska, Hawaii, and territories
# are excluded by combining country=us with this bbox.
LOWER_48_BBOX = (-125.0, 24.0, -66.93, 49.38)  # (min_lon, min_lat, max_lon, max_lat)


def _in_lower_48(lat: float, lon: float) -> bool:
    min_lon, min_lat, max_lon, max_lat = LOWER_48_BBOX
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


async def search_places(
    http: httpx.AsyncClient,
    cache: Cache,
    mapbox_token: str,
    query: str,
    proximity: tuple[float, float] | None = None,
    limit: int = 5,
) -> list[Place]:
    if not query.strip():
        return []
    if not mapbox_token:
        log.warning("geocode_skipped_no_token")
        return []
    key = f"geocode:lower48:{query.lower()}:{proximity}"

    async def fetch():
        # Mapbox v5 takes the search text as a URL path segment. Spaces and commas
        # must be percent-encoded; `quote(safe="")` handles both.
        encoded = quote(query, safe="")
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json"
        params: dict[str, str | int | float] = {
            "access_token": mapbox_token,
            "limit": limit,
            "types": "address,place,locality,region,postcode,poi",
            "country": "us",
            "bbox": ",".join(str(v) for v in LOWER_48_BBOX),
        }
        if proximity:
            params["proximity"] = f"{proximity[0]},{proximity[1]}"
        r = await http.get(url, params=params)
        r.raise_for_status()
        return r.json()

    data = await cache_or_fetch(cache, key, GEOCODE_TTL_S, fetch)
    out: list[Place] = []
    for feat in data.get("features", []):
        lon, lat = feat["center"]
        if not _in_lower_48(lat, lon):
            continue
        out.append(Place(label=feat.get("place_name", ""), lat=lat, lon=lon))
    return out


async def geocode_one(
    http: httpx.AsyncClient,
    cache: Cache,
    mapbox_token: str,
    query: str,
) -> Place | None:
    results = await search_places(http, cache, mapbox_token, query, limit=1)
    return results[0] if results else None
