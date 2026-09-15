"""An estimated CPCB AQI from the scraper's hourly model concentrations.

CPCB's National AQI turns each pollutant's concentration into a sub-index on a 0-500 scale with
fixed breakpoints, and the AQI is the highest sub-index. Concentrations are averaged first: over
24 hours for PM2.5, PM10, NO2 and SO2, and for CO and O3 the highest 8-hour average in those 24
hours. A 24-hour average needs at least 16 hours of data, and an AQI needs three pollutants, one
of them PM2.5 or PM10.

The concentrations come from a forecast model, not monitors, so the result is an estimate of
what CPCB's formula would give for the area, and the API labels it that way. Ozone is left out of
it (see LEFT_OUT).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import fmean

from app.domain import POLLUTANTS, AqiCategory

MIN_POLLUTANTS = 3
PARTICULATES = frozenset({"PM2.5", "PM10"})
# Upper AQI bound of each CPCB category; above the last one is Severe.
CATEGORY_BOUNDS: tuple[tuple[int, AqiCategory], ...] = (
    (50, "good"),
    (100, "satisfactory"),
    (200, "moderate"),
    (300, "poor"),
    (400, "very_poor"),
)
INDEX_BOUNDS = (50, 100, 200, 300, 400)
# Concentration at the top of Good, Satisfactory, Moderate, Poor and Very Poor, from CPCB's AQI
# table (µg/m³; CO in mg/m³). The app colours concentrations with the same numbers
# (mobile/src/constants/pollutants.ts).
BREAKPOINTS: dict[str, tuple[float, float, float, float, float]] = {
    "PM2.5": (30, 60, 90, 120, 250),
    "PM10": (50, 100, 250, 350, 430),
    "NO2": (40, 80, 180, 280, 400),
    "SO2": (40, 80, 380, 800, 1600),
    "CO": (1, 2, 10, 17, 34),
    "O3": (50, 100, 168, 208, 748),
    "NH3": (200, 400, 800, 1200, 1800),
}
EIGHT_HOUR = frozenset({"CO", "O3"})
# Stored and shown, but not used in the estimate. Checked against CPCB monitors, CAMS ozone over
# India runs far too high: mean biases of 42-108 µg/m³ where the observed daily means were
# 7-58 µg/m³ (Bulletin of Atmospheric Science and Technology, 2025, doi:10.1007/s42865-025-00109-x,
# on the CAMS reanalysis). The first scrape here showed the same thing: 8-hour ozone near
# 200 µg/m³ across north India, which alone would have put Delhi in "Poor" on 15 Sep 2026.
LEFT_OUT = frozenset({"O3"})
HOURS = 24
MIN_HOURS = 16  # CPCB's minimum for a 24-hour average
WINDOW = 8
# CPCB states no minimum for an 8-hour average; this uses the same two-thirds share as 16 of 24.
MIN_WINDOW_HOURS = 6

Series = dict[datetime, float]  # hour -> concentration


@dataclass(frozen=True)
class EstimatedAqi:
    value: int
    category: AqiCategory
    dominant: str  # the pollutant with the highest sub-index
    sub_indices: dict[str, int]  # in POLLUTANTS order


def aqi_category(aqi: float) -> AqiCategory:
    for upper, category in CATEGORY_BOUNDS:
        if aqi <= upper:
            return category
    return "severe"


def sub_index(pollutant: str, concentration: float) -> int:
    """CPCB's sub-index: linear within each category band.

    The table stops at the bottom of Severe, so above it the Very Poor band's slope carries on,
    capped at 500.
    """
    bounds = BREAKPOINTS[pollutant]
    concentration = max(0.0, concentration)
    low_c, low_i = 0.0, 0
    for high_c, high_i in zip(bounds, INDEX_BOUNDS, strict=True):
        if concentration <= high_c:
            return round(low_i + (concentration - low_c) * (high_i - low_i) / (high_c - low_c))
        low_c, low_i = high_c, high_i
    slope = 100 / (bounds[-1] - bounds[-2])
    return min(500, round(400 + (concentration - bounds[-1]) * slope))


def averaged(pollutant: str, hourly: Series, at: datetime) -> float | None:
    """The concentration CPCB's formula uses for `pollutant` at hour `at`, or None if too few
    hours have data."""
    day = [hourly.get(at - timedelta(hours=back)) for back in range(HOURS)]  # newest first
    if pollutant in EIGHT_HOUR:
        means = []
        for start in range(HOURS - WINDOW + 1):
            values = [v for v in day[start : start + WINDOW] if v is not None]
            if len(values) >= MIN_WINDOW_HOURS:
                means.append(fmean(values))
        return max(means, default=None)
    values = [v for v in day if v is not None]
    return fmean(values) if len(values) >= MIN_HOURS else None


def estimate_aqi(series: dict[str, Series], at: datetime) -> EstimatedAqi | None:
    """The AQI at hour `at` from each pollutant's hourly series, or None if CPCB's minimum-data
    rules aren't met."""
    sub_indices: dict[str, int] = {}
    for pollutant in POLLUTANTS:
        if pollutant in series and pollutant in BREAKPOINTS and pollutant not in LEFT_OUT:
            concentration = averaged(pollutant, series[pollutant], at)
            if concentration is not None:
                sub_indices[pollutant] = sub_index(pollutant, concentration)
    if len(sub_indices) < MIN_POLLUTANTS or not sub_indices.keys() & PARTICULATES:
        return None
    # Ties go to the pollutant listed first (PM2.5 before PM10, and so on).
    dominant = max(sub_indices, key=lambda p: (sub_indices[p], -POLLUTANTS.index(p)))
    value = sub_indices[dominant]
    return EstimatedAqi(value, aqi_category(value), dominant, sub_indices)
