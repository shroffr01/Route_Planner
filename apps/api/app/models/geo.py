from pydantic import BaseModel, Field


class LatLon(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class Place(BaseModel):
    label: str
    lat: float
    lon: float


class GeocodeResults(BaseModel):
    results: list[Place]
