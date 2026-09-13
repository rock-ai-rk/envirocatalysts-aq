"""Database reads shared by the Overview and Hourly endpoints."""

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.hourly import Reading, period_window
from app.analytics.overview import Change, PeriodStats
from app.domain import AQI_CATEGORIES, HOURLY_COLUMNS, decimals_for
from app.models import (
    City,
    CityAqiDays,
    CityDominantDays,
    CityGroupMember,
    CityPollutantMean,
    Period,
    Station,
    StationHourly,
)
from app.schemas.history import CityChangeOut, CityOut, CityPeriodStatsOut


def get_period(session: Session, key: str) -> Period:
    period = session.scalar(select(Period).where(Period.key == key))
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No data for period {key!r}")
    return period


def get_city(session: Session, city_id: int) -> City:
    city = session.get(City, city_id)
    if city is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No city with id {city_id}")
    return city


def cities_in_scope(session: Session, state: str | None, group: str | None) -> list[City]:
    stmt = select(City).order_by(City.name)
    if state:
        stmt = stmt.where(func.lower(City.state) == state.lower())
    if group:
        stmt = stmt.where(
            City.id.in_(select(CityGroupMember.city_id).where(CityGroupMember.code == group))
        )
    return list(session.scalars(stmt))


def period_stats(
    session: Session, city_ids: Iterable[int], period: Period
) -> dict[int, PeriodStats]:
    """Each city's numbers for one period, keyed by city id. Cities without rows are absent."""
    ids = list(city_ids)
    stats: dict[int, PeriodStats] = {}

    def entry(city_id: int) -> PeriodStats:
        return stats.setdefault(city_id, PeriodStats(period_days=period.days))

    for row in session.scalars(
        select(CityAqiDays).where(CityAqiDays.period_id == period.id, CityAqiDays.city_id.in_(ids))
    ):
        city = entry(row.city_id)
        city.days_with_data = row.days_with_data
        city.aqi_days = {category: getattr(row, category) for category in AQI_CATEGORIES}
    for row in session.scalars(
        select(CityPollutantMean).where(
            CityPollutantMean.period_id == period.id, CityPollutantMean.city_id.in_(ids)
        )
    ):
        entry(row.city_id).pollutant_means[row.pollutant] = row.mean
    for row in session.scalars(
        select(CityDominantDays).where(
            CityDominantDays.period_id == period.id, CityDominantDays.city_id.in_(ids)
        )
    ):
        entry(row.city_id).dominant_days[row.pollutant] = row.days
    return stats


def get_station(session: Session, station_id: int) -> Station:
    station = session.get(Station, station_id)
    if station is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No station with id {station_id}")
    return station


def hourly_readings(
    session: Session, city_id: int, station_id: int | None, pollutant: str, start: date, end: date
) -> list[Reading]:
    """Hourly values for one station, or the mean across the city's stations for each hour."""
    after, until = period_window(start, end)
    if station_id is not None:
        return station_readings(session, station_id, pollutant, after, until)

    column = getattr(StationHourly, HOURLY_COLUMNS[pollutant])
    stmt = (
        select(StationHourly.observed_at, func.avg(column))
        .join(Station, Station.id == StationHourly.station_id)
        .where(
            Station.city_id == city_id,
            StationHourly.observed_at > after,
            StationHourly.observed_at <= until,
            column.is_not(None),
        )
        .group_by(StationHourly.observed_at)
        .order_by(StationHourly.observed_at)
    )
    return [(observed_at, value) for observed_at, value in session.execute(stmt)]


def station_readings(
    session: Session, station_id: int, pollutant: str, after: datetime, until: datetime
) -> list[Reading]:
    """One station's hourly values with hour-ending timestamps in (after, until], oldest first."""
    column = getattr(StationHourly, HOURLY_COLUMNS[pollutant])
    stmt = (
        select(StationHourly.observed_at, column)
        .where(
            StationHourly.station_id == station_id,
            StationHourly.observed_at > after,
            StationHourly.observed_at <= until,
            column.is_not(None),
        )
        .order_by(StationHourly.observed_at)
    )
    return [(observed_at, value) for observed_at, value in session.execute(stmt)]


def station_data_extent(
    session: Session, station_id: int, pollutant: str
) -> tuple[datetime | None, datetime | None]:
    """The first and last hour a station has a value for a pollutant."""
    column = getattr(StationHourly, HOURLY_COLUMNS[pollutant])
    first, last = session.execute(
        select(func.min(StationHourly.observed_at), func.max(StationHourly.observed_at)).where(
            StationHourly.station_id == station_id, column.is_not(None)
        )
    ).one()
    return first, last


def hourly_readings_by_station(
    session: Session, city_id: int, pollutant: str, start: date, end: date
) -> dict[int, list[Reading]]:
    column = getattr(StationHourly, HOURLY_COLUMNS[pollutant])
    after, until = period_window(start, end)
    stmt = (
        select(StationHourly.station_id, StationHourly.observed_at, column)
        .join(Station, Station.id == StationHourly.station_id)
        .where(
            Station.city_id == city_id,
            StationHourly.observed_at > after,
            StationHourly.observed_at <= until,
            column.is_not(None),
        )
    )
    readings: dict[int, list[Reading]] = defaultdict(list)
    for station_id, observed_at, value in session.execute(stmt):
        readings[station_id].append((observed_at, value))
    return readings


def city_out(city: City) -> CityOut:
    return CityOut(
        id=city.id,
        name=city.name,
        state=city.state,
        latitude=city.latitude,
        longitude=city.longitude,
        groups=city.group_codes,
    )


def stats_out(stats: PeriodStats) -> CityPeriodStatsOut:
    return CityPeriodStatsOut(
        coverage=round(stats.coverage, 4),
        days_with_data=stats.days_with_data,
        aqi_days={category: stats.aqi_days.get(category, 0) for category in AQI_CATEGORIES},
        pollutant_means={p: round(v, decimals_for(p)) for p, v in stats.pollutant_means.items()},
        dominant_days=dict(stats.dominant_days),
        pm25_below_floor=stats.pm25_below_floor,
    )


def change_out(change: Change | None) -> CityChangeOut | None:
    if change is None:
        return None
    return CityChangeOut(
        aqi_days=change.aqi_days,
        pollutant_means=change.pollutant_means,
        dominant_days=change.dominant_days,
        coverage=change.coverage,
    )
