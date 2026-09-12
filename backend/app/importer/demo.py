"""Synthetic dataset for building and testing the app before the real files arrive.

NOT REAL DATA. City names and coordinates are real so layouts and the map look realistic, but
every number is generated. The manifest marks the dataset as synthetic, and the app shows a
"demo data" banner whenever it is being served.

The data is deterministic (fixed seed) and deliberately includes the cases the Overview rules
exist for: cities below 70% coverage, a PM2.5 average under the 2 µg/m³ sensor-fault floor, and a
city with no data in the comparison period.
"""

import csv
import json
import math
import random
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from app.domain import AQI_CATEGORIES, HOURLY_COLUMNS, IST
from app.periods import parse_period

CsvWriter = Any  # csv.writer objects have no public type

PERIODS = ("FY2024-25", "FY2025-26")

# name, state, latitude, longitude, groups, typical PM2.5 (µg/m³), region
CITIES: list[tuple[str, str, float, float, str, float, str]] = [
    ("Delhi", "Delhi", 28.61, 77.21, "NCAP MPC IGP DELHI_NCR STATE_CAPITALS", 105, "north"),
    ("Noida", "Uttar Pradesh", 28.54, 77.39, "NCAP IGP DELHI_NCR", 95, "north"),
    ("Gurugram", "Haryana", 28.46, 77.03, "NCAP IGP DELHI_NCR", 90, "north"),
    ("Ghaziabad", "Uttar Pradesh", 28.67, 77.45, "NCAP MPC IGP DELHI_NCR", 100, "north"),
    ("Faridabad", "Haryana", 28.41, 77.32, "NCAP MPC IGP DELHI_NCR", 92, "north"),
    ("Lucknow", "Uttar Pradesh", 26.85, 80.95, "NCAP MPC IGP STATE_CAPITALS", 85, "north"),
    ("Kanpur", "Uttar Pradesh", 26.45, 80.33, "NCAP MPC IGP", 88, "north"),
    ("Patna", "Bihar", 25.59, 85.14, "NCAP MPC IGP STATE_CAPITALS", 90, "north"),
    ("Varanasi", "Uttar Pradesh", 25.32, 82.97, "NCAP MPC IGP", 70, "north"),
    ("Agra", "Uttar Pradesh", 27.18, 78.01, "NCAP MPC IGP", 72, "north"),
    ("Amritsar", "Punjab", 31.63, 74.87, "NCAP MPC IGP", 68, "north"),
    ("Ludhiana", "Punjab", 30.90, 75.85, "NCAP MPC IGP", 70, "north"),
    ("Chandigarh", "Chandigarh", 30.73, 76.78, "NCAP MPC STATE_CAPITALS", 48, "north"),
    ("Dehradun", "Uttarakhand", 30.32, 78.03, "NCAP STATE_CAPITALS", 45, "north"),
    ("Srinagar", "Jammu & Kashmir", 34.08, 74.80, "NCAP MPC", 40, "north"),
    ("Jaipur", "Rajasthan", 26.91, 75.79, "NCAP MPC STATE_CAPITALS", 55, "west"),
    ("Ahmedabad", "Gujarat", 23.02, 72.57, "NCAP MPC", 52, "west"),
    ("Mumbai", "Maharashtra", 19.08, 72.88, "NCAP MPC STATE_CAPITALS", 42, "west"),
    ("Pune", "Maharashtra", 18.52, 73.86, "NCAP MPC", 40, "west"),
    ("Nagpur", "Maharashtra", 21.15, 79.09, "NCAP MPC", 45, "central"),
    ("Bhopal", "Madhya Pradesh", 23.26, 77.41, "NCAP MPC STATE_CAPITALS", 44, "central"),
    ("Raipur", "Chhattisgarh", 21.25, 81.63, "NCAP MPC STATE_CAPITALS", 50, "central"),
    ("Kolkata", "West Bengal", 22.57, 88.36, "NCAP MPC IGP STATE_CAPITALS", 58, "east"),
    ("Bhubaneswar", "Odisha", 20.30, 85.82, "NCAP STATE_CAPITALS", 42, "east"),
    ("Guwahati", "Assam", 26.14, 91.74, "NCAP MPC", 50, "northeast"),
    ("Shillong", "Meghalaya", 25.58, 91.89, "STATE_CAPITALS", 22, "northeast"),
    ("Aizawl", "Mizoram", 23.73, 92.72, "STATE_CAPITALS", 16, "northeast"),
    ("Kohima", "Nagaland", 25.67, 94.11, "STATE_CAPITALS", 20, "northeast"),
    ("Hyderabad", "Telangana", 17.39, 78.49, "NCAP MPC STATE_CAPITALS", 38, "south"),
    ("Visakhapatnam", "Andhra Pradesh", 17.69, 83.22, "NCAP MPC", 36, "south"),
    ("Rajamahendravaram", "Andhra Pradesh", 17.00, 81.80, "NCAP", 30, "south"),
    ("Bengaluru", "Karnataka", 12.97, 77.59, "NCAP MPC STATE_CAPITALS", 30, "south"),
    ("Mysuru", "Karnataka", 12.30, 76.64, "", 22, "south"),
    ("Madikeri", "Karnataka", 12.42, 75.74, "", 17, "south"),
    ("Chamarajanagar", "Karnataka", 11.93, 76.94, "", 18, "south"),
    ("Chennai", "Tamil Nadu", 13.08, 80.27, "NCAP MPC STATE_CAPITALS", 30, "south"),
    ("Tirunelveli", "Tamil Nadu", 8.71, 77.76, "", 24, "south"),
    ("Puducherry", "Puducherry", 11.94, 79.81, "STATE_CAPITALS", 25, "south"),
    ("Kochi", "Kerala", 9.93, 76.27, "MPC", 26, "south"),
    ("Thiruvananthapuram", "Kerala", 8.52, 76.94, "MPC STATE_CAPITALS", 24, "south"),
]

