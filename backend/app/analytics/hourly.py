"""Statistics for one station, or a city average, over one period of hourly data.

Timestamps are hour-ending, as CPCB publishes them: the value stamped 01:00 covers 00:00-01:00.
So the value stamped 00:00 on the 2nd belongs to the 1st, and the hour-of-day bins run
01:00 ... 23:00, 00:00, matching the source dashboard.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from statistics import fmean, quantiles

from app.domain import IST, Limits

# CPCB computes a 24-hour average only when at least 16 of the 24 hourly values exist.
MIN_HOURS_FOR_DAILY_MEAN = 16

Reading = tuple[datetime, float]  # (hour-ending timestamp, value)


def period_window(start: date, end: date) -> tuple[datetime, datetime]:
    """Hour-ending timestamps (exclusive, inclusive) covering the IST days start..end."""
    return (
        datetime.combine(start, time(0), IST),
        datetime.combine(end + timedelta(days=1), time(0), IST),
    )


@dataclass
class HourBin:
    hour: int  # 1-24, where 24 is the hour ending at midnight
    mean: float | None
    samples: int

    @property
    def label(self) -> str:
        return f"{self.hour % 24:02d}:00"


@dataclass
class DayMean:
    day: date
    mean: float
    hours: int

    @property
    def valid(self) -> bool:
        return self.hours >= MIN_HOURS_FOR_DAILY_MEAN


@dataclass
class MonthStats:
    month: date  # first day of the month
    samples: int
    mean: float
    p10: float
    p25: float
    median: float
    p75: float
    p90: float
    max: float


@dataclass
class Kpis:
    hours_with_data: int
    expected_hours: int
    mean: float | None
    peak: float | None
    peak_at: datetime | None
    above_naaqs_pct: float | None
    above_who_pct: float | None

    @property
    def coverage(self) -> float:
        return self.hours_with_data / self.expected_hours if self.expected_hours else 0.0


@dataclass
class HourlySummary:
    kpis: Kpis
    hours: list[HourBin]
    days: list[DayMean]
    months: list[MonthStats]
    peak_day: date | None


def summarize(
    readings: list[Reading], start: date, end: date, limits: Limits | None
) -> HourlySummary:
    values = [value for _, value in readings]
    days = daily_means(readings)
    valid_days = [d for d in days if d.valid]
    peak_at, peak = max(readings, key=lambda r: r[1]) if readings else (None, None)

    return HourlySummary(
        kpis=Kpis(
            hours_with_data=len(values),
            expected_hours=((end - start).days + 1) * 24,
            mean=_round(fmean(values)) if values else None,
            peak=_round(peak) if peak is not None else None,
            peak_at=peak_at.astimezone(IST) if peak_at else None,
            above_naaqs_pct=_share_above(values, limits.naaqs) if limits else None,
            above_who_pct=_share_above(values, limits.who) if limits else None,
        ),
        hours=hour_profile(readings),
        days=days,
        months=monthly_stats(readings),
        peak_day=max(valid_days, key=lambda d: d.mean).day if valid_days else None,
    )


def hour_profile(readings: Iterable[Reading]) -> list[HourBin]:
    by_hour: dict[int, list[float]] = defaultdict(list)
    for observed_at, value in readings:
        by_hour[_hour_bin(observed_at)].append(value)
    return [
        HourBin(hour, _round(fmean(by_hour[hour])) if by_hour[hour] else None, len(by_hour[hour]))
        for hour in range(1, 25)
    ]


def daily_means(readings: Iterable[Reading]) -> list[DayMean]:
    by_day: dict[date, list[float]] = defaultdict(list)
    for observed_at, value in readings:
        by_day[_day_of(observed_at)].append(value)
    return [DayMean(day, _round(fmean(v)), len(v)) for day, v in sorted(by_day.items())]


def monthly_stats(readings: Iterable[Reading]) -> list[MonthStats]:
    by_month: dict[date, list[float]] = defaultdict(list)
    for observed_at, value in readings:
        by_month[_day_of(observed_at).replace(day=1)].append(value)

    stats = []
    for month, values in sorted(by_month.items()):
        # 5% steps: index 1 is p10, 4 is p25, 9 the median, 14 p75, 17 p90.
        cuts = quantiles(values, n=20, method="inclusive") if len(values) > 1 else [values[0]] * 19
        stats.append(
            MonthStats(
                month=month,
                samples=len(values),
                mean=_round(fmean(values)),
                p10=_round(cuts[1]),
                p25=_round(cuts[4]),
                median=_round(cuts[9]),
                p75=_round(cuts[14]),
                p90=_round(cuts[17]),
                max=_round(max(values)),
            )
        )
    return stats


def _hour_bin(observed_at: datetime) -> int:
    hour = observed_at.astimezone(IST).hour
    return 24 if hour == 0 else hour


def _day_of(observed_at: datetime) -> date:
    """The IST day an hour-ending timestamp belongs to."""
    return (observed_at.astimezone(IST) - timedelta(hours=1)).date()


def _share_above(values: list[float], limit: float) -> float | None:
    if not values:
        return None
    return _round(100 * sum(v > limit for v in values) / len(values))


def _round(value: float) -> float:
    return round(value, 1)
