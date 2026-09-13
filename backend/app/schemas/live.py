"""Response models for the API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain import AqiCategory, Pollutant
from app.schemas.history import CityOut, StationOut


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
    stations_linked: int
    source_updated_at: datetime | None
    unchanged: bool
    error: str | None


class LiveStatus(BaseModel):
    last_run: ScrapeRunOut | None
    last_success: ScrapeRunOut | None
    data_as_of: datetime | None
    station_count: int


class LiveLinkOut(BaseModel):
    live_station_id: int
    live_station_name: str
    method: Literal["name", "distance", "manual"]
    distance_m: float | None


class StationAqiOut(BaseModel):
    value: int
    category: AqiCategory
    dominant: Pollutant
    pollutants_used: int


class StationLatestOut(BaseModel):
    """The newest scraped readings for a station in the historical data.

    `status` says what the app can show: ok; stale (the newest reading is older than
    `stale_after_hours`); no_recent_readings (nothing in the last 48 hours); or no_live_station
    (no station in the feed matches this one).
    """

    station: StationOut
    city: CityOut
    status: Literal["ok", "stale", "no_recent_readings", "no_live_station"]
    source: str
    # What the reading values are: sub-indices on CPCB's 0-500 AQI scale, not concentrations.
    measure: Literal["aqi_sub_index"] = "aqi_sub_index"
    link: LiveLinkOut | None
    observed_at: datetime | None  # hour of the newest reading, IST
    fetched_at: datetime | None
    stale_after_hours: int
    aqi: StationAqiOut | None  # from the newest hour's sub-indices, if CPCB's rules allow one
    readings: list[PollutantReading]
