"""Constants shared by the scraper, the database models and the API."""

from typing import Literal, get_args

Pollutant = Literal["PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "NH3"]
POLLUTANTS: tuple[str, ...] = get_args(Pollutant)
