"""Which cities the Overview lists, in what order, and why others are left out.

Mirrors the source dashboard's "Data Conditions":
- The base period is strict: a city is ranked only if it has data for at least 70% of the
  period's days.
- The comparison period is lenient: it shows the same cities, with whatever data exists.
- A PM2.5 average at or below 2 µg/m³ is treated as a sensor fault, so the city is left out of
  PM2.5 rankings.
"""

from dataclasses import dataclass, field
from typing import Literal

from app.domain import AQI_CATEGORIES, decimals_for

MIN_COVERAGE = 0.7
PM25_FLOOR = 2.0

RankBy = Literal["good_days", "PM2.5", "PM10", "NO2", "O3", "CO"]
Direction = Literal["best", "worst"]
ExclusionReason = Literal["no_data", "low_coverage", "pm25_floor"]


@dataclass
class PeriodStats:
    """One city's numbers for one period."""

    period_days: int
    days_with_data: int = 0
    aqi_days: dict[str, int] = field(default_factory=dict)
    pollutant_means: dict[str, float] = field(default_factory=dict)
    dominant_days: dict[str, int] = field(default_factory=dict)

    @property
    def coverage(self) -> float:
        return self.days_with_data / self.period_days if self.period_days else 0.0

    @property
    def good_days(self) -> int:
        return self.aqi_days.get("good", 0)

    @property
    def pm25_below_floor(self) -> bool:
        pm25 = self.pollutant_means.get("PM2.5")
        return pm25 is not None and pm25 <= PM25_FLOOR


@dataclass
class Excluded:
    city_id: int
    reason: ExclusionReason
    coverage: float | None


@dataclass
class Ranking:
    city_ids: list[int]  # ranked, already cut to the requested top N
    excluded: list[Excluded]
    eligible: int  # how many cities qualified before the top-N cut


def rank_cities(
    city_names: dict[int, str],
    base: dict[int, PeriodStats],
    rank_by: RankBy,
    direction: Direction,
    top: int | None,
) -> Ranking:
    """Rank the cities in `city_names` by their base-period stats."""
    eligible: list[int] = []
    excluded: list[Excluded] = []
    for city_id in city_names:
        reason = _exclusion_reason(base.get(city_id), rank_by)
        if reason:
            stats = base.get(city_id)
            excluded.append(Excluded(city_id, reason, stats.coverage if stats else None))
        else:
            eligible.append(city_id)

    eligible.sort(
        key=lambda city_id: (_sort_key(base[city_id], rank_by, direction), city_names[city_id])
    )
    excluded.sort(key=lambda e: city_names[e.city_id])
    return Ranking(
        city_ids=eligible if top is None else eligible[:top],
        excluded=excluded,
        eligible=len(eligible),
    )


def _exclusion_reason(stats: PeriodStats | None, rank_by: RankBy) -> ExclusionReason | None:
    if stats is None or stats.days_with_data == 0:
        return "no_data"
    if stats.coverage < MIN_COVERAGE:
        return "low_coverage"
    if rank_by != "good_days" and rank_by not in stats.pollutant_means:
        return "no_data"
    if rank_by == "PM2.5" and stats.pm25_below_floor:
        return "pm25_floor"
    return None


def _sort_key(stats: PeriodStats, rank_by: RankBy, direction: Direction) -> float:
    """Ascending sort key: best-first puts high good-day counts and low concentrations first."""
    if rank_by == "good_days":
        value, higher_is_better = float(stats.good_days), True
    else:
        value, higher_is_better = stats.pollutant_means[rank_by], False
    larger_first = higher_is_better == (direction == "best")
    return -value if larger_first else value


@dataclass
class Change:
    """Comparison minus base. Only computed when both periods have data."""

    aqi_days: dict[str, int]
    pollutant_means: dict[str, float]
    dominant_days: dict[str, int]
    coverage: float


def change_between(base: PeriodStats, comparison: PeriodStats | None) -> Change | None:
    if comparison is None or comparison.days_with_data == 0:
        return None
    pollutants = base.pollutant_means.keys() & comparison.pollutant_means.keys()
    dominant = base.dominant_days.keys() | comparison.dominant_days.keys()

    def mean_delta(pollutant: str) -> float:
        # Subtract the rounded values the app displays, so "18.2 -> 15.4" shows a change of
        # 2.8 rather than the 2.9 the unrounded means would give.
        digits = decimals_for(pollutant)
        before = round(base.pollutant_means[pollutant], digits)
        after = round(comparison.pollutant_means[pollutant], digits)
        return round(after - before, digits)

    return Change(
        aqi_days={
            c: comparison.aqi_days.get(c, 0) - base.aqi_days.get(c, 0) for c in AQI_CATEGORIES
        },
        pollutant_means={p: mean_delta(p) for p in sorted(pollutants)},
        dominant_days={
            p: comparison.dominant_days.get(p, 0) - base.dominant_days.get(p, 0)
            for p in sorted(dominant)
        },
        coverage=round(comparison.coverage - base.coverage, 4),
    )
