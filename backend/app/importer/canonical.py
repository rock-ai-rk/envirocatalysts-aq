"""The canonical CSV layout, and the loader that puts it into the database.

A dataset is a directory containing these files (columns listed under each):

    manifest.json              {"name": ..., "source": ..., "synthetic": false}
    cities.csv                 name,state,latitude,longitude,groups
    city_aqi_days.csv          city,state,period,good,satisfactory,moderate,poor,very_poor,
                               severe,days_with_data
    city_pollutant_means.csv   city,state,period,pollutant,mean,days_with_data
    city_dominant_days.csv     city,state,period,pollutant,days
    stations.csv               city,state,station,code,latitude,longitude
    station_hourly.csv[.gz]    city,state,station,observed_at,pm25,pm10,no2,so2,co,o3

`groups` is a space-separated list of codes (NCAP MPC IGP DELHI_NCR STATE_CAPITALS). Periods are
keys such as FY2024-25, CY2025 or 2025-04. `observed_at` is IST and hour-ending, as CPCB publishes
it ("2024-04-01 01:00" is the hour 00:00-01:00). Empty cells mean no data.

Loading is idempotent: aggregate rows are replaced per period and hourly rows are upserted, so a
directory can be loaded again after corrections. Everything happens in one transaction, so a bad
file leaves the database untouched.
"""

import csv
import gzip
import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import insert_for
from app.domain import AQI_CATEGORIES, CITY_GROUPS, HOURLY_COLUMNS, IST, POLLUTANTS
from app.models import (
    City,
    CityAqiDays,
    CityDominantDays,
    CityGroupMember,
    CityPollutantMean,
    Dataset,
    Period,
    Station,
    StationHourly,
)
from app.periods import parse_period

HEADERS = {
    "cities.csv": ["name", "state", "latitude", "longitude", "groups"],
    "city_aqi_days.csv": ["city", "state", "period", *AQI_CATEGORIES, "days_with_data"],
    "city_pollutant_means.csv": ["city", "state", "period", "pollutant", "mean", "days_with_data"],
    "city_dominant_days.csv": ["city", "state", "period", "pollutant", "days"],
    "stations.csv": ["city", "state", "station", "code", "latitude", "longitude"],
    "station_hourly.csv": ["city", "state", "station", "observed_at", *HOURLY_COLUMNS.values()],
}
HOURLY_CHUNK = 2000  # rows per INSERT; keeps SQLite under its bound-parameter limit

CityIndex = dict[tuple[str, str], City]  # (name, state) -> city
PeriodIndex = dict[str, Period]  # key -> period
StationIndex = dict[tuple[str, str, str], Station]  # (city, state, station) -> station


class InvalidDataset(ValueError):
    """A file is missing or a row is wrong; the message says which file and line."""


@dataclass
class LoadReport:
    counts: dict[str, int] = field(default_factory=dict)

    def add(self, table: str, rows: int) -> None:
        self.counts[table] = self.counts.get(table, 0) + rows


def load_directory(session: Session, directory: Path, replace: bool = False) -> LoadReport:
    """Load a canonical dataset directory. Commits on success, rolls back on any error."""
    try:
        manifest = _read_manifest(directory)
        if replace:
            _clear_history(session)
        report = LoadReport()
        cities = _load_cities(session, directory, report)
        periods: PeriodIndex = {}
        _load_aqi_days(session, directory, cities, periods, report)
        _load_pollutant_means(session, directory, cities, periods, report)
        _load_dominant_days(session, directory, cities, periods, report)
        stations = _load_stations(session, directory, cities, report)
        _load_hourly(session, directory, stations, report)
        session.add(Dataset(**manifest))
        session.commit()
        return report
    except Exception:
        session.rollback()
        raise


def _read_manifest(directory: Path) -> dict:
    path = directory / "manifest.json"
    if not path.exists():
        raise InvalidDataset(f"{path}: missing (needs name, source and synthetic)")
    manifest = json.loads(path.read_text())
    missing = {"name", "source", "synthetic"} - manifest.keys()
    if missing:
        raise InvalidDataset(f"{path}: missing {', '.join(sorted(missing))}")
    return {
        "name": str(manifest["name"]),
        "source": str(manifest["source"]),
        "synthetic": bool(manifest["synthetic"]),
    }


