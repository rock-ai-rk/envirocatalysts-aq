"""Response models for the live endpoints: the scraper's model values and its runs."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain import AqiCategory, Pollutant
from app.schemas.history import CityOut


class LiveReadingOut(BaseModel):
    pollutant: Pollutant
    value: float
    unit: str
    observed_at: datetime


class EstimatedAqiOut(BaseModel):
    """CPCB's AQI formula applied to the model's concentrations: an estimate, not an official
    AQI."""

    value: int
    category: AqiCategory
    dominant: Pollutant
    sub_indices: dict[Pollutant, int]


class LiveSourceOut(BaseModel):
    """Where live values come from. Open-Meteo's licence asks apps to show the attribution, with
    a link, next to the data."""

    source: str
    attribution: str
    attribution_url: str
    stale_after_hours: int


class CityLiveOut(LiveSourceOut):
    """The newest model values for one city.

    `status` says what the app can show: ok; stale (the newest hour is older than
    `stale_after_hours`); no_recent_readings (nothing in the last 48 hours); or not_in_feed (the
    city has no coordinates, so the scraper can't read the model there).
    """

    city: CityOut
    status: Literal["ok", "stale", "no_recent_readings", "not_in_feed"]
    # Concentrations from a model of the ~45 km area around the city, not a station measurement.
    measure: Literal["model_estimate"] = "model_estimate"
    observed_at: datetime | None  # the newest hour, IST
    fetched_at: datetime | None
    aqi: EstimatedAqiOut | None  # None when CPCB's minimum-data rules aren't met
    readings: list[LiveReadingOut]


class LiveCityRankOut(BaseModel):
    city: CityOut
    aqi: EstimatedAqiOut
    observed_at: datetime


class LiveCitiesResponse(LiveSourceOut):
    cities: list[LiveCityRankOut]


class ScrapeRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    cities_requested: int
    cities_seen: int
    records_seen: int
    records_skipped: int
    readings_inserted: int
    readings_purged: int
    error: str | None


class LiveStatus(BaseModel):
    last_run: ScrapeRunOut | None
    last_success: ScrapeRunOut | None
    data_as_of: datetime | None
    cities_with_readings: int  # in the last 48 hours
