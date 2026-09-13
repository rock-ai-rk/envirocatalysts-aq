"""Test helpers: feed records shaped like the data.gov.in response, a fake record source, and
small canonical datasets for the importer and the history endpoints."""

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

from app.importer.canonical import HEADERS
from app.scraper.normalize import IST


def feed_time(hours_ago: float = 0) -> str:
    """A `last_update` string in the feed's format (dd-mm-YYYY HH:MM:SS, IST), on the hour."""
    moment = datetime.now(IST) - timedelta(hours=hours_ago)
    return moment.replace(minute=0, second=0, microsecond=0).strftime("%d-%m-%Y %H:%M:%S")


def make_record(
    station: str = "Anand Vihar, Delhi - DPCC",
    city: str = "Delhi",
    state: str = "Delhi",
    pollutant: str = "PM2.5",
    avg: str = "120",
    low: str = "80",
    high: str = "190",
    hours_ago: float = 0,
    latitude: str = "28.646835",
    longitude: str = "77.316032",
) -> dict:
    return {
        "country": "India",
        "state": state,
        "city": city,
        "station": station,
        "last_update": feed_time(hours_ago),
        "latitude": latitude,
        "longitude": longitude,
        "pollutant_id": pollutant,
        "min_value": low,
        "max_value": high,
        "avg_value": avg,
    }


class FakeSource:
    """Stands in for DataGovClient: returns canned records or raises."""

    def __init__(
        self,
        records: list[dict] = (),
        error: Exception | None = None,
        updated: datetime | None = None,
    ) -> None:
        self.records = list(records)
        self.error = error
        self.updated = updated
        self.fetches = 0

    def updated_at(self) -> datetime | None:
        return self.updated

    def fetch_all(self):
        self.fetches += 1
        if self.error:
            raise self.error
        return iter(self.records)

    def redact(self, text: str) -> str:
        return text.replace("secret-key", "***")


def write_dataset(directory: Path, synthetic: bool = False, **tables: list[list]) -> Path:
    """Write a canonical dataset directory, e.g. write_dataset(path, cities=[[...]], ...).

    The four city-level files are always written (empty unless given), since the loader requires
    them; stations and hourly files only when passed.
    """
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "manifest.json").write_text(
        json.dumps({"name": "test-dataset", "source": "tests", "synthetic": synthetic})
    )
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
