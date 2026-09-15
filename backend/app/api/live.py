"""The scraper's model values: cities ranked by estimated AQI, one city's latest hour, and the
scraper's own status."""

from collections import defaultdict
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.live import HOURS, EstimatedAqi, Series, estimate_aqi
from app.config import Settings, get_settings
from app.db import get_session, utcnow
from app.domain import (
    IST,
    LIVE_ATTRIBUTION,
    LIVE_ATTRIBUTION_URL,
    LIVE_SOURCE,
    POLLUTANTS,
    CityGroup,
    unit_for,
)
from app.models import LiveReading, ScrapeRun
from app.queries import cities_in_scope, city_out, get_city
from app.schemas import (
    CityLiveOut,
    EstimatedAqiOut,
    LiveCitiesResponse,
    LiveCityRankOut,
    LiveReadingOut,
    LiveStatus,
    ScrapeRunOut,
)

router = APIRouter(prefix="/v1/live", tags=["live"])

# A city with nothing in two days has no meaningful "latest" value.
LOOKBACK = timedelta(hours=48)


@router.get("/cities", response_model=LiveCitiesResponse)
def city_ranking(
    state: str | None = None,
    group: CityGroup | None = None,
    order: Literal["desc", "asc"] = "desc",
    limit: int = Query(10, ge=1, le=500),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LiveCitiesResponse:
    """Cities ranked by estimated AQI at their newest hour, worst first by default.

    Cities whose newest hour is older than `stale_after_hours`, or without enough data for an
    AQI, are left out.
    """
    fresh_since = utcnow() - timedelta(hours=settings.live_stale_after_hours)
    cities = {city.id: city for city in cities_in_scope(session, state, group)}
    # The AQI at an hour averages the 24 hours before it.
    series = _series(session, fresh_since - timedelta(hours=HOURS), cities)

    ranked: list[LiveCityRankOut] = []
    for city_id, by_pollutant in series.items():
        newest = _newest(by_pollutant)
        aqi = estimate_aqi(by_pollutant, newest) if newest >= fresh_since else None
        if aqi:
            ranked.append(
                LiveCityRankOut(
                    city=city_out(cities[city_id]),
                    aqi=_aqi_out(aqi),
                    observed_at=newest.astimezone(IST),
                )
            )
    ranked.sort(key=lambda row: row.city.name)
    ranked.sort(key=lambda row: row.aqi.value, reverse=order == "desc")
    return LiveCitiesResponse(**_source(settings), cities=ranked[:limit])


@router.get("/cities/{city_id}", response_model=CityLiveOut)
def city_latest(
    city_id: int,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> CityLiveOut:
    """One city's newest hour of model values, with the estimated AQI."""
    city = get_city(session, city_id)
    common = {"city": city_out(city), **_source(settings)}
    empty = {"observed_at": None, "fetched_at": None, "aqi": None, "readings": []}
    if city.latitude is None or city.longitude is None:
        return CityLiveOut(**common, **empty, status="not_in_feed")

    now = utcnow()
    rows = session.scalars(
        select(LiveReading)
        .where(LiveReading.city_id == city_id, LiveReading.observed_at >= now - LOOKBACK)
        .order_by(LiveReading.observed_at)
    ).all()
    if not rows:
        return CityLiveOut(**common, **empty, status="no_recent_readings")

    by_pollutant: dict[str, Series] = defaultdict(dict)
    for row in rows:
        by_pollutant[row.pollutant][row.observed_at] = row.value
    newest = _newest(by_pollutant)
    current = sorted(
        (row for row in rows if row.observed_at == newest),
        key=lambda row: POLLUTANTS.index(row.pollutant),
    )
    aqi = estimate_aqi(by_pollutant, newest)
    stale_before = now - timedelta(hours=settings.live_stale_after_hours)
    return CityLiveOut(
        **common,
        status="stale" if newest < stale_before else "ok",
        observed_at=newest.astimezone(IST),
        fetched_at=max(row.fetched_at for row in current).astimezone(IST),
        aqi=_aqi_out(aqi) if aqi else None,
        readings=[
            LiveReadingOut(
                pollutant=row.pollutant,
                value=row.value,
                unit=unit_for(row.pollutant),
                observed_at=row.observed_at.astimezone(IST),
            )
            for row in current
        ],
    )


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
    recent_cities = select(func.count(func.distinct(LiveReading.city_id))).where(
        LiveReading.observed_at >= utcnow() - LOOKBACK
    )
    return LiveStatus(
        last_run=ScrapeRunOut.model_validate(last_run) if last_run else None,
        last_success=ScrapeRunOut.model_validate(last_success) if last_success else None,
        data_as_of=session.scalar(select(func.max(LiveReading.observed_at))),
        cities_with_readings=session.scalar(recent_cities) or 0,
    )


def _series(
    session: Session, since: datetime, city_ids: Iterable[int]
) -> dict[int, dict[str, Series]]:
    """{city id: {pollutant: {hour: value}}} for readings since `since`."""
    series: dict[int, dict[str, Series]] = defaultdict(lambda: defaultdict(dict))
    rows = session.execute(
        select(
            LiveReading.city_id, LiveReading.pollutant, LiveReading.observed_at, LiveReading.value
        ).where(LiveReading.observed_at >= since, LiveReading.city_id.in_(list(city_ids)))
    )
    for city_id, pollutant, observed_at, value in rows:
        series[city_id][pollutant][observed_at] = value
    return series


def _newest(by_pollutant: dict[str, Series]) -> datetime:
    return max(hour for hourly in by_pollutant.values() for hour in hourly)


def _aqi_out(aqi: EstimatedAqi) -> EstimatedAqiOut:
    return EstimatedAqiOut(
        value=aqi.value, category=aqi.category, dominant=aqi.dominant, sub_indices=aqi.sub_indices
    )


def _source(settings: Settings) -> dict:
    return {
        "source": LIVE_SOURCE,
        "attribution": LIVE_ATTRIBUTION,
        "attribution_url": LIVE_ATTRIBUTION_URL,
        "stale_after_hours": settings.live_stale_after_hours,
    }
