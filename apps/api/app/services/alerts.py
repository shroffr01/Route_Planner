"""NWS alerts.

Approach (matches v1 in PersonalProject/website.py): query NWS at each waypoint's
lat/lon in parallel, then union the results into a single trip-level alert list.
We also keep the alert polygons so the frontend can draw them as map overlays.

The NWS active-alerts endpoint usually returns `geometry: null` for zone-based
warnings (most county-scope events). For those, we resolve the polygon by
fetching each `affectedZones` URL and unioning their geometries — zones are
stable, so we cache them aggressively.

A given alert is considered "active for a waypoint" when:
  1. The waypoint's lat/lon is inside the alert polygon (or NWS returned the
     alert for a point=lat,lon query at that waypoint — which by NWS's
     contract means the point is covered), AND
  2. The waypoint's arrival time falls inside the alert's [onset, ends] window.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

from app.cache import Cache, cache_or_fetch
from app.logging import log
from app.models.weather import Alert

ALERT_TTL_S = 5 * 60
ZONE_TTL_S = 24 * 60 * 60
# Per-point HTTP budget for NWS — fail fast and surface "no alerts" rather than block.
PER_POINT_TIMEOUT_S = 4.0
ZONE_TIMEOUT_S = 4.0


def _round(x: float, digits: int = 2) -> float:
    return round(x, digits)


async def _fetch_alerts_at_point(
    http: httpx.AsyncClient,
    cache: Cache,
    lat: float,
    lon: float,
) -> list[dict[str, Any]]:
    """Return the raw NWS alert features active at (lat, lon).

    Note: the NWS /alerts/active endpoint does NOT accept a `limit` query param —
    passing it triggers a 400 Bad Request and silently zeros out alerts. The
    endpoint already returns only currently-active alerts, so no limit is needed.
    """
    key = f"alerts:point:{_round(lat)}:{_round(lon)}"

    async def fetch():
        url = "https://api.weather.gov/alerts/active"
        params = {
            "status": "actual",
            "message_type": "alert,update",
            "point": f"{lat},{lon}",
            "urgency": "Immediate,Expected,Future",
            "severity": "Extreme,Severe,Moderate,Minor",
            "certainty": "Observed,Likely,Possible",
        }
        try:
            r = await http.get(
                url,
                params=params,
                headers={"Accept": "application/geo+json"},
                timeout=PER_POINT_TIMEOUT_S,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            log.warning("nws_alert_fetch_failed", lat=lat, lon=lon, error=str(e))
            return {"features": []}

    data = await cache_or_fetch(cache, key, ALERT_TTL_S, fetch)
    return data.get("features") or []


async def _fetch_zone_geometry(
    http: httpx.AsyncClient,
    cache: Cache,
    zone_url: str,
) -> dict[str, Any] | None:
    """Fetch a single NWS zone's geometry, cached for ZONE_TTL_S."""
    key = f"nws:zone:{zone_url}"

    async def fetch():
        try:
            r = await http.get(
                zone_url,
                headers={"Accept": "application/geo+json"},
                timeout=ZONE_TIMEOUT_S,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            log.warning("nws_zone_fetch_failed", url=zone_url, error=str(e))
            return None

    data = await cache_or_fetch(cache, key, ZONE_TTL_S, fetch)
    if not data:
        return None
    return data.get("geometry")


async def _resolve_zone_polygon(
    http: httpx.AsyncClient,
    cache: Cache,
    zone_urls: list[str],
) -> dict[str, Any] | None:
    """Fetch every affected-zone polygon in parallel and union them into one geometry."""
    if not zone_urls:
        return None
    # Cap at 8 zones — most alerts have ≤3; this bounds latency on county-mass events.
    zone_urls = zone_urls[:8]
    geoms = await asyncio.gather(
        *[_fetch_zone_geometry(http, cache, u) for u in zone_urls],
        return_exceptions=False,
    )
    shapes = []
    for g in geoms:
        if not g:
            continue
        try:
            s = shape(g)
        except Exception:
            continue
        if s.is_valid and not s.is_empty:
            shapes.append(s)
    if not shapes:
        return None
    try:
        merged = unary_union(shapes)
        return mapping(merged)
    except Exception as e:
        log.warning("nws_zone_union_failed", error=str(e))
        # Fall back to the first valid geometry.
        return mapping(shapes[0])


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _feature_to_alert(feat: dict[str, Any]) -> tuple[Alert, list[str]] | None:
    """Return (alert, affectedZoneURLs). The caller is responsible for resolving
    zone geometry if the inline `polygon_geojson` is missing.
    """
    props = feat.get("properties") or {}
    event = props.get("event")
    if not event:
        return None
    alert = Alert(
        event=event,
        headline=props.get("headline"),
        description=props.get("description"),
        severity=props.get("severity") or "Unknown",
        starts_at=props.get("onset") or props.get("effective") or "",
        ends_at=props.get("ends") or props.get("expires") or "",
        polygon_geojson=feat.get("geometry"),
    )
    zones = props.get("affectedZones") or []
    return alert, list(zones)


def _is_active_at(alert: Alert, when: datetime) -> bool:
    """Is this alert in effect at `when`? Missing endpoints are treated as open-ended."""
    start = _parse_dt(alert.starts_at)
    end = _parse_dt(alert.ends_at)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    if start is not None and when < start:
        return False
    if end is not None and when > end:
        return False
    return True


async def fetch_route_alerts(
    http: httpx.AsyncClient,
    cache: Cache,
    waypoints: list[tuple[float, float, datetime]],
) -> tuple[list[Alert], list[list[int]]]:
    """Query NWS at each waypoint in parallel; return:
      - alerts: deduplicated trip-wide alert list (with polygons resolved)
      - per_waypoint: for each waypoint, the indices into `alerts` of alerts that are
        active at that waypoint's arrival time.

    De-duplication key is (event, starts_at, ends_at) — the same warning issued
    for multiple adjacent zones collapses to one entry.
    """
    if not waypoints:
        return [], []

    raw_per_point: list[list[dict[str, Any]]] = await asyncio.gather(
        *[_fetch_alerts_at_point(http, cache, lat, lon) for (lat, lon, _at) in waypoints],
    )

    alerts: list[Alert] = []
    pending_zones: list[list[str]] = []  # zones to resolve, parallel to `alerts`
    seen: dict[tuple[str, str, str], int] = {}
    per_waypoint: list[list[int]] = [[] for _ in waypoints]

    # First pass: register every alert (deduped) and tag the waypoint that fetched it.
    for i, features in enumerate(raw_per_point):
        for feat in features:
            parsed = _feature_to_alert(feat)
            if parsed is None:
                continue
            alert, zones = parsed
            key = (alert.event, alert.starts_at, alert.ends_at)
            if key not in seen:
                seen[key] = len(alerts)
                alerts.append(alert)
                pending_zones.append(zones)
            idx = seen[key]
            arrival = waypoints[i][2]
            if _is_active_at(alert, arrival) and idx not in per_waypoint[i]:
                per_waypoint[i].append(idx)

    # Resolve zone polygons in parallel for any alert lacking inline geometry.
    needs_resolve = [i for i, a in enumerate(alerts) if not a.polygon_geojson and pending_zones[i]]
    if needs_resolve:
        resolved = await asyncio.gather(
            *[_resolve_zone_polygon(http, cache, pending_zones[i]) for i in needs_resolve],
            return_exceptions=False,
        )
        for i, geom in zip(needs_resolve, resolved, strict=False):
            if geom is not None:
                alerts[i].polygon_geojson = geom

    # Second pass: alert polygons might cover waypoints other than the one that
    # fetched them. Cross-check spatially.
    for alert_idx, alert in enumerate(alerts):
        if not alert.polygon_geojson:
            continue
        try:
            poly = shape(alert.polygon_geojson)
        except Exception:
            continue
        if not poly.is_valid:
            continue
        for i, (lat, lon, arrival) in enumerate(waypoints):
            if alert_idx in per_waypoint[i]:
                continue
            if not _is_active_at(alert, arrival):
                continue
            if poly.contains(Point(lon, lat)) or poly.distance(Point(lon, lat)) < 0.05:
                per_waypoint[i].append(alert_idx)

    # Reflect membership back onto each alert.
    for alert_idx, alert in enumerate(alerts):
        alert.intersects_waypoints = [
            i for i, lst in enumerate(per_waypoint) if alert_idx in lst
        ]

    return alerts, per_waypoint
