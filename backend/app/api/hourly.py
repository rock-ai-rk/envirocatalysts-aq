"""The Hourly Analysis screen: station-wise hourly patterns."""

from datetime import date
from statistics import fmean

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.analytics.hourly import HourlySummary, hour_profile, summarize
from app.db import get_session
from app.domain import LIMITS, HourlyPollutant, unit_for
from app.models import City, Period, Station
from app.queries import (
    city_out,
    get_city,
    get_period,
    hourly_readings,
    hourly_readings_by_station,
)
from app.schemas.history import (
    DayHeatmapOut,
    DayMeanOut,
    HeatmapOut,
    HeatmapRowOut,
    HourBinOut,
    HourlyCityOut,
    HourlyPeriodOut,
    HourlySummaryOut,
    KpisOut,
    MonthStatsOut,
    PeriodOut,
    StationOut,
    Thresholds,
)

router = APIRouter(prefix="/v1/hourly", tags=["hourly"])

HOUR_LABELS = [f"{hour % 24:02d}:00" for hour in range(1, 25)]


@router.get("/cities", response_model=list[HourlyCityOut])
def cities_with_stations(session: Session = Depends(get_session)) -> list[HourlyCityOut]:
    """Cities that have hourly station data, with their stations, for the station picker."""
    cities = session.scalars(
        select(City)
        .where(City.stations.any())
        .options(selectinload(City.stations))
        .order_by(City.state, City.name)
    )
    return [
        HourlyCityOut(
            city=city_out(city),
            stations=[
                StationOut.model_validate(s) for s in sorted(city.stations, key=lambda s: s.name)
            ],
        )
        for city in cities
    ]


@router.get("/summary", response_model=HourlySummaryOut)
def hourly_summary(
    city_id: int,
    station_id: int | None = Query(None, description="Omit for the city average"),
    pollutant: HourlyPollutant = "PM2.5",
    base: str = "FY2024-25",
    comparison: str = "FY2025-26",
    session: Session = Depends(get_session),
) -> HourlySummaryOut:
    """KPIs, hour-of-day pattern, daily means and monthly distribution for both periods."""
    city = get_city(session, city_id)
    station = _station_in_city(session, station_id, city_id) if station_id is not None else None
    limits = LIMITS.get(pollutant)

    def period_summary(period: Period) -> HourlyPeriodOut:
        readings = hourly_readings(
            session, city_id, station_id, pollutant, period.start_date, period.end_date
        )
        return _period_out(period, summarize(readings, period.start_date, period.end_date, limits))

    return HourlySummaryOut(
        city=city_out(city),
        station=StationOut.model_validate(station) if station else None,
        pollutant=pollutant,
        unit=unit_for(pollutant),
        thresholds=Thresholds(naaqs=limits.naaqs, who=limits.who) if limits else None,
        base=period_summary(get_period(session, base)),
        comparison=period_summary(get_period(session, comparison)),
    )


@router.get("/heatmap", response_model=HeatmapOut)
def station_heatmap(
    city_id: int,
    pollutant: HourlyPollutant = "PM2.5",
    period: str = "FY2024-25",
    top: int = Query(5, ge=0, description="Stations to return, highest mean first; 0 for all"),
    session: Session = Depends(get_session),
) -> HeatmapOut:
    """Mean value for each station at each hour of the day over a period."""
    city = get_city(session, city_id)
    period_row = get_period(session, period)
    readings = hourly_readings_by_station(
        session, city_id, pollutant, period_row.start_date, period_row.end_date
    )
    rows = _heatmap_rows(session, readings)
    return HeatmapOut(
        city=city_out(city),
        pollutant=pollutant,
        unit=unit_for(pollutant),
        period=PeriodOut.model_validate(period_row),
        hour_labels=HOUR_LABELS,
        stations_total=len(rows),
        rows=rows[:top] if top else rows,
    )


@router.get("/day", response_model=DayHeatmapOut)
def day_heatmap(
    city_id: int,
    day: date,
    pollutant: HourlyPollutant = "PM2.5",
    session: Session = Depends(get_session),
) -> DayHeatmapOut:
    """Every station's value at every hour of one day (e.g. the peak day)."""
    city = get_city(session, city_id)
    readings = hourly_readings_by_station(session, city_id, pollutant, day, day)
    return DayHeatmapOut(
        city=city_out(city),
        pollutant=pollutant,
        unit=unit_for(pollutant),
        day=day,
        hour_labels=HOUR_LABELS,
        rows=_heatmap_rows(session, readings),
    )


def _station_in_city(session: Session, station_id: int, city_id: int) -> Station:
    station = session.get(Station, station_id)
    if station is None or station.city_id != city_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No station {station_id} in city {city_id}")
    return station


def _heatmap_rows(session: Session, readings: dict[int, list]) -> list[HeatmapRowOut]:
    """One row per station that has readings, highest mean first."""
    stations = {s.id: s for s in session.scalars(select(Station).where(Station.id.in_(readings)))}
    rows = [
        HeatmapRowOut(
            station=StationOut.model_validate(stations[station_id]),
            mean=round(fmean(value for _, value in station_readings), 1),
            hours=[bin_.mean for bin_ in hour_profile(station_readings)],
        )
        for station_id, station_readings in readings.items()
    ]
    return sorted(rows, key=lambda row: (-row.mean, row.station.name))


def _period_out(period: Period, summary: HourlySummary) -> HourlyPeriodOut:
    kpis = summary.kpis
    return HourlyPeriodOut(
        period=PeriodOut.model_validate(period),
        kpis=KpisOut(
            hours_with_data=kpis.hours_with_data,
            expected_hours=kpis.expected_hours,
            coverage=round(kpis.coverage, 4),
            mean=kpis.mean,
            peak=kpis.peak,
            peak_at=kpis.peak_at,
            above_naaqs_pct=kpis.above_naaqs_pct,
            above_who_pct=kpis.above_who_pct,
        ),
        hours=[
            HourBinOut(hour=b.hour, label=b.label, mean=b.mean, samples=b.samples)
            for b in summary.hours
        ],
        days=[
            DayMeanOut(day=d.day, mean=d.mean, hours=d.hours, valid=d.valid) for d in summary.days
        ],
        months=[
            MonthStatsOut(
                month=m.month,
                samples=m.samples,
                mean=m.mean,
                p10=m.p10,
                p25=m.p25,
                median=m.median,
                p75=m.p75,
                p90=m.p90,
                max=m.max,
            )
            for m in summary.months
        ],
        peak_day=summary.peak_day,
    )
