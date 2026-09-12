from app.api.admin import get_record_source
from app.scraper.service import run_scrape
from tests.factories import FakeSource, make_record

ADMIN = {"X-Admin-Token": "test-admin-token"}


def seed(session, records: list[dict]) -> None:
    run_scrape(session, FakeSource(records), retention_days=30)


def test_health(api):
    assert api.get("/health").json() == {"status": "ok", "database": "ok"}


def test_latest_groups_readings_by_station_in_pollutant_order(api, session):
    seed(
        session,
        [
            make_record(pollutant="PM10", avg="210"),
            make_record(pollutant="PM2.5"),
            make_record(station="Bawana, Delhi - DPCC", avg="95"),
        ],
    )

    body = api.get("/v1/live/latest", params={"city": "delhi"}).json()

    assert [s["name"] for s in body["stations"]] == [
        "Anand Vihar, Delhi - DPCC",
        "Bawana, Delhi - DPCC",
    ]
    readings = body["stations"][0]["readings"]
    assert [r["pollutant"] for r in readings] == ["PM2.5", "PM10"]
    assert (readings[0]["avg"], readings[0]["stale"]) == (120.0, False)


def test_latest_returns_only_the_newest_reading_per_pollutant(api, session):
    seed(session, [make_record(avg="150", hours_ago=2), make_record(avg="120", hours_ago=0)])

    readings = api.get("/v1/live/latest").json()["stations"][0]["readings"]

    assert [r["avg"] for r in readings] == [120.0]


def test_latest_flags_stale_readings_and_drops_very_old_ones(api, session):
    seed(
        session,
        [make_record(pollutant="PM2.5", hours_ago=5), make_record(pollutant="PM10", hours_ago=72)],
    )

    readings = api.get("/v1/live/latest").json()["stations"][0]["readings"]

    assert [(r["pollutant"], r["stale"]) for r in readings] == [("PM2.5", True)]


def test_latest_filters_by_state(api, session):
    seed(
        session,
        [
            make_record(),
            make_record(station="Sector 62, Noida - IMD", city="Noida", state="Uttar_Pradesh"),
        ],
    )

    body = api.get("/v1/live/latest", params={"state": "Uttar Pradesh"}).json()

    assert [s["city"] for s in body["stations"]] == ["Noida"]


def test_cities_ranks_city_means_and_ignores_stale_stations(api, session):
    seed(
        session,
        [
            make_record(station="Anand Vihar, Delhi - DPCC", avg="200"),
            make_record(station="Bawana, Delhi - DPCC", avg="100"),
            make_record(
                station="Sector 62, Noida - IMD", city="Noida", state="Uttar_Pradesh", avg="90"
            ),
            make_record(
                station="Sanjay Palace, Agra - UPPCB",
                city="Agra",
                state="Uttar_Pradesh",
                avg="400",
                hours_ago=6,
            ),
        ],
    )

    worst_first = api.get("/v1/live/cities", params={"pollutant": "PM2.5"}).json()["cities"]
    best_first = api.get("/v1/live/cities", params={"order": "asc", "limit": 1}).json()["cities"]

    assert [(c["city"], c["avg"], c["station_count"]) for c in worst_first] == [
        ("Delhi", 150.0, 2),
        ("Noida", 90.0, 1),
    ]
    assert [c["city"] for c in best_first] == ["Noida"]


def test_cities_rejects_unknown_pollutants(api):
    assert api.get("/v1/live/cities", params={"pollutant": "XYZ"}).status_code == 422


def test_status_reports_the_last_run(api, session):
    seed(session, [make_record()])

    body = api.get("/v1/live/status").json()

    assert body["last_run"]["status"] == "success"
    assert body["last_success"]["id"] == body["last_run"]["id"]
    assert body["station_count"] == 1
    assert body["data_as_of"] is not None


def test_admin_scrape_requires_the_token(api):
    assert api.post("/v1/admin/scrape").status_code == 401
    assert api.post("/v1/admin/scrape", headers={"X-Admin-Token": "wrong"}).status_code == 401


def test_admin_scrape_needs_an_api_key(api):
    response = api.post("/v1/admin/scrape", headers=ADMIN)

    assert response.status_code == 503
    assert "DATAGOV_API_KEY" in response.json()["detail"]


def test_admin_scrape_runs_the_scraper(api):
    api.app.dependency_overrides[get_record_source] = lambda: FakeSource([make_record()])

    response = api.post("/v1/admin/scrape", headers=ADMIN)

    assert response.status_code == 200
    assert response.json()["readings_inserted"] == 1
