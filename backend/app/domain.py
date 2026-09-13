"""Constants shared by the scraper, the importer, the database models and the API."""

from dataclasses import dataclass
from typing import Literal, get_args
from zoneinfo import ZoneInfo

# CPCB timestamps, and every "day" in the app, are Indian Standard Time.
IST = ZoneInfo("Asia/Kolkata")

# Where scraped readings come from: CPCB's real-time feed on data.gov.in.
LIVE_SOURCE = "datagov_cpcb_realtime"

Pollutant = Literal["PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "NH3"]
POLLUTANTS: tuple[str, ...] = get_args(Pollutant)

CityGroup = Literal["NCAP", "MPC", "IGP", "DELHI_NCR", "STATE_CAPITALS"]
CITY_GROUPS: tuple[str, ...] = get_args(CityGroup)

# (short label, description) for each group, as the source dashboard's buttons name them.
CITY_GROUP_INFO: dict[str, tuple[str, str]] = {
    "NCAP": ("NCAP", "National Clean Air Programme cities"),
    "MPC": ("MPC", "Million-plus cities"),
    "IGP": ("IGP", "Indo-Gangetic Plain cities"),
    "DELHI_NCR": ("Delhi NCR", "Delhi National Capital Region"),
    "STATE_CAPITALS": ("State Capitals", "State and union territory capitals"),
}

AqiCategory = Literal["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]
AQI_CATEGORIES: tuple[str, ...] = get_args(AqiCategory)

Frequency = Literal["FY", "CY", "MONTH"]

HourlyPollutant = Literal["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]

# Pollutants with station-level hourly data, and the station_hourly column each is stored in.
HOURLY_COLUMNS: dict[str, str] = {
    "PM2.5": "pm25",
    "PM10": "pm10",
    "NO2": "no2",
    "SO2": "so2",
    "CO": "co",
    "O3": "o3",
}


def unit_for(pollutant: str) -> str:
    return "mg/m³" if pollutant == "CO" else "µg/m³"


def decimals_for(pollutant: str) -> int:
    """Decimal places the API reports a concentration to (CO is in mg/m³, so it needs more)."""
    return 2 if pollutant == "CO" else 1


@dataclass(frozen=True)
class Limits:
    naaqs: float
    who: float


# What the hourly KPIs compare each hour against. As in the source dashboard, hourly values are
# compared with the 24-hour limits for particulates, NO2 and SO2 (India NAAQS 2009, WHO 2021
# guidelines). CO and O3 use NAAQS 1-hour limits; WHO has CO 24-hour and O3 8-hour guidelines.
LIMITS: dict[str, Limits] = {
    "PM2.5": Limits(naaqs=60, who=15),
    "PM10": Limits(naaqs=100, who=45),
    "NO2": Limits(naaqs=80, who=25),
    "SO2": Limits(naaqs=80, who=40),
    "CO": Limits(naaqs=4, who=4),
    "O3": Limits(naaqs=180, who=100),
}
