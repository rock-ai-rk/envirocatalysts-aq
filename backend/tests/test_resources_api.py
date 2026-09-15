"""The resource endpoints: /v1/cities, /v1/aqi-summary, /v1/coverage and /v1/stations/*."""

import pytest

from app.importer.canonical import load_directory
from tests.factories import small_dataset


@pytest.fixture
def loaded(session, tmp_path, api):
    load_directory(session, small_dataset(tmp_path))
    return api


def ids_by_name(api) -> dict[str, int]:
    return {city["name"]: city["id"] for city in api.get("/v1/cities").json()}


def station_id(api, name: str) -> int:
    agra = next(c for c in api.get("/v1/hourly/cities").json() if c["city"]["name"] == "Agra")
    return next(s["id"] for s in agra["stations"] if s["name"] == name)


# --- /v1/cities


def test_cities_lists_every_city_with_its_station_count(loaded):
    body = loaded.get("/v1/cities").json()

    assert [(c["name"], c["station_count"]) for c in body] == [
        ("Agra", 2),
        ("Bhopal", 0),
        ("Chennai", 0),
        ("Dimapur", 0),
    ]
    assert body[0]["groups"] == ["IGP", "NCAP"]


def test_cities_filters_by_category_and_state(loaded):
    ncap = loaded.get("/v1/cities", params={"category": "NCAP"}).json()
    tamil_nadu = loaded.get("/v1/cities", params={"state": "tamil nadu"}).json()

    assert [c["name"] for c in ncap] == ["Agra", "Bhopal"]
    assert [c["name"] for c in tamil_nadu] == ["Chennai"]


def test_cities_rejects_unknown_categories(loaded):
    assert loaded.get("/v1/cities", params={"category": "METRO"}).status_code == 422


# --- /v1/aqi-summary


def test_aqi_summary_returns_each_city_in_the_order_asked(loaded):
    ids = ids_by_name(loaded)

    body = loaded.get(
        "/v1/aqi-summary",
        params={"city_ids": f"{ids['Chennai']},{ids['Agra']}", "period": "FY2025-26"},
    ).json()

    assert body["period"]["key"] == "FY2025-26"
    assert [c["city"]["name"] for c in body["cities"]] == ["Chennai", "Agra"]
    chennai, agra = body["cities"]
    assert chennai["stats"] is None  # no FY2025-26 data
    assert agra["stats"]["aqi_days"]["good"] == 120
    assert agra["stats"]["pollutant_means"] == {"PM2.5": 62.5}
    assert body["rules"] == {"min_coverage": 0.7, "pm25_floor": 2.0}


def test_aqi_summary_validates_ids(loaded):
    assert loaded.get("/v1/aqi-summary", params={"city_ids": "1,x"}).status_code == 422
    assert loaded.get("/v1/aqi-summary", params={"city_ids": " , "}).status_code == 422

    missing = loaded.get("/v1/aqi-summary", params={"city_ids": "1,9999"})
    assert missing.status_code == 404
    assert "9999" in missing.json()["detail"]


def test_aqi_summary_unknown_period_is_404(loaded):
    response = loaded.get("/v1/aqi-summary", params={"city_ids": "1", "period": "FY2030-31"})

    assert response.status_code == 404


# --- /v1/coverage/{city_id}


def test_coverage_for_a_city_meeting_every_rule(loaded):
    body = loaded.get(f"/v1/coverage/{ids_by_name(loaded)['Agra']}").json()

    assert (body["days_with_data"], body["days_in_period"]) == (350, 365)
    assert body["coverage"] == pytest.approx(0.9589, abs=1e-4)
    assert body["meets_min_coverage"] is True
    assert (body["included_in_base"], body["included_in_pm25_chart"]) == (True, True)
    assert body["flags"] == []


def test_coverage_flags_low_coverage_for_every_chart(loaded):
    body = loaded.get(f"/v1/coverage/{ids_by_name(loaded)['Dimapur']}").json()

    assert body["meets_min_coverage"] is False
    assert body["included_in_base"] is False
    assert body["flags"] == [{"code": "low_coverage", "applies_to": "all_charts"}]


def test_coverage_flags_the_pm25_floor_for_the_pm25_chart_only(loaded):
    body = loaded.get(f"/v1/coverage/{ids_by_name(loaded)['Chennai']}").json()

    assert (body["pm25_mean"], body["pm25_below_floor"]) == (1.5, True)
    assert (body["included_in_base"], body["included_in_pm25_chart"]) == (True, False)
    assert body["flags"] == [{"code": "pm25_floor", "applies_to": "pm25_chart"}]


