"""Latest readings from the CPCB real-time feed, as stored by the scraper."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session, utcnow
from app.domain import POLLUTANTS, Pollutant
from app.models import LiveReading, LiveStation, ScrapeRun
from app.schemas import (
    CityLatest,
    LiveCitiesResponse,
    LiveLatestResponse,
    LiveStatus,
    PollutantReading,
    ScrapeRunOut,
    StationLatest,
)

router = APIRouter(prefix="/v1/live", tags=["live"])

# A station silent for two days has no meaningful "latest" value, and the cutoff keeps
# queries small.
LOOKBACK = timedelta(hours=48)


@router.get("/latest", response_model=LiveLatestResponse)
def latest_readings(
    state: str | None = None,
    city: str | None = None,
    station_id: int | None = None,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LiveLatestResponse:
    """Newest reading of each pollutant at each station, optionally filtered by place."""
    now = utcnow()
    rank = func.row_number().over(
        partition_by=(LiveReading.station_id, LiveReading.pollutant),
        order_by=LiveReading.observed_at.desc(),
    )
    ranked = (
        select(LiveReading.id, rank.label("rank"))
        .where(LiveReading.observed_at >= now - LOOKBACK)
        .subquery()
    )
    stmt = (
        select(LiveReading, LiveStation)
        .join(LiveReading.station)
        .where(LiveReading.id.in_(select(ranked.c.id).where(ranked.c.rank == 1)))
    )
    if state:
        stmt = stmt.where(func.lower(LiveStation.state) == state.lower())
    if city:
        stmt = stmt.where(func.lower(LiveStation.city) == city.lower())
    if station_id is not None:
        stmt = stmt.where(LiveStation.id == station_id)

    stale_before = now - timedelta(hours=settings.live_stale_after_hours)
    stations: dict[int, StationLatest] = {}
    for reading, station in session.execute(stmt):
        entry = stations.setdefault(
            station.id,
            StationLatest(
                id=station.id,
                name=station.name,
                city=station.city,
                state=station.state,
                latitude=station.latitude,
                longitude=station.longitude,
                readings=[],
            ),
        )
        entry.readings.append(
            PollutantReading(
                pollutant=reading.pollutant,
                avg=reading.avg_value,
                min=reading.min_value,
                max=reading.max_value,
                observed_at=reading.observed_at,
                stale=reading.observed_at < stale_before,
            )
        )

    ordered = sorted(stations.values(), key=lambda s: s.name)
    for station in ordered:
        station.readings.sort(key=lambda r: POLLUTANTS.index(r.pollutant))
    as_of = max((r.observed_at for s in ordered for r in s.readings), default=None)
    return LiveLatestResponse(
        as_of=as_of, stale_after_hours=settings.live_stale_after_hours, stations=ordered
    )


@router.get("/cities", response_model=LiveCitiesResponse)
def city_ranking(
    pollutant: Pollutant = "PM2.5",
    state: str | None = None,
    order: Literal["desc", "asc"] = "desc",
    limit: int = Query(10, ge=1, le=500),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LiveCitiesResponse:
    """Cities ranked by the mean of their stations' latest fresh value for one pollutant."""
    fresh_since = utcnow() - timedelta(hours=settings.live_stale_after_hours)
    rank = func.row_number().over(
        partition_by=LiveReading.station_id, order_by=LiveReading.observed_at.desc()
    )
    latest = (
        select(
            LiveReading.station_id,
            LiveReading.avg_value,
            LiveReading.observed_at,
            rank.label("rank"),
        )
        .where(
            LiveReading.pollutant == pollutant,
            LiveReading.observed_at >= fresh_since,
            LiveReading.avg_value.is_not(None),
        )
        .subquery()
    )
    mean = func.avg(latest.c.avg_value).label("mean")
    stmt = (
        select(
            LiveStation.city,
            LiveStation.state,
            mean,
            func.count().label("station_count"),
            func.max(latest.c.observed_at).label("observed_at"),
        )
        .join(latest, latest.c.station_id == LiveStation.id)
        .where(latest.c.rank == 1)
        .group_by(LiveStation.city, LiveStation.state)
        .order_by(mean.desc() if order == "desc" else mean.asc(), LiveStation.city)
        .limit(limit)
    )
    if state:
        stmt = stmt.where(func.lower(LiveStation.state) == state.lower())

    cities = [
        CityLatest(
            city=row.city,
            state=row.state,
            avg=round(row.mean, 1),
            station_count=row.station_count,
            observed_at=row.observed_at,
        )
        for row in session.execute(stmt)
    ]
    return LiveCitiesResponse(pollutant=pollutant, cities=cities)


@router.get("/status", response_model=LiveStatus)
def scrape_status(session: Session = Depends(get_session)) -> LiveStatus:
    """When the scraper last ran and how fresh the stored data is."""
    last_run = session.scalars(select(ScrapeRun).order_by(ScrapeRun.id.desc()).limit(1)).first()
    last_success = session.scalars(
        select(ScrapeRun)
        .where(ScrapeRun.status == "success")
        .order_by(ScrapeRun.id.desc())
        .limit(1)
    ).first()
    data_as_of: datetime | None = session.scalar(select(func.max(LiveReading.observed_at)))
    return LiveStatus(
        last_run=ScrapeRunOut.model_validate(last_run) if last_run else None,
        last_success=ScrapeRunOut.model_validate(last_success) if last_success else None,
        data_as_of=data_as_of,
        station_count=session.scalar(select(func.count()).select_from(LiveStation)) or 0,
    )
