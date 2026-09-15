"""Turn Open-Meteo's answer for one place into typed readings.

The answer holds parallel arrays: `hourly.time` (ISO 8601 hours, UTC because the client asks for
GMT) and one array per variable, with null where the model has no value. Every variable comes in
µg/m³; CO is converted to mg/m³, the unit CPCB and the historical data use. Hours after `now` are
still forecasts, so they are left out.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

# Open-Meteo variable -> pollutant. NH3 is only modelled for Europe, so it isn't asked for.
VARIABLES: dict[str, str] = {
    "pm2_5": "PM2.5",
    "pm10": "PM10",
    "nitrogen_dioxide": "NO2",
    "sulphur_dioxide": "SO2",
    "carbon_monoxide": "CO",
    "ozone": "O3",
}
# The API writes the micro sign as a Greek mu (U+03BC); accept either spelling.
MICROGRAMS = {"μg/m³", "µg/m³"}


class InvalidAnswer(ValueError):
    """An answer that can't be read: missing arrays, arrays of different lengths, or a new unit."""


@dataclass(frozen=True)
class Reading:
    pollutant: str
    value: float
    observed_at: datetime


def parse_answer(answer: dict, now: datetime) -> tuple[list[Reading], int]:
    """The readings for hours up to `now`, and how many of those hours had no value."""
    hourly = answer.get("hourly") or {}
    units = answer.get("hourly_units") or {}
    times = hourly.get("time")
    if not isinstance(times, list):
        raise InvalidAnswer("no hourly times")
    hours = [_hour(stamp) for stamp in times]
    past = [index for index, hour in enumerate(hours) if hour <= now]

    readings: list[Reading] = []
    missing = 0
    for variable, pollutant in VARIABLES.items():
        values = hourly.get(variable)
        if not isinstance(values, list) or len(values) != len(times):
            raise InvalidAnswer(f"{variable} is missing or doesn't match the hours")
        if units.get(variable) not in MICROGRAMS:
            raise InvalidAnswer(f"{variable} is in {units.get(variable)!r}, expected µg/m³")
        scale = 0.001 if pollutant == "CO" else 1.0  # CO: µg/m³ -> mg/m³
        for index in past:
            if values[index] is None:
                missing += 1
            else:
                readings.append(Reading(pollutant, round(values[index] * scale, 3), hours[index]))
    return readings, missing


def _hour(stamp: object) -> datetime:
    try:
        return datetime.fromisoformat(str(stamp)).replace(tzinfo=UTC)
    except ValueError:
        raise InvalidAnswer(f"unparseable time {stamp!r}") from None
