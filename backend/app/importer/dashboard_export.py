"""Turns the EnviroCatalysts dashboard's own CSV downloads into the canonical dataset layout.

The source files were never sent, so the historical city numbers come from the public dashboard
(envirocatalysts.com/airquality-dashboard) through its "Download CSV" buttons, with Financial Year,
All India and All Cities selected. Two things about those downloads shape this module:

- The dashboard lists only the cities that meet the 70% coverage rule in the *base* year, and the
  comparison panel shows those same cities. So the export is taken twice, once with each year as
  the base, and the two are merged. Together they cover every city that qualifies in at least one
  year. A city that fails the rule in both years is in neither download, so it is not here either.
- The downloads name cities but not their state, city groups or position. Those come from the same
  dashboard: chart 1 downloaded once per state and once per city group, and its city map's points.

Export directory, as the export script writes it:

    overview/<run>/chart1_aqi_days_<period>.csv       city,Good,Satisfactory,...,Very Poor,Severe
    overview/<run>/chart2_<pollutant>_<period>.csv    city,conc_avg
    overview/<run>/chart3_dominant_poll_<period>.csv  city,PM2.5,PM10,NO2,O3,CO,SO2,NH3
    states/<run>/<state>/chart1_aqi_days_<period>.csv
    groups/<run>/<GROUP_CODE>/chart1_aqi_days_<period>.csv
    map-points.json                                   [{"label": <city>, "lat": .., "lon": ..}, ...]

<run> is any folder name (the script uses base_FY2024-25 and base_FY2025-26), and <period> is the
dashboard's own label, e.g. "FY 2024-25".
"""

import csv
import json
import re
from pathlib import Path

from app.domain import AQI_CATEGORIES, CITY_GROUPS, POLLUTANTS
from app.periods import parse_period

# The dashboard's column names for the CPCB categories, in the canonical order.
CATEGORY_COLUMNS = dict(
    zip(
        ("Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"),
        AQI_CATEGORIES,
        strict=True,
    )
)
CHART1 = re.compile(r"^chart1_aqi_days_(?P<period>.+)\.csv$")
CHART2 = re.compile(r"^chart2_(?P<pollutant>PM2\.5|PM10|NO2|SO2|CO|O3|NH3)_(?P<period>.+)\.csv$")
CHART3 = re.compile(r"^chart3_dominant_poll_(?P<period>.+)\.csv$")

CityPeriod = tuple[str, str]  # (city, period key)


class ConversionError(ValueError):
    """The export is incomplete or contradicts itself; the message says where."""


