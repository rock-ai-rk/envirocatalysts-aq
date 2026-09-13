from datetime import UTC, datetime

import httpx
import pytest

from app.scraper.client import DataGovClient, DataGovError


def make_client(handler, page_size: int = 2) -> DataGovClient:
    return DataGovClient(
        api_key="secret-key",
        resource_id="resource-id",
        base_url="https://example.test/resource",
        page_size=page_size,
        backoff_seconds=0,
        page_delay_seconds=0,
        user_agent="test-agent/1.0",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_identifies_itself_with_the_configured_user_agent():
    agents = []

    def handler(request: httpx.Request) -> httpx.Response:
        agents.append(request.headers["user-agent"])
        return httpx.Response(200, json={"total": 0, "records": []})

    list(make_client(handler).fetch_all())

    assert agents == ["test-agent/1.0"]


def test_updated_at_asks_for_one_record_and_reads_the_metadata():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        # As the live API returns it (13 Sep 2026).
        return httpx.Response(
            200,
            json={
                "updated": 1789279333,
                "updated_date": "2026-09-13T06:02:13Z",
                "total": 3402,
                "records": [{}],
            },
        )

    assert make_client(handler).updated_at() == datetime(2026, 9, 13, 6, 2, 13, tzinfo=UTC)
    assert seen["limit"] == "1"


def test_updated_at_falls_back_to_the_iso_date_then_to_none():
    iso_only = make_client(
        lambda r: httpx.Response(200, json={"updated_date": "2026-09-13T06:02:13Z"})
    )
    neither = make_client(lambda r: httpx.Response(200, json={"total": 1, "records": []}))

    assert iso_only.updated_at() == datetime(2026, 9, 13, 6, 2, 13, tzinfo=UTC)
    assert neither.updated_at() is None


def test_follows_pagination_until_total():
    offsets = []

    def handler(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params["offset"])
        offsets.append(offset)
        records = [{"n": n} for n in range(offset, min(offset + 2, 3))]
        return httpx.Response(200, json={"status": "ok", "total": 3, "records": records})

    assert [r["n"] for r in make_client(handler).fetch_all()] == [0, 1, 2]
    assert offsets == [0, 2]


def test_sends_key_and_asks_for_json():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        return httpx.Response(200, json={"total": 0, "records": []})

    list(make_client(handler).fetch_all())

    assert seen["api-key"] == "secret-key"
    assert seen["format"] == "json"
    assert (seen["limit"], seen["offset"]) == ("2", "0")


def test_retries_server_errors_and_network_failures():
    responses = iter(
        [
            httpx.Response(503),
            httpx.ConnectError("offline"),
            httpx.Response(200, json={"total": 1, "records": [{"n": 1}]}),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        outcome = next(responses)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    assert list(make_client(handler).fetch_all()) == [{"n": 1}]


def test_gives_up_after_max_retries():
    client = make_client(lambda request: httpx.Response(500))

    with pytest.raises(DataGovError, match="HTTP 500 after 3 attempts"):
        list(client.fetch_all())


def test_client_errors_surface_the_api_message():
    client = make_client(
        lambda request: httpx.Response(400, json={"error": "Authorization field missing"})
    )

    with pytest.raises(DataGovError, match="Authorization field missing"):
        list(client.fetch_all())


def test_error_status_in_body_raises():
    client = make_client(
        lambda request: httpx.Response(200, json={"status": "error", "message": "Invalid key"})
    )

    with pytest.raises(DataGovError, match="Invalid key"):
        list(client.fetch_all())


def test_redact_hides_the_api_key():
    client = make_client(lambda request: httpx.Response(200))

    assert (
        client.redact("GET /resource?api-key=secret-key&limit=2")
        == "GET /resource?api-key=***&limit=2"
    )
