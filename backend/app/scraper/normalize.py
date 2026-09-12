"""Turn raw data.gov.in records into typed readings.

The feed returns every value as a string, uses "NA" for missing values, underscores in place names
("Uttar_Pradesh") and "OZONE" for O3. Its field names have changed over the years
(pollutant_avg -> avg_value), so both spellings are accepted.
"""

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
TIMESTAMP_FORMATS = ("%d-%m-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S")
POLLUTANT_ALIASES = {
    "PM2.5": "PM2.5",
    "PM10": "PM10",
    "NO2": "NO2",
    "SO2": "SO2",
    "CO": "CO",
    "OZONE": "O3",
    "O3": "O3",
    "NH3": "NH3",
}
MISSING = {"", "NA", "N/A", "NONE", "NULL", "-"}


class InvalidRecord(ValueError):
    """A record that can't be stored (no station, unknown pollutant, bad timestamp, no values)."""


@dataclass(frozen=True)
class Reading:
    station: str
    city: str
    state: str
    latitude: float | None
    longitude: float | None
    pollutant: str
    avg_value: float | None
    min_value: float | None
    max_value: float | None
    observed_at: datetime


def parse_record(raw: dict) -> Reading:
    station = _text(raw.get("station"))
    if not station:
        raise InvalidRecord("missing station")

    pollutant = POLLUTANT_ALIASES.get(_text(raw.get("pollutant_id")).upper())
    if pollutant is None:
        raise InvalidRecord(f"unknown pollutant {raw.get('pollutant_id')!r}")

    avg, low, high = (
        _number(raw.get(f"{kind}_value", raw.get(f"pollutant_{kind}")))
        for kind in ("avg", "min", "max")
    )
    if avg is None and low is None and high is None:
        raise InvalidRecord("no pollutant values")

    return Reading(
        station=station,
        city=_place(raw.get("city")),
        state=_place(raw.get("state")),
        latitude=_number(raw.get("latitude")),
        longitude=_number(raw.get("longitude")),
        pollutant=pollutant,
        avg_value=avg,
        min_value=low,
        max_value=high,
        observed_at=_timestamp(raw.get("last_update")),
    )


def parse_records(records: Iterable[dict]) -> tuple[list[Reading], int]:
    """Parse every record, returning the usable readings and how many were skipped."""
    readings: list[Reading] = []
    skipped = 0
    for raw in records:
        try:
            readings.append(parse_record(raw))
        except InvalidRecord as exc:
            skipped += 1
            logger.debug("Skipping record %s: %s", raw.get("station"), exc)
    return readings, skipped


def _text(value: object) -> str:
    return str(value).strip() if value is not None else ""


def _place(value: object) -> str:
    return _text(value).replace("_", " ")


def _number(value: object) -> float | None:
    text = _text(value)
    if text.upper() in MISSING:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _timestamp(value: object) -> datetime:
    text = _text(value)
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=IST)
        except ValueError:
            continue
    raise InvalidRecord(f"unparseable last_update {value!r}")
