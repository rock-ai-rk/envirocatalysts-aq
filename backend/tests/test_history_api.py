import pytest

from app.importer.canonical import load_directory
from tests.factories import small_dataset


@pytest.fixture
def loaded(session, tmp_path, api):
    load_directory(session, small_dataset(tmp_path))
    return api


def city_id(api, name: str) -> int:
    body = api.get("/v1/overview", params={"top": 0}).json()
    return next(
        c["city"]["id"] for c in body["cities"] + body["excluded"] if c["city"]["name"] == name
    )


def test_meta_lists_periods_states_and_dataset(loaded):
    body = loaded.get("/v1/meta").json()

    assert [p["key"] for p in body["periods"]] == ["FY2024-25", "FY2025-26"]
    assert (body["default_base"], body["default_comparison"]) == ("FY2024-25", "FY2025-26")
    assert body["states"] == ["Madhya Pradesh", "Nagaland", "Tamil Nadu", "Uttar Pradesh"]
    assert body["dataset"]["synthetic"] is False
    assert body["rules"] == {"min_coverage": 0.7, "pm25_floor": 2.0}


def test_meta_without_data(api, session):
    body = api.get("/v1/meta").json()

    assert body["dataset"] is None
    assert body["periods"] == []
    assert body["default_base"] is None


def test_overview_ranks_by_good_days_and_explains_exclusions(loaded):
    body = loaded.get("/v1/overview").json()

    assert [c["city"]["name"] for c in body["cities"]] == ["Chennai", "Bhopal", "Agra"]
    assert [c["rank"] for c in body["cities"]] == [1, 2, 3]
    assert (body["cities_in_scope"], body["eligible"]) == (4, 3)
    assert [(e["city"]["name"], e["reason"]) for e in body["excluded"]] == [
        ("Dimapur", "low_coverage")
    ]


def test_overview_includes_both_periods_and_the_change(loaded):
    cities = {c["city"]["name"]: c for c in loaded.get("/v1/overview").json()["cities"]}

    agra = cities["Agra"]
    assert agra["base"]["aqi_days"]["good"] == 100
    assert agra["comparison"]["aqi_days"]["good"] == 120
    assert agra["change"]["aqi_days"]["good"] == 20
    assert agra["change"]["pollutant_means"]["PM2.5"] == -7.5
    assert agra["base"]["dominant_days"] == {"PM10": 200, "PM2.5": 150}
    assert agra["city"]["groups"] == ["IGP", "NCAP"]
    # Lenient comparison: Chennai stays listed with no FY2025-26 numbers.
    assert (cities["Chennai"]["comparison"], cities["Chennai"]["change"]) == (None, None)


def test_pm25_ranking_drops_the_sensor_fault_city(loaded):
    body = loaded.get("/v1/overview", params={"rank_by": "PM2.5", "direction": "worst"}).json()

    assert [c["city"]["name"] for c in body["cities"]] == ["Agra", "Bhopal"]
    assert ("Chennai", "pm25_floor") in [(e["city"]["name"], e["reason"]) for e in body["excluded"]]


@pytest.mark.parametrize(
    ("params", "names"),
    [
        ({"state": "tamil nadu"}, ["Chennai"]),
        ({"group": "IGP"}, ["Agra"]),
        ({"top": 1}, ["Chennai"]),
    ],
)
def test_overview_filters(loaded, params, names):
    body = loaded.get("/v1/overview", params=params).json()

    assert [c["city"]["name"] for c in body["cities"]] == names


def test_overview_rejects_unknown_periods_and_groups(loaded):
    assert loaded.get("/v1/overview", params={"base": "FY2019-20"}).status_code == 404
    assert loaded.get("/v1/overview", params={"group": "METRO"}).status_code == 422


def test_city_detail_works_for_excluded_cities(loaded):
    body = loaded.get(f"/v1/cities/{city_id(loaded, 'Dimapur')}").json()

    assert body["base_stats"]["coverage"] == round(200 / 365, 4)
    assert body["comparison_stats"] is None
    assert body["has_hourly_data"] is False
    assert loaded.get(f"/v1/cities/{city_id(loaded, 'Agra')}").json()["has_hourly_data"] is True


def test_hourly_cities_lists_stations(loaded):
    [entry] = loaded.get("/v1/hourly/cities").json()

    assert entry["city"]["name"] == "Agra"
    assert [s["name"] for s in entry["stations"]] == ["Sanjay Palace", "Shahjahan Garden"]


def test_hourly_summary_uses_the_city_average_per_hour(loaded):
    body = loaded.get("/v1/hourly/summary", params={"city_id": city_id(loaded, "Agra")}).json()

    base = body["base"]
    assert body["station"] is None
    assert (body["unit"], body["thresholds"]) == ("µg/m³", {"naaqs": 60.0, "who": 15.0})
    # 01:00 averages both stations (100, 60); 02:00 only one station reported (80).
    assert [(h["label"], h["mean"]) for h in base["hours"][:2]] == [
        ("01:00", 80.0),
        ("02:00", 80.0),
    ]
    assert (base["kpis"]["mean"], base["kpis"]["peak"], base["kpis"]["hours_with_data"]) == (
        80.0,
        80.0,
        2,
    )
    assert base["kpis"]["above_naaqs_pct"] == 100.0
    assert body["comparison"]["kpis"]["mean"] == 50.0
    assert base["peak_day"] is None  # 2 hours is not a valid daily mean


def test_hourly_summary_for_one_station(loaded):
    agra = city_id(loaded, "Agra")
    stations = loaded.get("/v1/hourly/cities").json()[0]["stations"]

    body = loaded.get(
        "/v1/hourly/summary",
        params={"city_id": agra, "station_id": stations[0]["id"], "pollutant": "SO2"},
    ).json()

    assert body["station"]["name"] == "Sanjay Palace"
    assert body["base"]["kpis"]["hours_with_data"] == 1  # the 02:00 SO2 value is missing
    assert (
        loaded.get(
            "/v1/hourly/summary",
            params={"city_id": city_id(loaded, "Bhopal"), "station_id": stations[0]["id"]},
        ).status_code
        == 404
    )


def test_heatmap_orders_stations_by_mean(loaded):
    body = loaded.get(
        "/v1/hourly/heatmap", params={"city_id": city_id(loaded, "Agra"), "top": 1}
    ).json()

    assert body["stations_total"] == 2
    [row] = body["rows"]
    assert (row["station"]["name"], row["mean"]) == ("Sanjay Palace", 90.0)
    assert len(row["hours"]) == 24 and body["hour_labels"][23] == "00:00"


def test_day_heatmap(loaded):
    body = loaded.get(
        "/v1/hourly/day", params={"city_id": city_id(loaded, "Agra"), "day": "2024-12-01"}
    ).json()

    assert {r["station"]["name"]: r["hours"][0] for r in body["rows"]} == {
        "Sanjay Palace": 100.0,
        "Shahjahan Garden": 60.0,
    }
