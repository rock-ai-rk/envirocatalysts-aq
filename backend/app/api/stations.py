"""Station resources: an hourly series over any window.

The live model values are per city, not per station: see /v1/live/cities/{city_id}.
"""

from datetime import datetime, timedelta
from statistics import fmean
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.analytics.hourly import Reading, daily_means
from app.db import get_session
from app.domain import IST, LIMITS, HourlyPollutant, decimals_for, unit_for
from app.queries import city_out, get_station, station_data_extent, station_readings
from app.schemas.history import (
    SeriesPointOut,
    SeriesStatsOut,
    StationOut,
    StationSeriesOut,
    Thresholds,
)

router = APIRouter(prefix="/v1/stations", tags=["stations"])

HOUR = timedelta(hours=1)
# Up to 31 days comes back hour by hour (at most 744 points); longer windows as daily means, so
# a full financial year is 365 points rather than 8,760.
HOURLY_MAX_SPAN = timedelta(days=31)
MAX_SPAN = timedelta(days=400)


@router.get("/{station_id}/hourly", response_model=StationSeriesOut)
def station_hourly(
    station_id: int,
    start: datetime = Query(
        ...,
        alias="from",
        description="Window start, exclusive. A date or ISO datetime; without an offset it is IST.",
        examples=["2025-03-01"],
    ),
    end: datetime = Query(
        ..., alias="to", description="Window end, inclusive.", examples=["2025-04-01"]
    ),
    pollutant: HourlyPollutant = "PM2.5",
    resolution: Literal["auto", "hour", "day"] = Query(
        "auto", description="auto: hourly for windows up to 31 days, daily means beyond"
    ),
    session: Session = Depends(get_session),
) -> StationSeriesOut:
    """One station's values in a window, with gaps as nulls.

    Timestamps are hour-ending, as CPCB labels them, so from=2025-03-01&to=2025-03-02 is the 24
    hours of 1 March (01:00 ... 00:00).
    """
    start, end = _in_ist(start), _in_ist(end)
    span = end - start
    if span <= timedelta(0):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "`to` must be after `from`")
    if span > MAX_SPAN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Window is limited to {MAX_SPAN.days} days"
        )
    if resolution == "hour" and span > HOURLY_MAX_SPAN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Hourly resolution is limited to {HOURLY_MAX_SPAN.days} days; use day or auto",
        )

    station = get_station(session, station_id)
    readings = station_readings(session, station_id, pollutant, start, end)
    hours = _hour_grid(start, end)
    daily = resolution == "day" or (resolution == "auto" and span > HOURLY_MAX_SPAN)
    digits = decimals_for(pollutant)
    first, last = station_data_extent(session, station_id, pollutant)
    limits = LIMITS.get(pollutant)

    return StationSeriesOut(
        station=StationOut.model_validate(station),
        city=city_out(station.city),
        pollutant=pollutant,
        unit=unit_for(pollutant),
        thresholds=Thresholds(naaqs=limits.naaqs, who=limits.who) if limits else None,
        start=start,
        end=end,
        resolution="day" if daily else "hour",
        points=_daily_points(readings, hours, digits)
        if daily
        else _hourly_points(readings, hours, digits),
        stats=_stats(readings, len(hours), digits),
        available_from=first.astimezone(IST) if first else None,
        available_to=last.astimezone(IST) if last else None,
    )


def _in_ist(moment: datetime) -> datetime:
    return moment.replace(tzinfo=IST) if moment.tzinfo is None else moment.astimezone(IST)


def _hour_grid(start: datetime, end: datetime) -> list[datetime]:
    """Every hour-ending timestamp in (start, end]."""
    hour = start.replace(minute=0, second=0, microsecond=0) + HOUR
    hours = []
    while hour <= end:
        hours.append(hour)
        hour += HOUR
    return hours


def _hourly_points(
    readings: list[Reading], hours: list[datetime], digits: int
) -> list[SeriesPointOut]:
    values = {observed_at: value for observed_at, value in readings}
    return [
        SeriesPointOut(t=hour, value=round(values[hour], digits) if hour in values else None)
        for hour in hours
    ]


def _daily_points(
    readings: list[Reading], hours: list[datetime], digits: int
) -> list[SeriesPointOut]:
    by_day = {day.day: day for day in daily_means(readings)}
    # The day an hour-ending timestamp belongs to: 00:00 on the 2nd closes the 1st.
    days = sorted({(hour - HOUR).date() for hour in hours})
    points = []
    for day in days:
        midnight = datetime.combine(day, datetime.min.time(), IST)
        stats = by_day.get(day)
        points.append(
            SeriesPointOut(
                t=midnight,
                value=round(stats.mean, digits) if stats else None,
                min=round(stats.min, digits) if stats else None,
                max=round(stats.max, digits) if stats else None,
                hours=stats.hours if stats else 0,
            )
        )
    return points


def _stats(readings: list[Reading], expected_hours: int, digits: int) -> SeriesStatsOut:
    if not readings:
        return SeriesStatsOut(
            hours_with_data=0,
            expected_hours=expected_hours,
            mean=None,
            max=None,
            max_at=None,
            min=None,
            min_at=None,
        )
    max_at, max_value = max(readings, key=lambda r: r[1])
    min_at, min_value = min(readings, key=lambda r: r[1])
    return SeriesStatsOut(
        hours_with_data=len(readings),
        expected_hours=expected_hours,
        mean=round(fmean(value for _, value in readings), digits),
        max=round(max_value, digits),
        max_at=max_at.astimezone(IST),
        min=round(min_value, digits),
        min_at=min_at.astimezone(IST),
    )
