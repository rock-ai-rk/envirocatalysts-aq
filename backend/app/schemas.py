"""Response models for the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.domain import Pollutant


class PollutantReading(BaseModel):
    pollutant: Pollutant
    avg: float | None
    min: float | None
    max: float | None
    observed_at: datetime
    stale: bool


class StationLatest(BaseModel):
    id: int
    name: str
    city: str
    state: str
    latitude: float | None
    longitude: float | None
    readings: list[PollutantReading]


class LiveLatestResponse(BaseModel):
    as_of: datetime | None
    stale_after_hours: int
    stations: list[StationLatest]


class CityLatest(BaseModel):
    city: str
    state: str
    avg: float
    station_count: int
    observed_at: datetime


class LiveCitiesResponse(BaseModel):
    pollutant: Pollutant
    cities: list[CityLatest]


class ScrapeRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    started_at: datetime
    finished_at: datetime | None
    records_seen: int
    records_skipped: int
    stations_seen: int
    readings_inserted: int
    readings_purged: int
    error: str | None


class LiveStatus(BaseModel):
    last_run: ScrapeRunOut | None
    last_success: ScrapeRunOut | None
    data_as_of: datetime | None
    station_count: int
