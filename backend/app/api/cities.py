"""City resources: the city list, per-city AQI summaries, and the data-coverage flags.

/v1/overview packs everything the Overview screen needs into one ranked response; these
endpoints serve the same numbers per city, for clients that want to fetch them piece by piece.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.overview import MIN_COVERAGE, PM25_FLOOR, rule_failures
from app.db import get_session
from app.domain import CityGroup
from app.models import City, Station
from app.queries import cities_in_scope, city_out, get_city, get_period, period_stats, stats_out
from app.schemas.history import (
    AqiSummaryOut,
    CityAqiSummaryOut,
    CityListItemOut,
    CoverageFlagOut,
    CoverageOut,
    CoverageRules,
    PeriodOut,
)

router = APIRouter(prefix="/v1", tags=["cities"])

MAX_CITY_IDS = 500
RULES = CoverageRules(min_coverage=MIN_COVERAGE, pm25_floor=PM25_FLOOR)


@router.get("/cities", response_model=list[CityListItemOut])
def list_cities(
    category: CityGroup | None = Query(None, description="City group, e.g. NCAP"),
    state: str | None = None,
    session: Session = Depends(get_session),
) -> list[CityListItemOut]:
    """Cities, optionally in one group and state, alphabetically."""
    station_counts = dict(
        session.execute(select(Station.city_id, func.count()).group_by(Station.city_id)).all()
    )
    return [
        CityListItemOut(**city_out(city).model_dump(), station_count=station_counts.get(city.id, 0))
        for city in cities_in_scope(session, state, category)
    ]


@router.get("/aqi-summary", response_model=AqiSummaryOut)
def aqi_summary(
    city_ids: str = Query(..., description="Comma-separated city ids", examples=["1,2,3"]),
    period: str = "FY2024-25",
    session: Session = Depends(get_session),
) -> AqiSummaryOut:
    """AQI category days, mean concentrations and dominant-pollutant days for each city."""
    ids = _parse_ids(city_ids)
    period_row = get_period(session, period)
    cities = {city.id: city for city in session.scalars(select(City).where(City.id.in_(ids)))}
    missing = [city_id for city_id in ids if city_id not in cities]
    if missing:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No city with id {', '.join(map(str, missing))}"
        )

    stats = period_stats(session, ids, period_row)
    return AqiSummaryOut(
        period=PeriodOut.model_validate(period_row),
        rules=RULES,
        cities=[
            CityAqiSummaryOut(
                city=city_out(cities[city_id]),
                stats=stats_out(stats[city_id]) if city_id in stats else None,
            )
            for city_id in ids
        ],
    )


@router.get("/coverage/{city_id}", response_model=CoverageOut)
def coverage(
    city_id: int, period: str = "FY2024-25", session: Session = Depends(get_session)
) -> CoverageOut:
    """Whether a city meets the data conditions for a period, and which rules it fails."""
    city = get_city(session, city_id)
    period_row = get_period(session, period)
    stats = period_stats(session, [city_id], period_row).get(city_id)
    failures = rule_failures(stats)
    pm25 = stats.pollutant_means.get("PM2.5") if stats else None
    in_base = not {"no_data", "low_coverage"} & set(failures)

    return CoverageOut(
        city=city_out(city),
        period=PeriodOut.model_validate(period_row),
        days_in_period=period_row.days,
        days_with_data=stats.days_with_data if stats else 0,
        coverage=round(stats.coverage, 4) if stats else 0.0,
        meets_min_coverage=stats is not None and stats.coverage >= MIN_COVERAGE,
        pm25_mean=round(pm25, 1) if pm25 is not None else None,
        pm25_below_floor="pm25_floor" in failures,
        included_in_base=in_base,
        included_in_pm25_chart=in_base and pm25 is not None and "pm25_floor" not in failures,
        flags=[
            CoverageFlagOut(
                code=code, applies_to="pm25_chart" if code == "pm25_floor" else "all_charts"
            )
            for code in failures
        ],
        rules=RULES,
    )


def _parse_ids(raw: str) -> list[int]:
    """Comma-separated ids as integers, in the order given, without repeats ("3, 1,3" -> [3, 1])."""
    try:
        ids = [int(part) for part in raw.split(",") if part.strip()]
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "city_ids must be comma-separated integers"
        ) from None
    if not ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "city_ids is empty")
    if len(ids) > MAX_CITY_IDS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"At most {MAX_CITY_IDS} city ids per request"
        )
    return list(dict.fromkeys(ids))
