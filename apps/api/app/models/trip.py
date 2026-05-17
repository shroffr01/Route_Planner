from datetime import datetime

from pydantic import BaseModel, Field

from app.models.geo import LatLon, Place
from app.models.weather import Alert, Forecast, Grade


class WaypointInput(BaseModel):
    """User-supplied waypoint: either a place label or explicit coordinates."""

    label: str | None = None
    lat: float | None = None
    lon: float | None = None


class RouteOptions(BaseModel):
    avoid_tolls: bool = False
    avoid_highways: bool = False


class TripRequest(BaseModel):
    waypoints: list[WaypointInput] = Field(..., min_length=2, max_length=10)
    depart_at: datetime
    options: RouteOptions = Field(default_factory=RouteOptions)


class RouteSummary(BaseModel):
    distance_m: float
    duration_s: float
    polyline_geojson: dict
    bounding_box: list[float]  # [minLon, minLat, maxLon, maxLat]


class WaypointOut(BaseModel):
    index: int
    lat: float
    lon: float
    arrival: datetime
    place_label: str
    forecast: Forecast | None = None
    grade: Grade
    active_alerts: list[int] = []  # indices into TripResponse.alerts


class AlternativeRoute(BaseModel):
    polyline_geojson: dict
    distance_m: float
    duration_s: float


class TripResponse(BaseModel):
    route: RouteSummary
    waypoints: list[WaypointOut]
    alerts: list[Alert]
    trip_grade: Grade
    origin: Place
    destination: Place
    alternative_routes: list[AlternativeRoute] = []


class ForecastSample(BaseModel):
    lat: float
    lon: float
    at: datetime


class RouteRequest(BaseModel):
    waypoints: list[LatLon] = Field(..., min_length=2, max_length=10)
    depart_at: datetime
