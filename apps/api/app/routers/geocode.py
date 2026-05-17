from fastapi import APIRouter, Query

from app.deps import CacheDep, HttpDep, SettingsDep
from app.models.geo import GeocodeResults
from app.services.geocoder import search_places

router = APIRouter(prefix="/api/v1/geocode", tags=["geocode"])


@router.get("", response_model=GeocodeResults)
async def geocode(
    http: HttpDep,
    cache: CacheDep,
    settings: SettingsDep,
    q: str = Query(..., min_length=1),
    proximity: str | None = None,
):
    prox = None
    if proximity:
        try:
            lon, lat = [float(x) for x in proximity.split(",")]
            prox = (lon, lat)
        except Exception:
            prox = None
    results = await search_places(
        http, cache, settings.mapbox_token.get_secret_value(), q, prox
    )
    return GeocodeResults(results=results)