# The edge cases the Overview rules handle.
LOW_COVERAGE = {"Tirunelveli": 0.55, "Kochi": 0.62}  # base period only
PM25_SENSOR_FAULT = "Madikeri"  # base-period PM2.5 mean below the 2 µg/m³ floor
NO_COMPARISON_DATA = "Kohima"

STATIONS: dict[str, list[str]] = {
    "Delhi": ["Anand Vihar", "Bawana", "Wazirpur", "Rohini", "R K Puram", "Lodhi Road"],
    "Mumbai": ["Bandra", "Colaba", "Worli", "Chakala-Andheri East"],
    "Chennai": ["Alandur", "Manali", "Velachery"],
}

# Seasonal multiplier by month (north India's winter peak; damped for other regions).
SEASON = {
    1: 1.9,
    2: 1.4,
    3: 1.1,
    4: 0.95,
    5: 0.9,
    6: 0.7,
    7: 0.5,
    8: 0.5,
    9: 0.6,
    10: 1.3,
    11: 1.9,
    12: 2.0,
}
SEASON_STRENGTH = {
    "north": 1.0,
    "central": 0.7,
    "east": 0.7,
    "west": 0.5,
    "northeast": 0.5,
    "south": 0.3,
}
PM25_BREAKPOINTS = (30, 60, 90, 120, 250)  # CPCB category upper bounds, µg/m³


def write_demo_dataset(directory: Path, seed: int = 7) -> None:
    rng = random.Random(seed)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "name": "synthetic-demo",
                "source": "Generated by app.importer.demo for development. Not real measurements.",
                "synthetic": True,
            },
            indent=2,
        )
    )

    with _csv(directory, "cities.csv", ["name", "state", "latitude", "longitude", "groups"]) as w:
        for name, state, lat, lon, groups, *_ in CITIES:
            w.writerow([name, state, lat, lon, groups])

    with (
        _csv(
            directory,
            "city_aqi_days.csv",
            ["city", "state", "period", *AQI_CATEGORIES, "days_with_data"],
        ) as aqi_w,
        _csv(
            directory,
            "city_pollutant_means.csv",
            ["city", "state", "period", "pollutant", "mean", "days_with_data"],
        ) as means_w,
        _csv(
            directory, "city_dominant_days.csv", ["city", "state", "period", "pollutant", "days"]
        ) as dominant_w,
    ):
        for name, state, _, _, _, level, region in CITIES:
            for index, key in enumerate(PERIODS):
                if key != PERIODS[0] and name == NO_COMPARISON_DATA:
                    continue
                # A mild improvement from one year to the next, different for each city.
                trend = 1.0 if index == 0 else rng.uniform(0.8, 1.08)
                _write_city_period(
                    rng, aqi_w, means_w, dominant_w, name, state, key, level * trend, region
                )

    with _csv(
        directory, "stations.csv", ["city", "state", "station", "code", "latitude", "longitude"]
    ) as w:
        for city, stations in STATIONS.items():
            state, lat, lon = next((c[1], c[2], c[3]) for c in CITIES if c[0] == city)
            for i, station in enumerate(stations):
                w.writerow(
                    [
                        city,
                        state,
                        station,
                        f"DEMO_{city[:3].upper()}_{i + 1}",
                        round(lat + rng.uniform(-0.1, 0.1), 4),
                        round(lon + rng.uniform(-0.1, 0.1), 4),
                    ]
                )

    columns = list(HOURLY_COLUMNS.values())
    with _csv(
        directory, "station_hourly.csv", ["city", "state", "station", "observed_at", *columns]
    ) as w:
        start = parse_period(PERIODS[0]).start_date
        end = parse_period(PERIODS[-1]).end_date
        for city, stations in STATIONS.items():
            state, level, region = next((c[1], c[5], c[6]) for c in CITIES if c[0] == city)
            for i, station in enumerate(stations):
                _write_station_hours(
                    rng,
                    w,
                    city,
                    state,
                    station,
                    level * rng.uniform(0.8, 1.25),
                    region,
                    start,
                    end,
                    outage=(city == "Delhi" and i == 1),
                )


