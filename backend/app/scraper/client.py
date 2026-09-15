"""HTTP client for Open-Meteo's air-quality API, which serves the CAMS global model.

No key or account is needed. One request can carry many places: the coordinates go in as
comma-separated lists, and the answer is a JSON list in the same order (a single object when only
one place was asked for).
"""

import logging
import time
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from itertools import batched
from typing import Self

import httpx

from app.config import Settings
from app.scraper.normalize import VARIABLES

logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)  # one INFO line per request is noise


class OpenMeteoError(RuntimeError):
    """The API refused the request or kept failing after retries."""


class _Retryable(Exception):
    pass


@dataclass(frozen=True)
class Place:
    """A point to read the model at: a city in the database and its coordinates."""

    city_id: int
    latitude: float
    longitude: float


class OpenMeteoClient:
    def __init__(
        self,
        base_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality",
        batch_size: int = 50,
        past_days: int = 1,
        max_retries: int = 3,
        backoff_seconds: float = 2.0,
        request_delay_seconds: float = 1.0,
        user_agent: str = "envirocatalysts-aq-scraper",
        http: httpx.Client | None = None,
    ) -> None:
        self._url = base_url
        self._batch_size = batch_size
        self._past_days = past_days
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._request_delay_seconds = request_delay_seconds
        self._http = http or httpx.Client(timeout=30.0)
        self._http.headers["User-Agent"] = user_agent

    @classmethod
    def from_settings(cls, settings: Settings) -> Self:
        return cls(
            base_url=settings.openmeteo_url,
            batch_size=settings.openmeteo_batch_size,
            past_days=settings.openmeteo_past_days,
            request_delay_seconds=settings.scraper_request_delay_seconds,
            user_agent=settings.scraper_user_agent,
        )

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc_info) -> None:
        self._http.close()

    def fetch(self, places: Sequence[Place]) -> Iterator[tuple[Place, dict]]:
        """Yield each place with the API's answer for it, `batch_size` places per request."""
        for number, batch in enumerate(batched(places, self._batch_size)):
            if number:
                time.sleep(self._request_delay_seconds)  # spread the requests out
            answers = self._get(batch)
            if len(answers) != len(batch):
                raise OpenMeteoError(f"asked for {len(batch)} places, got {len(answers)} answers")
            yield from zip(batch, answers, strict=True)

    def _get(self, batch: Sequence[Place]) -> list[dict]:
        params = {
            "latitude": ",".join(f"{place.latitude:.4f}" for place in batch),
            "longitude": ",".join(f"{place.longitude:.4f}" for place in batch),
            "hourly": ",".join(VARIABLES),
            "domains": "cams_global",
            "past_days": self._past_days,
            "forecast_days": 1,
            "timezone": "GMT",  # hours come back as UTC
        }
        for attempt in range(1, self._max_retries + 1):
            try:
                return self._request(params)
            except _Retryable as exc:
                if attempt == self._max_retries:
                    raise OpenMeteoError(f"{exc} after {attempt} attempts") from None
                delay = self._backoff_seconds * 2 ** (attempt - 1)
                logger.warning("Open-Meteo: %s (attempt %s), retrying in %ss", exc, attempt, delay)
                time.sleep(delay)
        raise AssertionError("unreachable")

    def _request(self, params: dict) -> list[dict]:
        try:
            response = self._http.get(self._url, params=params)
        except httpx.TransportError as exc:
            raise _Retryable(type(exc).__name__) from None

        if response.status_code == 429 or response.status_code >= 500:
            raise _Retryable(f"HTTP {response.status_code}")

        try:
            body = response.json()
        except ValueError:
            body = None
        if response.status_code >= 400 or (isinstance(body, dict) and body.get("error")):
            reason = body.get("reason") if isinstance(body, dict) else None
            raise OpenMeteoError(f"HTTP {response.status_code}: {reason or response.text[:300]}")
        if isinstance(body, dict):
            return [body]
        if isinstance(body, list):
            return body
        raise OpenMeteoError("response was not JSON")
