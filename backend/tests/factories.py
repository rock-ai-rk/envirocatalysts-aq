"""Test helpers: feed records shaped like the data.gov.in response, and a fake record source."""

from datetime import datetime, timedelta

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

    def __init__(self, records: list[dict] = (), error: Exception | None = None) -> None:
        self.records = list(records)
        self.error = error

    def fetch_all(self):
        if self.error:
            raise self.error
        return iter(self.records)

    def redact(self, text: str) -> str:
        return text.replace("secret-key", "***")
