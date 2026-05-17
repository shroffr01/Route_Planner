from typing import Literal

from pydantic import BaseModel


class Forecast(BaseModel):
    temp_f: float
    feels_like_f: float
    dew_point_f: float | None = None
    humidity_pct: float | None = None
    pop_pct: float
    wind_mph: float
    wind_gust_mph: float | None = None
    visibility_mi: float | None = None
    cloud_pct: float
    uv: float | None = None
    condition_code: str
    summary: str


class Alert(BaseModel):
    event: str
    headline: str | None = None
    description: str | None = None
    severity: str
    starts_at: str
    ends_at: str
    polygon_geojson: dict | None = None
    intersects_waypoints: list[int] = []


GradeLetter = Literal["A", "B", "C", "D", "F"]


class Grade(BaseModel):
    letter: GradeLetter
    score: int
    reasons: list[str] = []
