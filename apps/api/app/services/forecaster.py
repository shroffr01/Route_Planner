"""OpenWeather One Call 3.0 wrapper + hour alignment."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.cache import Cache, cache_or_fetch
from app.models.weather import Forecast

FORECAST_TTL_S = 30 * 60


def _round_coord(x: float) -> float:
    return round(x, 1)


async def fetch_forecast_at(
    http: httpx.AsyncClient,
    cache: Cache,
    openweather_key: str,
    lat: float,
    lon: float,
    at: datetime,
) -> Forecast | None:
    """Fetch hourly forecast for (lat,lon), select the hour matching `at`."""
    rlat, rlon = _round_coord(lat), _round_coord(lon)
    hour_iso = at.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat()
    key = f"forecast:{rlat}:{rlon}:{hour_iso}"

    async def fetch():
        url = "https://api.openweathermap.org/data/3.0/onecall"
        params = {
            "lat": rlat,
            "lon": rlon,
            "exclude": "current,minutely,daily,alerts",
            "units": "imperial",
            "appid": openweather_key,
        }
        r = await http.get(url, params=params)
        r.raise_for_status()
        return r.json()

    data = await cache_or_fetch(cache, key, FORECAST_TTL_S, fetch)
    hourly = data.get("hourly") or []
    if not hourly:
        return None

    target_ts = int(at.astimezone(timezone.utc).timestamp())
    closest = min(hourly, key=lambda h: abs(int(h["dt"]) - target_ts))
    weather = (closest.get("weather") or [{}])[0]

    return Forecast(
        temp_f=float(closest.get("temp", 0)),
        feels_like_f=float(closest.get("feels_like", 0)),
        dew_point_f=closest.get("dew_point"),
        humidity_pct=closest.get("humidity"),
        pop_pct=float(closest.get("pop", 0)) * 100.0,
        wind_mph=float(closest.get("wind_speed", 0)),
        wind_gust_mph=closest.get("wind_gust"),
        visibility_mi=(
            float(closest["visibility"]) / 1609.344 if "visibility" in closest else None
        ),
        cloud_pct=float(closest.get("clouds", 0)),
        uv=closest.get("uvi"),
        condition_code=weather.get("icon", "01d"),
        summary=weather.get("description", "").capitalize(),
    )
