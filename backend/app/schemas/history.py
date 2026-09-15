"""Response models for the Overview and Hourly endpoints (historical data)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.analytics.overview import Direction, ExclusionReason, RankBy
from app.domain import AqiCategory, CityGroup, DatasetScope, Frequency, HourlyPollutant, Pollutant


class PeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    frequency: Frequency
    label: str
    start_date: date
    end_date: date
    days: int


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    source: str
    synthetic: bool
    scope: DatasetScope
    imported_at: datetime


class DatasetsOut(BaseModel):
    """Where each screen's data came from, so each can say so (e.g. real Overview, demo hourly)."""

    overview: DatasetOut | None
    hourly: DatasetOut | None


class CityOut(BaseModel):
    id: int
    name: str
    state: str
    latitude: float | None
    longitude: float | None
    groups: list[CityGroup]


class GroupOut(BaseModel):
    code: CityGroup
    label: str
    description: str


class CoverageRules(BaseModel):
    min_coverage: float
    pm25_floor: float


class MetaOut(BaseModel):
    """Everything the app needs to build its pickers, plus where the data came from."""

    # The newest dataset loaded, kept for older app versions; `datasets` is per screen.
    dataset: DatasetOut | None
    datasets: DatasetsOut
    periods: list[PeriodOut]
    default_base: str | None
    default_comparison: str | None
    states: list[str]
    groups: list[GroupOut]
    rules: CoverageRules


class CityPeriodStatsOut(BaseModel):
    coverage: float
    days_with_data: int
    aqi_days: dict[AqiCategory, int]
    pollutant_means: dict[Pollutant, float]
    dominant_days: dict[Pollutant, int]
    pm25_below_floor: bool


class CityChangeOut(BaseModel):
    aqi_days: dict[AqiCategory, int]
    pollutant_means: dict[Pollutant, float]
    dominant_days: dict[Pollutant, int]
    coverage: float


class OverviewCity(BaseModel):
    rank: int
    city: CityOut
    base: CityPeriodStatsOut
    # Lenient comparison: null when the city has no data in the comparison period.
    comparison: CityPeriodStatsOut | None
    change: CityChangeOut | None


class ExcludedCityOut(BaseModel):
    city: CityOut
    reason: ExclusionReason
    coverage: float | None


class OverviewOut(BaseModel):
    base: PeriodOut
    comparison: PeriodOut
    rank_by: RankBy
    direction: Direction
    top: int | None
    cities_in_scope: int
    eligible: int
    cities: list[OverviewCity]
    excluded: list[ExcludedCityOut]
    rules: CoverageRules


class CityDetailOut(BaseModel):
    city: CityOut
    base: PeriodOut
    comparison: PeriodOut
    base_stats: CityPeriodStatsOut | None
    comparison_stats: CityPeriodStatsOut | None
    change: CityChangeOut | None
    has_hourly_data: bool


class StationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None
    latitude: float | None
    longitude: float | None


class HourlyCityOut(BaseModel):
    city: CityOut
    stations: list[StationOut]


class Thresholds(BaseModel):
    naaqs: float
    who: float


class KpisOut(BaseModel):
    hours_with_data: int
    expected_hours: int
    coverage: float
    mean: float | None
    peak: float | None
    peak_at: datetime | None
    above_naaqs_pct: float | None
    above_who_pct: float | None


class HourBinOut(BaseModel):
    hour: int
    label: str
    mean: float | None
    samples: int


class DayMeanOut(BaseModel):
    day: date
    mean: float
    hours: int
    valid: bool


class MonthStatsOut(BaseModel):
    month: date
    samples: int
    mean: float
    p10: float
    p25: float
    median: float
    p75: float
    p90: float
    max: float


class HourlyPeriodOut(BaseModel):
    period: PeriodOut
    kpis: KpisOut
    hours: list[HourBinOut]
    days: list[DayMeanOut]
    months: list[MonthStatsOut]
    peak_day: date | None


class HourlySummaryOut(BaseModel):
    city: CityOut
    station: StationOut | None  # null means the city average across its stations
    pollutant: Pollutant
    unit: str
    thresholds: Thresholds | None
    base: HourlyPeriodOut
    comparison: HourlyPeriodOut


class HeatmapRowOut(BaseModel):
    station: StationOut
    mean: float
    hours: list[float | None]  # 24 values, hour-ending 01:00 ... 00:00


class HeatmapOut(BaseModel):
    city: CityOut
    pollutant: Pollutant
    unit: str
    period: PeriodOut
    hour_labels: list[str]
    stations_total: int
    rows: list[HeatmapRowOut]


class DayHeatmapOut(BaseModel):
    city: CityOut
    pollutant: Pollutant
    unit: str
    day: date
    hour_labels: list[str]
    rows: list[HeatmapRowOut]


class CityListItemOut(CityOut):
    station_count: int  # stations with hourly history


class CityAqiSummaryOut(BaseModel):
    city: CityOut
    stats: CityPeriodStatsOut | None  # null when the city has no data for the period


class AqiSummaryOut(BaseModel):
    period: PeriodOut
    rules: CoverageRules
    cities: list[CityAqiSummaryOut]  # in the order the ids were requested


class CoverageFlagOut(BaseModel):
    code: ExclusionReason
    # Which base-period charts the rule removes the city from.
    applies_to: Literal["all_charts", "pm25_chart"]


class CoverageOut(BaseModel):
    """The data conditions for one city and period, as flags the app can render and explain."""

    city: CityOut
    period: PeriodOut
    days_in_period: int
    days_with_data: int
    coverage: float  # 0-1
    meets_min_coverage: bool
    pm25_mean: float | None
    pm25_below_floor: bool
    # Whether the city appears in the base period's charts (strict rules) ...
    included_in_base: bool
    # ... and specifically in the PM2.5 concentration chart.
    included_in_pm25_chart: bool
    flags: list[CoverageFlagOut]
    rules: CoverageRules


class SeriesPointOut(BaseModel):
    # Hourly points: the hour-ending timestamp. Daily points: midnight IST at the start of the day.
    t: datetime
    value: float | None  # null marks a gap: the hour or day had no data
    min: float | None = None  # daily points only
    max: float | None = None
    hours: int | None = None  # daily points only: hours with data


class SeriesStatsOut(BaseModel):
    """Over the hourly values in the window, whatever the resolution of `points`."""

    hours_with_data: int
    expected_hours: int
    mean: float | None
    max: float | None
    max_at: datetime | None
    min: float | None
    min_at: datetime | None


class StationSeriesOut(BaseModel):
    station: StationOut
    city: CityOut
    pollutant: HourlyPollutant
    unit: str
    thresholds: Thresholds | None
    start: datetime = Field(description="Window start (exclusive), IST")
    end: datetime = Field(description="Window end (inclusive), IST")
    resolution: Literal["hour", "day"]
    points: list[SeriesPointOut]
    stats: SeriesStatsOut
    # The station's full hourly record for this pollutant, so the app can bound its range control.
    available_from: datetime | None
    available_to: datetime | None
