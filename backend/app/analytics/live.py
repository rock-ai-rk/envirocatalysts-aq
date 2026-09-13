"""A station's AQI from the CPCB real-time feed.

The feed publishes, per station and pollutant, an average, minimum and maximum on the AQI
*sub-index* scale (0-500), not concentrations. Checked against live records on 13 Sep 2026: CO
appears as 12 or 25, which as mg/m³ would be far beyond anything measured, and as a sub-index
means about 0.2-0.5 mg/m³, a normal level.

CPCB's AQI is the highest sub-index, and is reported only when at least three pollutants have
values and one of them is PM2.5 or PM10.
"""

from dataclasses import dataclass

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


@dataclass(frozen=True)
class StationAqi:
    value: int
    category: AqiCategory
    dominant: str  # the pollutant with the highest sub-index
    pollutants_used: int


def aqi_category(aqi: float) -> AqiCategory:
    for upper, category in CATEGORY_BOUNDS:
        if aqi <= upper:
            return category
    return "severe"


def station_aqi(sub_indices: dict[str, float | None]) -> StationAqi | None:
    """AQI from one timestamp's sub-indices, or None if CPCB's minimum-data rule isn't met."""
    values = {p: v for p, v in sub_indices.items() if v is not None}
    if len(values) < MIN_POLLUTANTS or not values.keys() & PARTICULATES:
        return None
    # Ties go to the pollutant listed first (PM2.5 before PM10, and so on).
    dominant = max(values, key=lambda p: (values[p], -POLLUTANTS.index(p)))
    value = round(values[dominant])
    return StationAqi(value, aqi_category(value), dominant, len(values))
