"""Mapbox Directions wrapper + waypoint sampler.

Implements the §6.4 fix: build a cumulative-duration array from the per-segment
durations Mapbox returns, then np.searchsorted into it and interpolate
linearly between the two bracketing coordinates. Always append destination.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

import httpx
import numpy as np

from app.cache import Cache, cache_or_fetch
from app.models.geo import LatLon

ROUTE_TTL_S = 30 * 60


@dataclass(slots=True)
class RouteResult:
    coordinates: list[tuple[float, float]]  # (lon, lat)
    duration_s: float
    distance_m: float
    cumulative_s: np.ndarray  # length == len(coordinates), starts at 0
    raw: dict
    alternatives: list[dict] = field(default_factory=list)


async def fetch_route(
    http: httpx.AsyncClient,
    cache: Cache,
    mapbox_token: str,
    waypoints: list[LatLon],
    depart_at: datetime,
    exclude: list[str] | None = None,
    alternatives: bool = False,
) -> RouteResult:
    coords_param = ";".join(f"{w.lon},{w.lat}" for w in waypoints)
    # Round depart_at to nearest hour for cache friendliness.
    cache_dt = depart_at.replace(minute=0, second=0, microsecond=0).isoformat()
    exclude_key = ",".join(sorted(exclude)) if exclude else ""
    key = f"route:{coords_param}:{cache_dt}:{exclude_key}"

    async def fetch():
        url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords_param}"
        params: dict = {
            "geometries": "geojson",
            "overview": "full",
            "annotations": "duration,distance",
            "depart_at": depart_at.strftime("%Y-%m-%dT%H:%M"),
            "access_token": mapbox_token,
        }
        if alternatives:
            params["alternatives"] = "true"
        if exclude:
            params["exclude"] = ",".join(exclude)
        r = await http.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        if not data.get("routes"):
            raise ValueError("no_route")
        return data

    data = await cache_or_fetch(cache, key, ROUTE_TTL_S, fetch)
    route = data["routes"][0]
    geometry_coords: list[list[float]] = route["geometry"]["coordinates"]
    coordinates = [(c[0], c[1]) for c in geometry_coords]

    # Build cumulative duration array along the polyline.
    seg_durations: list[float] = []
    for leg in route["legs"]:
        ann = leg.get("annotation", {})
        durs = ann.get("duration", [])
        seg_durations.extend(durs)

    if len(seg_durations) != len(coordinates) - 1:
        # Fallback: distribute total duration evenly across segments.
        total = float(route.get("duration", 0))
        n = max(1, len(coordinates) - 1)
        seg_durations = [total / n] * n

    cumulative = np.concatenate([[0.0], np.cumsum(seg_durations)])

    alt_list: list[dict] = []
    for alt in data["routes"][1:]:
        alt_coords = alt["geometry"]["coordinates"]
        alt_list.append({
            "polyline_geojson": {
                "type": "LineString",
                "coordinates": [[c[0], c[1]] for c in alt_coords],
            },
            "distance_m": float(alt.get("distance", 0)),
            "duration_s": float(alt.get("duration", 0)),
        })

    return RouteResult(
        coordinates=coordinates,
        duration_s=float(route.get("duration", cumulative[-1])),
        distance_m=float(route.get("distance", 0)),
        cumulative_s=cumulative,
        raw=route,
        alternatives=alt_list,
    )


def sample_waypoints(
    route: RouteResult,
    depart_at: datetime,
    interval_s: int = 3600,
) -> list[tuple[float, float, datetime]]:
    """Return [(lat, lon, arrival_time), ...] sampled every interval_s along the route.

    Always includes the destination as the final waypoint.
    """
    coords = route.coordinates
    cum = route.cumulative_s
    if len(coords) == 0:
        return []
    total = float(cum[-1])
    offsets = list(np.arange(0, total, interval_s))
    if not offsets or offsets[-1] != total:
        offsets.append(total)

    out: list[tuple[float, float, datetime]] = []
    for off in offsets:
        idx = int(np.searchsorted(cum, off, side="right")) - 1
        idx = max(0, min(idx, len(coords) - 1))
        if idx == len(coords) - 1:
            lon, lat = coords[-1]
        else:
            t0, t1 = cum[idx], cum[idx + 1]
            frac = 0.0 if t1 == t0 else (off - t0) / (t1 - t0)
            lon0, lat0 = coords[idx]
            lon1, lat1 = coords[idx + 1]
            lon = lon0 + frac * (lon1 - lon0)
            lat = lat0 + frac * (lat1 - lat0)
        arrival = depart_at + timedelta(seconds=float(off))
        out.append((lat, lon, arrival))

    # De-duplicate exact duplicates (can happen if total is an exact multiple of interval_s).
    deduped: list[tuple[float, float, datetime]] = []
    for w in out:
        if not deduped or deduped[-1][2] != w[2]:
            deduped.append(w)
    return deduped


def bounding_box(coords: list[tuple[float, float]]) -> list[float]:
    if not coords:
        return [0, 0, 0, 0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return [min(lons), min(lats), max(lons), max(lats)]
