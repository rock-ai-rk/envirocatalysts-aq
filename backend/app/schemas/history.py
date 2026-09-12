"""Response models for the Overview and Hourly endpoints (historical data)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.analytics.overview import Direction, ExclusionReason, RankBy
from app.domain import AqiCategory, CityGroup, Frequency, Pollutant


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
    imported_at: datetime


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

    dataset: DatasetOut | None
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
