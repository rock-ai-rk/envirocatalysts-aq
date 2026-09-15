import httpx
import pytest

from app.scraper.client import OpenMeteoClient, OpenMeteoError, Place

PLACES = [Place(1, 28.6139, 77.209), Place(2, 19.076, 72.8777), Place(3, 13.0827, 80.2707)]


def make_client(handler, batch_size: int = 2) -> OpenMeteoClient:
    return OpenMeteoClient(
        base_url="https://example.test/v1/air-quality",
        batch_size=batch_size,
        backoff_seconds=0,
        request_delay_seconds=0,
        user_agent="test-agent/1.0",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def echo(request: httpx.Request) -> httpx.Response:
    """Answer each coordinate pair with its latitude, the way the API answers in order."""
    latitudes = request.url.params["latitude"].split(",")
    answers = [{"latitude": float(lat)} for lat in latitudes]
    return httpx.Response(200, json=answers if len(answers) > 1 else answers[0])


def test_asks_for_the_six_pollutants_hourly_in_utc_without_a_key():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        seen["agent"] = request.headers["user-agent"]
        return echo(request)

    list(make_client(handler, batch_size=3).fetch(PLACES))

    assert seen["hourly"] == "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone"
    assert (seen["timezone"], seen["domains"]) == ("GMT", "cams_global")
    assert (seen["past_days"], seen["forecast_days"]) == ("1", "1")
    assert seen["latitude"] == "28.6139,19.0760,13.0827"
    assert seen["agent"] == "test-agent/1.0"
    assert not any("key" in name for name in seen)


def test_batches_places_and_pairs_each_with_its_answer():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.params["latitude"])
        return echo(request)

    pairs = list(make_client(handler, batch_size=2).fetch(PLACES))

    assert requests == ["28.6139,19.0760", "13.0827"]  # the last batch has one place
    assert [(place.city_id, answer["latitude"]) for place, answer in pairs] == [
        (1, 28.6139),
        (2, 19.076),
        (3, 13.0827),
    ]


def test_a_short_answer_is_an_error():
    client = make_client(lambda request: httpx.Response(200, json=[{"latitude": 1}]))

    with pytest.raises(OpenMeteoError, match="asked for 2 places, got 1"):
        list(client.fetch(PLACES[:2]))


def test_retries_rate_limits_server_errors_and_network_failures():
    outcomes = iter([httpx.Response(429), httpx.ConnectError("offline"), httpx.Response(503)])

    def handler(request: httpx.Request) -> httpx.Response:
        outcome = next(outcomes, None)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome or echo(request)

    client = OpenMeteoClient(
        max_retries=4,
        backoff_seconds=0,
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert [place.city_id for place, _ in client.fetch(PLACES[:1])] == [1]


def test_gives_up_after_max_retries():
    client = make_client(lambda request: httpx.Response(500))

    with pytest.raises(OpenMeteoError, match="HTTP 500 after 3 attempts"):
        list(client.fetch(PLACES))


def test_a_refused_request_surfaces_the_api_reason():
    # As the API answers a latitude out of range (15 Sep 2026).
    client = make_client(
        lambda request: httpx.Response(
            400, json={"reason": "Latitude must be in range of -90 to 90°.", "error": True}
        )
    )

    with pytest.raises(OpenMeteoError, match="HTTP 400: Latitude must be in range"):
        list(client.fetch(PLACES))


def test_no_places_means_no_requests():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request expected")

    assert list(make_client(handler).fetch([])) == []