def _clear_history(session: Session) -> None:
    for model in (
        StationHourly,
        Station,
        CityDominantDays,
        CityPollutantMean,
        CityAqiDays,
        CityGroupMember,
        Period,
        City,
        Dataset,
    ):
        session.execute(delete(model))


def _load_cities(session: Session, directory: Path, report: LoadReport) -> CityIndex:
    existing = {(c.name, c.state): c for c in session.scalars(select(City))}
    for row in _rows(directory, "cities.csv"):
        key = (row.text("name"), row.text("state"))
        groups = row.get("groups").split()
        unknown = set(groups) - set(CITY_GROUPS)
        if unknown:
            raise row.error(f"unknown group(s) {', '.join(sorted(unknown))}")
        city = existing.get(key) or City(name=key[0], state=key[1])
        city.latitude = row.number("latitude", optional=True)
        city.longitude = row.number("longitude", optional=True)
        city.groups = [CityGroupMember(code=code) for code in sorted(set(groups))]
        session.add(city)
        existing[key] = city
        report.add("cities", 1)
    session.flush()
    return existing


def _period(session: Session, periods: PeriodIndex, key: str, row: "_Row") -> Period:
    if key not in periods:
        try:
            spec = parse_period(key)
        except ValueError as exc:
            raise row.error(str(exc)) from None
        period = session.scalar(select(Period).where(Period.key == key))
        if period is None:
            period = Period(
                key=spec.key,
                frequency=spec.frequency,
                label=spec.label,
                start_date=spec.start_date,
                end_date=spec.end_date,
            )
            session.add(period)
            session.flush()
        periods[key] = period
    return periods[key]


def _city(cities: CityIndex, row: "_Row") -> City:
    key = (row.text("city"), row.text("state"))
    if key not in cities:
        raise row.error(f"city {key[0]!r} ({key[1]}) is not in cities.csv")
    return cities[key]


def _replace_rows(session: Session, model: type, rows: list[dict]) -> None:
    """Replace every row of `model` for the periods present in `rows` with `rows`."""
    period_ids = {row["period_id"] for row in rows}
    if period_ids:
        session.execute(delete(model).where(model.period_id.in_(period_ids)))
    if rows:
        session.execute(insert_for(session, model), rows)


def _load_aqi_days(
    session: Session, directory: Path, cities: CityIndex, periods: PeriodIndex, report: LoadReport
) -> None:
    rows = []
    for row in _rows(directory, "city_aqi_days.csv"):
        period = _period(session, periods, row.text("period"), row)
        counts = {c: row.count(c) for c in AQI_CATEGORIES}
        days_with_data = row.count("days_with_data")
        if days_with_data > period.days:
            raise row.error(
                f"days_with_data {days_with_data} exceeds the {period.days} days in {period.key}"
            )
        if sum(counts.values()) > days_with_data:
            raise row.error("category days add up to more than days_with_data")
        rows.append(
            dict(
                city_id=_city(cities, row).id,
                period_id=period.id,
                days_with_data=days_with_data,
                **counts,
            )
        )
    _replace_rows(session, CityAqiDays, rows)
    report.add("city_aqi_days", len(rows))


def _load_pollutant_means(
    session: Session, directory: Path, cities: CityIndex, periods: PeriodIndex, report: LoadReport
) -> None:
    rows = []
    for row in _rows(directory, "city_pollutant_means.csv"):
        period = _period(session, periods, row.text("period"), row)
        rows.append(
            dict(
                city_id=_city(cities, row).id,
                period_id=period.id,
                pollutant=row.pollutant(),
                mean=row.number("mean"),
                days_with_data=row.count("days_with_data"),
            )
        )
    _replace_rows(session, CityPollutantMean, rows)
    report.add("city_pollutant_means", len(rows))