def convert_dashboard_export(export: Path, out: Path, exported_on: str) -> list[str]:
    """Write a canonical "overview" dataset to `out`. Returns a few summary lines."""
    aqi_days: dict[CityPeriod, dict[str, int]] = {}
    means: dict[tuple[str, str, str], float] = {}
    dominant: dict[CityPeriod, dict[str, int]] = {}

    for path in sorted((export / "overview").glob("*/*.csv")):
        if match := CHART1.match(path.name):
            period = _period_key(match["period"], path)
            for row in _read(path):
                counts = {key: _days(row, column, path) for column, key in CATEGORY_COLUMNS.items()}
                if sum(counts.values()):  # a name-only row means no data that year
                    _merge(aqi_days, (row["city"], period), counts, path)
        elif match := CHART2.match(path.name):
            period = _period_key(match["period"], path)
            for row in _read(path):
                value = (row.get("conc_avg") or "").strip()
                if value:
                    key = (row["city"], period, match["pollutant"])
                    _merge(means, key, round(float(value), 3), path)
        elif match := CHART3.match(path.name):
            period = _period_key(match["period"], path)
            for row in _read(path):
                days = {p: _days(row, p, path) for p in POLLUTANTS if p in row}
                if sum(days.values()):
                    _merge(dominant, (row["city"], period), days, path)

    if not aqi_days:
        raise ConversionError(f"{export / 'overview'}: no chart 1 downloads found")

    cities = sorted({c for c, _ in aqi_days} | {c for c, _, _ in means} | {c for c, _ in dominant})
    states = _membership(export / "states")
    groups = _membership(export / "groups")
    coordinates = _coordinates(export / "map-points.json")

    missing = [c for c in cities if not states.get(c)]
    if missing:
        raise ConversionError(f"no state found for {len(missing)} cities: {', '.join(missing)}")
    ambiguous = [f"{c} ({', '.join(sorted(states[c]))})" for c in cities if len(states[c]) > 1]
    if ambiguous:
        raise ConversionError(f"cities listed under more than one state: {', '.join(ambiguous)}")
    unknown = {code for codes in groups.values() for code in codes} - set(CITY_GROUPS)
    if unknown:
        raise ConversionError(f"unknown city group folder(s): {', '.join(sorted(unknown))}")

    state_of = {c: next(iter(states[c])) for c in cities}
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(
        json.dumps(
            {
                "name": f"envirocatalysts-dashboard-{exported_on}",
                "source": (
                    f"EnviroCatalysts Air Quality Dashboard, CSV downloads of {exported_on} "
                    "(envirocatalysts.com/airquality-dashboard), which cites CPCB AQI Daily "
                    "Bulletins & Station Monitoring Data"
                ),
                "synthetic": False,
                "scope": "overview",
            },
            indent=2,
        )
    )
    _write(
        out / "cities.csv",
        ["name", "state", "latitude", "longitude", "groups"],
        (
            [c, state_of[c], *coordinates.get(c, ("", "")), " ".join(sorted(groups.get(c, ())))]
            for c in cities
        ),
    )
    _write(
        out / "city_aqi_days.csv",
        ["city", "state", "period", *AQI_CATEGORIES, "days_with_data"],
        (
            [c, state_of[c], p, *counts.values(), sum(counts.values())]
            for (c, p), counts in sorted(aqi_days.items())
        ),
    )
    # The download gives each mean but not how many days it averages. The loader needs a count,
    # so the city's AQI days for that year stand in; no Overview rule reads this column.
    _write(
        out / "city_pollutant_means.csv",
        ["city", "state", "period", "pollutant", "mean", "days_with_data"],
        (
            [c, state_of[c], p, pollutant, mean, sum(aqi_days.get((c, p), {}).values())]
            for (c, p, pollutant), mean in sorted(means.items())
        ),
    )
    _write(
        out / "city_dominant_days.csv",
        ["city", "state", "period", "pollutant", "days"],
        (
            [c, state_of[c], p, pollutant, days]
            for (c, p), by_pollutant in sorted(dominant.items())
            for pollutant, days in by_pollutant.items()
            if days
        ),
    )
    return [
        f"cities                 {len(cities):>6} ({sum(c in coordinates for c in cities)} with "
        f"map coordinates, {sum(bool(groups.get(c)) for c in cities)} in a city group)",
        f"city_aqi_days          {len(aqi_days):>6} rows",
        f"city_pollutant_means   {len(means):>6} rows",
        f"city_dominant_days     {len(dominant):>6} city-years",
    ]


def _period_key(label: str, path: Path) -> str:
    """The dashboard's "FY 2024-25" is the canonical key "FY2024-25"."""
    key = label.replace(" ", "")
    try:
        return parse_period(key).key
    except ValueError:
        raise ConversionError(f"{path.name}: {label!r} is not a period this app knows") from None


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if rows and "city" not in rows[0]:
        raise ConversionError(f"{path.name}: no 'city' column")
    return rows


def _days(row: dict[str, str], column: str, path: Path) -> int:
    value = (row.get(column) or "").strip() or "0"
    try:
        days = float(value)
    except ValueError:
        raise ConversionError(
            f"{path.name}: {row['city']} {column} {value!r} is not a number"
        ) from None
    if days < 0 or days != int(days):
        raise ConversionError(f"{path.name}: {row['city']} {column} {value!r} is not a day count")
    return int(days)


def _merge(store: dict, key: tuple, value: object, path: Path) -> None:
    """Both export runs contain some of the same city-years; they must agree exactly."""
    if key in store and store[key] != value:
        raise ConversionError(
            f"{path.parent.name}/{path.name}: {key} is {value}, "
            f"but an earlier download said {store[key]}"
        )
    store[key] = value


def _membership(directory: Path) -> dict[str, set[str]]:
    """city -> the names of every <run>/<name>/ folder whose chart 1 download lists it."""
    found: dict[str, set[str]] = {}
    for path in directory.glob("*/*/chart1_aqi_days_*.csv"):
        for row in _read(path):
            found.setdefault(row["city"], set()).add(path.parent.name)
    return found


def _coordinates(path: Path) -> dict[str, tuple[float, float]]:
    if not path.exists():
        return {}
    coordinates: dict[str, tuple[float, float]] = {}
    for point in json.loads(path.read_text()):
        label, lat, lon = str(point.get("label", "")).strip(), point.get("lat"), point.get("lon")
        if label and lat is not None and lon is not None:
            coordinates.setdefault(label, (round(float(lat), 4), round(float(lon), 4)))
    return coordinates


def _write(path: Path, header: list[str], rows) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
