"""The orchestrator. POST /api/v1/trip → full TripResponse."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from app.deps import CacheDep, HttpDep, SettingsDep
from app.logging import log
from app.models.geo import LatLon, Place
from app.models.trip import (
    AlternativeRoute,
    RouteSummary,
    TripRequest,
    TripResponse,
    WaypointOut,
)
from app.services.alerts import fetch_route_alerts
from app.services.forecaster import fetch_forecast_at
from app.services.geocoder import geocode_one
from app.services.grading import grade_trip, grade_waypoint
from app.services.router import (
    bounding_box,
    fetch_route,
    sample_waypoints,
)

router = APIRouter(prefix="/api/v1", tags=["trip"])


@router.post("/trip", response_model=TripResponse)
async def trip(
    body: TripRequest,
    http: HttpDep,
    cache: CacheDep,
    settings: SettingsDep,
):
    mapbox = settings.mapbox_token.get_secret_value()
    owm = settings.openweather_api_key.get_secret_value()
    if not mapbox:
        raise HTTPException(status_code=503, detail="Mapbox token not configured")

    # 1) Resolve any waypoints given as labels.
    resolved: list[LatLon] = []
    labels: list[str] = []
    for wp in body.waypoints:
        if wp.lat is not None and wp.lon is not None:
            resolved.append(LatLon(lat=wp.lat, lon=wp.lon))
            labels.append(wp.label or f"{wp.lat:.3f}, {wp.lon:.3f}")
        elif wp.label:
            place = await geocode_one(http, cache, mapbox, wp.label)
            if place is None:
                raise HTTPException(status_code=422, detail=f"Could not geocode: {wp.label}")
            resolved.append(LatLon(lat=place.lat, lon=place.lon))
            labels.append(place.label)
        else:
            raise HTTPException(status_code=422, detail="Each waypoint needs label or coords")

    # 2) Route.
    opts = body.options
    exclude: list[str] = []
    if opts.avoid_tolls:
        exclude.append("toll")
    if opts.avoid_highways:
        exclude.append("motorway")

    try:
        route = await fetch_route(
            http, cache, mapbox, resolved, body.depart_at,
            exclude=exclude or None,
            alternatives=True,
        )
    except ValueError as e:
        if str(e) == "no_route":
            raise HTTPException(status_code=422, detail="No driving route between waypoints")
        raise
    except Exception as e:
        log.error("route_failed", error=str(e))
        raise HTTPException(status_code=503, detail="Routing service unavailable") from e

    # 3) Sample waypoints by travel time.
    sampled = sample_waypoints(route, body.depart_at, interval_s=3600)
    bbox = bounding_box(route.coordinates)

    # 4+5) Forecasts + per-waypoint NWS alert queries — all in parallel.
    async def safe_forecast(lat, lon, at):
        if not owm:
            return None
        try:
            return await fetch_forecast_at(http, cache, owm, lat, lon, at)
        except Exception as e:
            log.warning("forecast_failed", lat=lat, lon=lon, error=str(e))
            return None

    forecast_tasks = [safe_forecast(lat, lon, at) for (lat, lon, at) in sampled]
    gathered = await asyncio.gather(
        *forecast_tasks,
        fetch_route_alerts(http, cache, sampled),
        return_exceptions=False,
    )
    forecasts = gathered[:-1]
    alerts, per_waypoint = gathered[-1]

    # 6) Grade each waypoint.
    waypoints_out: list[WaypointOut] = []
    grades = []
    for i, ((lat, lon, at), fc) in enumerate(zip(sampled, forecasts, strict=False)):
        wp_alerts = [alerts[j] for j in per_waypoint[i]] if i < len(per_waypoint) else []
        g = grade_waypoint(fc, wp_alerts)
        grades.append(g)
        if i == 0 and labels:
            label = labels[0]
        elif i == len(sampled) - 1 and labels:
            label = labels[-1]
        else:
            label = f"{lat:.3f}, {lon:.3f}"
        waypoints_out.append(
            WaypointOut(
                index=i,
                lat=lat,
                lon=lon,
                arrival=at,
                place_label=label,
                forecast=fc,
                grade=g,
                active_alerts=per_waypoint[i] if i < len(per_waypoint) else [],
            )
        )

    trip_grade, _worst = grade_trip(grades)

    alternative_routes: list[AlternativeRoute] = []
    if trip_grade.letter in ("D", "F"):
        for alt in route.alternatives[:2]:
            alternative_routes.append(
                AlternativeRoute(
                    polyline_geojson=alt["polyline_geojson"],
                    distance_m=alt["distance_m"],
                    duration_s=alt["duration_s"],
                )
            )

    return TripResponse(
        route=RouteSummary(
            distance_m=route.distance_m,
            duration_s=route.duration_s,
            polyline_geojson={
                "type": "LineString",
                "coordinates": [[lon, lat] for (lon, lat) in route.coordinates],
            },
            bounding_box=bbox,
        ),
        waypoints=waypoints_out,
        alerts=alerts,
        trip_grade=trip_grade,
        origin=Place(label=labels[0], lat=resolved[0].lat, lon=resolved[0].lon),
        destination=Place(label=labels[-1], lat=resolved[-1].lat, lon=resolved[-1].lon),
        alternative_routes=alternative_routes,
    )