def _load_dominant_days(
    session: Session, directory: Path, cities: CityIndex, periods: PeriodIndex, report: LoadReport
) -> None:
    rows = []
    for row in _rows(directory, "city_dominant_days.csv"):
        period = _period(session, periods, row.text("period"), row)
        rows.append(
            dict(
                city_id=_city(cities, row).id,
                period_id=period.id,
                pollutant=row.pollutant(),
                days=row.count("days"),
            )
        )
    _replace_rows(session, CityDominantDays, rows)
    report.add("city_dominant_days", len(rows))


def _load_stations(
    session: Session, directory: Path, cities: CityIndex, report: LoadReport
) -> StationIndex:
    existing = {(s.city.name, s.city.state, s.name): s for s in session.scalars(select(Station))}
    for row in _rows(directory, "stations.csv", required=False):
        city = _city(cities, row)
        key = (city.name, city.state, row.text("station"))
        station = existing.get(key) or Station(city=city, name=key[2])
        station.code = row.get("code") or None
        station.latitude = row.number("latitude", optional=True)
        station.longitude = row.number("longitude", optional=True)
        session.add(station)
        existing[key] = station
        report.add("stations", 1)
    session.flush()
    return existing


def _load_hourly(
    session: Session, directory: Path, stations: StationIndex, report: LoadReport
) -> None:
    columns = list(HOURLY_COLUMNS.values())
    stmt = insert_for(session, StationHourly)
    upsert = stmt.on_conflict_do_update(
        index_elements=["station_id", "observed_at"],
        set_={column: getattr(stmt.excluded, column) for column in columns},
    )
    batch: list[dict] = []
    for row in _rows(directory, "station_hourly.csv", required=False):
        key = (row.text("city"), row.text("state"), row.text("station"))
        if key not in stations:
            raise row.error(f"station {key[2]!r} ({key[0]}) is not in stations.csv")
        batch.append(
            dict(
                station_id=stations[key].id,
                observed_at=row.timestamp("observed_at"),
                **{column: row.number(column, optional=True) for column in columns},
            )
        )
        if len(batch) >= HOURLY_CHUNK:
            session.execute(upsert, batch)
            report.add("station_hourly", len(batch))
            batch = []
    if batch:
        session.execute(upsert, batch)
        report.add("station_hourly", len(batch))


class _Row:
    """One CSV row, with typed accessors that report the file and line on bad values."""

    def __init__(self, values: dict[str, str], filename: str, line: int) -> None:
        self._values = values
        self._where = f"{filename}:{line}"

    def error(self, message: str) -> InvalidDataset:
        return InvalidDataset(f"{self._where}: {message}")

    def get(self, column: str) -> str:
        return (self._values.get(column) or "").strip()

    def text(self, column: str) -> str:
        value = self.get(column)
        if not value:
            raise self.error(f"{column} is empty")
        return value

    def number(self, column: str, optional: bool = False) -> float | None:
        value = self.get(column)
        if not value:
            if optional:
                return None
            raise self.error(f"{column} is empty")
        try:
            return float(value)
        except ValueError:
            raise self.error(f"{column} {value!r} is not a number") from None

    def count(self, column: str) -> int:
        value = self.number(column)
        if value < 0 or value != int(value):
            raise self.error(f"{column} {value} is not a whole number of days")
        return int(value)

    def pollutant(self) -> str:
        value = self.text("pollutant")
        if value not in POLLUTANTS:
            raise self.error(f"unknown pollutant {value!r}")
        return value

    def timestamp(self, column: str) -> datetime:
        value = self.text(column)
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).replace(tzinfo=IST)
            except ValueError:
                continue
        raise self.error(f"{column} {value!r} is not YYYY-MM-DD HH:MM")


def _rows(directory: Path, filename: str, required: bool = True) -> Iterator[_Row]:
    path = directory / filename
    if not path.exists() and (directory / f"{filename}.gz").exists():
        path = directory / f"{filename}.gz"
    if not path.exists():
        if required:
            raise InvalidDataset(f"{directory / filename}: missing")
        return

    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in HEADERS[filename] if c not in (reader.fieldnames or [])]
        if missing:
            raise InvalidDataset(f"{path.name}: missing column(s) {', '.join(missing)}")
        for line, values in enumerate(reader, start=2):
            yield _Row(values, path.name, line)