def test_coverage_without_data_for_the_period(loaded):
    body = loaded.get(
        f"/v1/coverage/{ids_by_name(loaded)['Chennai']}", params={"period": "FY2025-26"}
    ).json()

    assert (body["days_with_data"], body["coverage"]) == (0, 0.0)
    assert body["flags"] == [{"code": "no_data", "applies_to": "all_charts"}]


def test_coverage_unknown_city_is_404(loaded):
    assert loaded.get("/v1/coverage/9999").status_code == 404


# --- /v1/stations/{id}/hourly
# Sanjay Palace has PM2.5 100 at 2024-12-01 01:00, 80 at 02:00, and 50 at 2025-12-01 01:00 (IST).


def test_hourly_series_fills_gaps_with_nulls(loaded):
    body = loaded.get(
        f"/v1/stations/{station_id(loaded, 'Sanjay Palace')}/hourly",
        params={"from": "2024-12-01", "to": "2024-12-02"},
    ).json()

    assert body["resolution"] == "hour"
    assert (body["pollutant"], body["unit"]) == ("PM2.5", "µg/m³")
    assert len(body["points"]) == 24
    assert body["points"][0] == {
        "t": "2024-12-01T01:00:00+05:30",
        "value": 100.0,
        "min": None,
        "max": None,
        "hours": None,
    }
    assert [p["value"] for p in body["points"][1:4]] == [80.0, None, None]
    assert body["points"][-1]["t"] == "2024-12-02T00:00:00+05:30"
    assert body["stats"] == {
        "hours_with_data": 2,
        "expected_hours": 24,
        "mean": 90.0,
        "max": 100.0,
        "max_at": "2024-12-01T01:00:00+05:30",
        "min": 80.0,
        "min_at": "2024-12-01T02:00:00+05:30",
    }
    assert body["thresholds"] == {"naaqs": 60.0, "who": 15.0}
    assert (body["available_from"], body["available_to"]) == (
        "2024-12-01T01:00:00+05:30",
        "2025-12-01T01:00:00+05:30",
    )


def test_hourly_window_start_is_exclusive_and_offsets_are_respected(loaded):
    # 19:30 UTC on 30 Nov is 01:00 IST on 1 Dec, so the 01:00 hour is excluded.
    body = loaded.get(
        f"/v1/stations/{station_id(loaded, 'Sanjay Palace')}/hourly",
        params={"from": "2024-11-30T19:30:00Z", "to": "2024-12-01T03:00:00+05:30"},
    ).json()

    assert [(p["t"], p["value"]) for p in body["points"]] == [
        ("2024-12-01T02:00:00+05:30", 80.0),
        ("2024-12-01T03:00:00+05:30", None),
    ]


def test_long_windows_come_back_as_daily_means(loaded):
    body = loaded.get(
        f"/v1/stations/{station_id(loaded, 'Sanjay Palace')}/hourly",
        params={"from": "2024-11-01", "to": "2024-12-31"},
    ).json()

    assert body["resolution"] == "day"
    assert len(body["points"]) == 60
    december_first = next(p for p in body["points"] if p["t"] == "2024-12-01T00:00:00+05:30")
    assert december_first == {
        "t": "2024-12-01T00:00:00+05:30",
        "value": 90.0,
        "min": 80.0,
        "max": 100.0,
        "hours": 2,
    }
    assert body["points"][0]["value"] is None
    assert body["points"][0]["hours"] == 0


def test_full_financial_year_is_365_daily_points(loaded):
    body = loaded.get(
        f"/v1/stations/{station_id(loaded, 'Sanjay Palace')}/hourly",
        params={"from": "2024-04-01", "to": "2025-04-01"},
    ).json()

    assert (body["resolution"], len(body["points"])) == ("day", 365)
    assert body["points"][0]["t"] == "2024-04-01T00:00:00+05:30"
    assert body["points"][-1]["t"] == "2025-03-31T00:00:00+05:30"


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2024-12-02", "to": "2024-12-01"},  # backwards
        {"from": "2024-01-01", "to": "2025-06-01"},  # over 400 days
        {"from": "2024-11-01", "to": "2024-12-31", "resolution": "hour"},  # too long for hourly
        {"from": "2024-12-01", "to": "2024-12-02", "pollutant": "NH3"},  # no hourly NH3
        {"from": "yesterday", "to": "2024-12-02"},
    ],
)
def test_hourly_rejects_bad_windows(loaded, params):
    response = loaded.get(
        f"/v1/stations/{station_id(loaded, 'Sanjay Palace')}/hourly", params=params
    )

    assert response.status_code == 422


def test_hourly_unknown_station_is_404(loaded):
    response = loaded.get(
        "/v1/stations/9999/hourly", params={"from": "2024-12-01", "to": "2024-12-02"}
    )

    assert response.status_code == 404
