"""The Main Overview & Comparison screen."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.analytics.overview import (
    MIN_COVERAGE,
    PM25_FLOOR,
    Direction,
    RankBy,
    change_between,
    rank_cities,
)
from app.db import get_session
from app.domain import CityGroup
from app.models import Station
from app.queries import (
    change_out,
    cities_in_scope,
    city_out,
    get_city,
    get_period,
    period_stats,
    stats_out,
)
from app.schemas.history import (
    CityDetailOut,
    CoverageRules,
    ExcludedCityOut,
    OverviewCity,
    OverviewOut,
    PeriodOut,
)

router = APIRouter(prefix="/v1", tags=["overview"])


@router.get("/overview", response_model=OverviewOut)
def overview(
    base: str = "FY2024-25",
    comparison: str = "FY2025-26",
    state: str | None = None,
    group: CityGroup | None = None,
    rank_by: RankBy = "good_days",
    direction: Direction = "best",
    top: int = Query(10, ge=0, description="How many cities to return; 0 returns all of them"),
    session: Session = Depends(get_session),
) -> OverviewOut:
    """Ranked cities with both periods and the change between them, in one response.

    Everything the four Overview tabs (AQI days, pollutant levels, dominant pollutant, map) need
    comes back at once, so switching tabs or periods in the app needs no further request.
    """
    base_period = get_period(session, base)
    comparison_period = get_period(session, comparison)
    cities = {city.id: city for city in cities_in_scope(session, state, group)}
    base_stats = period_stats(session, cities, base_period)
    comparison_stats = period_stats(session, cities, comparison_period)

    ranking = rank_cities(
        {city_id: city.name for city_id, city in cities.items()},
        base_stats,
        rank_by,
        direction,
        top or None,
    )
    return OverviewOut(
        base=PeriodOut.model_validate(base_period),
        comparison=PeriodOut.model_validate(comparison_period),
        rank_by=rank_by,
        direction=direction,
        top=top or None,
        cities_in_scope=len(cities),
        eligible=ranking.eligible,
        cities=[
            OverviewCity(
                rank=position,
                city=city_out(cities[city_id]),
                base=stats_out(base_stats[city_id]),
                comparison=stats_out(comparison_stats[city_id])
                if city_id in comparison_stats
                else None,
                change=change_out(
                    change_between(base_stats[city_id], comparison_stats.get(city_id))
                ),
            )
            for position, city_id in enumerate(ranking.city_ids, start=1)
        ],
        excluded=[
            ExcludedCityOut(city=city_out(cities[e.city_id]), reason=e.reason, coverage=e.coverage)
            for e in ranking.excluded
        ],
        rules=CoverageRules(min_coverage=MIN_COVERAGE, pm25_floor=PM25_FLOOR),
    )


@router.get("/cities/{city_id}", response_model=CityDetailOut)
def city_detail(
    city_id: int,
    base: str = "FY2024-25",
    comparison: str = "FY2025-26",
    session: Session = Depends(get_session),
) -> CityDetailOut:
    """One city's numbers for both periods, whether or not it qualified for the ranking."""
    city = get_city(session, city_id)
    base_period = get_period(session, base)
    comparison_period = get_period(session, comparison)
    base_stats = period_stats(session, [city_id], base_period).get(city_id)
    comparison_stats = period_stats(session, [city_id], comparison_period).get(city_id)

    return CityDetailOut(
        city=city_out(city),
        base=PeriodOut.model_validate(base_period),
        comparison=PeriodOut.model_validate(comparison_period),
        base_stats=stats_out(base_stats) if base_stats else None,
        comparison_stats=stats_out(comparison_stats) if comparison_stats else None,
        change=change_out(change_between(base_stats, comparison_stats)) if base_stats else None,
        has_hourly_data=bool(session.scalar(select(exists().where(Station.city_id == city_id)))),
    )