def _write_city_period(
    rng: random.Random,
    aqi_w: CsvWriter,
    means_w: CsvWriter,
    dominant_w: CsvWriter,
    name: str,
    state: str,
    key: str,
    level: float,
    region: str,
) -> None:
    period = parse_period(key)
    coverage = LOW_COVERAGE.get(name, 1.0) if key == PERIODS[0] else 1.0
    coverage *= rng.uniform(0.93, 1.0)
    covered_days = sorted(rng.sample(range(period.days), round(period.days * coverage)))

    daily_pm25 = []
    for offset in covered_days:
        day = period.start_date + timedelta(days=offset)
        daily_pm25.append(level * _season(day.month, region) * rng.lognormvariate(0, 0.35))

    counts = dict.fromkeys(AQI_CATEGORIES, 0)
    for value in daily_pm25:
        counts[AQI_CATEGORIES[sum(value > b for b in PM25_BREAKPOINTS)]] += 1
    aqi_w.writerow([name, state, key, *counts.values(), len(covered_days)])

    days = len(covered_days)
    pm25 = sum(daily_pm25) / days
    if name == PM25_SENSOR_FAULT and key == PERIODS[0]:
        pm25 = 1.8
    pollutant_means = {
        "PM2.5": pm25,
        "PM10": pm25 * rng.uniform(1.6, 2.2),
        "NO2": rng.uniform(12, 55),
        "O3": rng.uniform(18, 45),
        "CO": rng.uniform(0.4, 1.6),
    }
    for pollutant, mean in pollutant_means.items():
        means_w.writerow([name, state, key, pollutant, round(mean, 2), days - rng.randint(0, 6)])

    # Particulates dominate in the north; ozone and CO more often elsewhere.
    weights = {"PM2.5": 5, "PM10": 4, "NO2": 0.4, "O3": 0.6, "CO": 0.6, "SO2": 0.1, "NH3": 0.1}
    if region in ("south", "northeast", "west"):
        weights.update({"PM2.5": 2.5, "PM10": 3, "O3": 2, "CO": 1.5})
    shares = {p: w * rng.uniform(0.6, 1.4) for p, w in weights.items()}
    total = sum(shares.values())
    allocated = {p: int(days * s / total) for p, s in shares.items()}
    allocated["PM2.5" if region == "north" else "PM10"] += days - sum(allocated.values())
    for pollutant, count in allocated.items():
        if count:
            dominant_w.writerow([name, state, key, pollutant, count])


def _write_station_hours(
    rng: random.Random,
    writer: CsvWriter,
    city: str,
    state: str,
    station: str,
    level: float,
    region: str,
    start: date,
    end: date,
    outage: bool,
) -> None:
    outage_days = {date(2025, 1, 6) + timedelta(days=d) for d in range(10)} if outage else set()
    moment = datetime.combine(start, time(1), IST)
    last = datetime.combine(end + timedelta(days=1), time(0), IST)
    while moment <= last:
        day = (moment - timedelta(hours=1)).date()
        if day not in outage_days and rng.random() > 0.03:
            diurnal = _diurnal(moment.hour)
            pm25 = level * _season(day.month, region) * diurnal * rng.lognormvariate(0, 0.25)
            writer.writerow(
                [
                    city,
                    state,
                    station,
                    moment.strftime("%Y-%m-%d %H:%M"),
                    round(pm25, 1),
                    round(pm25 * rng.uniform(1.7, 2.1), 1),
                    round(35 * diurnal * rng.lognormvariate(0, 0.3), 1),
                    round(12 * rng.lognormvariate(0, 0.35), 1),
                    round(0.9 * diurnal * rng.lognormvariate(0, 0.3), 2),
                    round(40 * (2 - diurnal) * rng.lognormvariate(0, 0.3), 1),
                ]
            )
        moment += timedelta(hours=1)


def _season(month: int, region: str) -> float:
    return 1 + (SEASON[month] - 1) * SEASON_STRENGTH[region]


def _diurnal(hour: int) -> float:
    """Night-time and morning peaks, an afternoon low (hour-ending, 0 = midnight)."""
    h = hour or 24
    return (
        1
        + 0.32 * math.cos(2 * math.pi * (h - 23) / 24)
        + 0.12 * math.cos(2 * math.pi * (h - 9) / 12)
    )


@contextmanager
def _csv(directory: Path, filename: str, header: list[str]) -> Iterator[CsvWriter]:
    """Open a CSV file in the dataset directory and write its header row."""
    with (directory / filename).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        yield writer
