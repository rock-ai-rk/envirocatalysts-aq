"""HTTP client for the data.gov.in "Real time Air Quality Index from various locations" resource."""

import logging
import time
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Self

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

# httpx logs every request URL at INFO level, and data.gov.in takes the API key as a query
# parameter, so those logs would leak the key.
logging.getLogger("httpx").setLevel(logging.WARNING)


class DataGovError(RuntimeError):
    """The API refused the request or kept failing after retries."""


class _Retryable(Exception):
    pass


class DataGovClient:
    def __init__(
        self,
        api_key: str,
        resource_id: str,
        base_url: str = "https://api.data.gov.in/resource",
        page_size: int = 1000,
        max_retries: int = 3,
        backoff_seconds: float = 2.0,
        page_delay_seconds: float = 1.0,
        user_agent: str = "envirocatalysts-aq-scraper",
        http: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._url = f"{base_url.rstrip('/')}/{resource_id}"
        self._page_size = page_size
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._page_delay_seconds = page_delay_seconds
        self._http = http or httpx.Client(timeout=30.0)
        self._http.headers["User-Agent"] = user_agent

    @classmethod
    def from_settings(cls, settings: Settings) -> Self:
        return cls(
            api_key=settings.datagov_api_key,
            resource_id=settings.datagov_resource_id,
            base_url=settings.datagov_base_url,
            page_size=settings.datagov_page_size,
            page_delay_seconds=settings.scraper_page_delay_seconds,
            user_agent=settings.scraper_user_agent,
        )

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc_info) -> None:
        self._http.close()

    def updated_at(self) -> datetime | None:
        """When data.gov.in last updated the resource, from a one-record request.

        The response metadata carries `updated` (Unix seconds) and `updated_date` (ISO 8601).
        Returns None if neither is present, so the caller falls back to a full fetch.
        """
        page = self._get_page(offset=0, limit=1)
        try:
            return datetime.fromtimestamp(int(page["updated"]), UTC)
        except (KeyError, TypeError, ValueError):
            pass
        try:
            return datetime.fromisoformat(str(page["updated_date"])).astimezone(UTC)
        except (KeyError, ValueError):
            return None

    def fetch_all(self) -> Iterator[dict]:
        """Yield every record in the resource, following limit/offset pagination."""
        offset = 0
        while True:
            if offset:
                time.sleep(self._page_delay_seconds)  # spread the pages out
            page = self._get_page(offset)
            records = page.get("records") or []
            yield from records
            offset += len(records)
            if not records or offset >= int(page.get("total") or 0):
                return

    def redact(self, text: str) -> str:
        return text.replace(self._api_key, "***") if self._api_key else text

    def _get_page(self, offset: int, limit: int | None = None) -> dict:
        params = {
            "api-key": self._api_key,
            "format": "json",
            "limit": limit or self._page_size,
            "offset": offset,
        }
        for attempt in range(1, self._max_retries + 1):
            try:
                return self._request(params)
            except _Retryable as exc:
                if attempt == self._max_retries:
                    raise DataGovError(f"{exc} after {attempt} attempts") from None
                delay = self._backoff_seconds * 2 ** (attempt - 1)
                logger.warning("data.gov.in: %s (attempt %s), retrying in %ss", exc, attempt, delay)
                time.sleep(delay)
        raise AssertionError("unreachable")

    def _request(self, params: dict) -> dict:
        try:
            response = self._http.get(self._url, params=params)
        except httpx.TransportError as exc:
            raise _Retryable(type(exc).__name__) from None

        if response.status_code == 429 or response.status_code >= 500:
            raise _Retryable(f"HTTP {response.status_code}")

        body = _json_or_none(response)
        if response.status_code >= 400:
            raise DataGovError(f"HTTP {response.status_code}: {_api_message(body, response)}")
        if body is None:
            raise DataGovError("response was not JSON")
        if str(body.get("status", "")).lower() == "error":
            raise DataGovError(_api_message(body, response))
        return body


def _json_or_none(response: httpx.Response) -> dict | None:
    try:
        body = response.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _api_message(body: dict | None, response: httpx.Response) -> str:
    if body:
        return str(body.get("error") or body.get("message") or body)[:300]
    return response.text[:300]
