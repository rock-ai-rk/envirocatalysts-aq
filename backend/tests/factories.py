"""Test helpers: Open-Meteo answers, a fake place source, cities with live readings, and small
canonical datasets for the importer and the history endpoints."""

import csv
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.db import utcnow
from app.importer.canonical import HEADERS
from app.models import City, LiveReading
from app.scraper.normalize import VARIABLES


def last_hours(count: int, ending_hours_ago: int = 0) -> list[datetime]:
    """`count` whole hours (UTC), oldest first, the newest `ending_hours_ago` before this hour."""
    newest = utcnow().replace(minute=0, second=0, microsecond=0) - timedelta(hours=ending_hours_ago)
    return [newest - timedelta(hours=back) for back in reversed(range(count))]


def om_answer(hours: list[datetime], **values: float | None | list[float | None]) -> dict:
    """Open-Meteo's answer for one place, as the API returns it (GMT times, µg/m³).

    `values` gives each variable (pm2_5, carbon_monoxide, ...) one number for every hour or a list
    with one per hour; variables not given are 10 throughout.
    """
    hourly: dict[str, list] = {"time": [hour.strftime("%Y-%m-%dT%H:%M") for hour in hours]}
    for variable in VARIABLES:
        given = values.get(variable, 10.0)
        hourly[variable] = list(given) if isinstance(given, list) else [given] * len(hours)
    return {
        "latitude": 27.2,
        "longitude": 78.0,
        "timezone": "GMT",
        "hourly_units": {"time": "iso8601", **{variable: "μg/m³" for variable in VARIABLES}},
        "hourly": hourly,
    }


class FakeSource:
    """Stands in for OpenMeteoClient: answers every place with `answer`, or per city from
    `answers`, or raises `error`."""

    def __init__(
        self,
        answer: dict | None = None,
        answers: dict[int, dict] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.answer = answer
        self.answers = answers or {}
        self.error = error
        self.asked: list[int] = []

    def fetch(self, places):
        self.asked = [place.city_id for place in places]
        if self.error:
            raise self.error
        for place in places:
            yield place, self.answers.get(place.city_id, self.answer)


def add_city(
    session: Session,
    name: str = "Agra",
    state: str = "Uttar Pradesh",
    latitude: float | None = 27.18,
    longitude: float | None = 78.01,
) -> City:
    city = City(name=name, state=state, latitude=latitude, longitude=longitude)
    session.add(city)
    session.commit()
    return city


def add_readings(session: Session, city: City, hours: list[datetime], **values: float) -> None:
    """Store the same value for each pollutant (by name: PM2.5 as pm25, ...) at every hour."""
    names = {"pm25": "PM2.5", "pm10": "PM10", "no2": "NO2", "so2": "SO2", "co": "CO", "o3": "O3"}
    session.add_all(
        LiveReading(
            city_id=city.id,
            pollutant=names[key],
            value=value,
            observed_at=hour,
            fetched_at=hour.astimezone(UTC),
        )
        for key, value in values.items()
        for hour in hours
    )
    session.commit()


def write_dataset(
    directory: Path, synthetic: bool = False, scope: str | None = None, **tables: list[list]
) -> Path:
    """Write a canonical dataset directory, e.g. write_dataset(path, cities=[[...]], ...).

    The four city-level files are always written (empty unless given), since the loader requires
    them; stations and hourly files only when passed. `scope` is left out of the manifest unless
    given, which the loader reads as "all".
    """
    directory.mkdir(parents=True, exist_ok=True)
    manifest = {"name": "test-dataset", "source": "tests", "synthetic": synthetic}
    if scope:
        manifest["scope"] = scope
    (directory / "manifest.json").write_text(json.dumps(manifest))
    required = ("cities", "city_aqi_days", "city_pollutant_means", "city_dominant_days")
    for table in {*required, *tables}:
        filename = f"{table}.csv"
        with (directory / filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(HEADERS[filename])
            writer.writerows(tables.get(table, []))
    return directory


def small_dataset(directory: Path) -> Path:
    """Four cities over FY2024-25 and FY2025-26, covering each Overview rule:

    Chennai has the most good days but a PM2.5 mean under the sensor-fault floor and no
    FY2025-26 data; Dimapur is below 70% coverage; Agra has two stations with hourly data.
    """
    base, comparison = "FY2024-25", "FY2025-26"
    return write_dataset(
        directory,
        cities=[
            ["Agra", "Uttar Pradesh", 27.18, 78.01, "NCAP IGP"],
            ["Bhopal", "Madhya Pradesh", 23.26, 77.41, "NCAP STATE_CAPITALS"],
            ["Chennai", "Tamil Nadu", 13.08, 80.27, "MPC"],
            ["Dimapur", "Nagaland", 25.90, 93.73, ""],
        ],
        city_aqi_days=[
            ["Agra", "Uttar Pradesh", base, 100, 150, 60, 30, 10, 0, 350],
            ["Bhopal", "Madhya Pradesh", base, 180, 150, 20, 0, 0, 0, 350],
            ["Chennai", "Tamil Nadu", base, 250, 90, 10, 0, 0, 0, 350],
            ["Dimapur", "Nagaland", base, 100, 100, 0, 0, 0, 0, 200],
            ["Agra", "Uttar Pradesh", comparison, 120, 150, 50, 20, 5, 0, 345],
            ["Bhopal", "Madhya Pradesh", comparison, 170, 160, 20, 0, 0, 0, 350],
        ],
        city_pollutant_means=[
            ["Agra", "Uttar Pradesh", base, "PM2.5", 70.0, 350],
            ["Bhopal", "Madhya Pradesh", base, "PM2.5", 40.0, 350],
            ["Chennai", "Tamil Nadu", base, "PM2.5", 1.5, 350],
            ["Dimapur", "Nagaland", base, "PM2.5", 30.0, 200],
            ["Agra", "Uttar Pradesh", comparison, "PM2.5", 62.5, 345],
            ["Bhopal", "Madhya Pradesh", comparison, "PM2.5", 42.0, 350],
        ],
        city_dominant_days=[
            ["Agra", "Uttar Pradesh", base, "PM10", 200],
            ["Agra", "Uttar Pradesh", base, "PM2.5", 150],
            ["Bhopal", "Madhya Pradesh", base, "O3", 350],
        ],
        stations=[
            ["Agra", "Uttar Pradesh", "Sanjay Palace", "UP001", 27.19, 78.00],
            ["Agra", "Uttar Pradesh", "Shahjahan Garden", "UP002", 27.17, 78.02],
        ],
        station_hourly=[
            [
                "Agra",
                "Uttar Pradesh",
                "Sanjay Palace",
                "2024-12-01 01:00",
                100,
                180,
                30,
                10,
                1.2,
                20,
            ],
            [
                "Agra",
                "Uttar Pradesh",
                "Shahjahan Garden",
                "2024-12-01 01:00",
                60,
                120,
                25,
                8,
                0.9,
                25,
            ],
            [
                "Agra",
                "Uttar Pradesh",
                "Sanjay Palace",
                "2024-12-01 02:00",
                80,
                150,
                28,
                "",
                1.1,
                22,
            ],
            ["Agra", "Uttar Pradesh", "Sanjay Palace", "2025-12-01 01:00", 50, 90, 20, 6, 0.8, 30],
        ],
    )
