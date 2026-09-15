from app.api.admin import get_place_source
from app.models import CityGroupMember
from tests.factories import FakeSource, add_city, add_readings, last_hours, om_answer

ADMIN = {"X-Admin-Token": "test-admin-token"}
# Enough for an AQI: three pollutants including a particulate, over the last 24 hours.
MODERATE = {"pm25": 75.0, "pm10": 100.0, "no2": 20.0}  # PM2.5 sub-index 150
POOR = {"pm25": 105.0, "pm10": 100.0, "no2": 20.0}  # 250
SATISFACTORY = {"pm25": 45.0, "pm10": 60.0, "no2": 20.0}  # 75


def test_health(api):
    assert api.get("/health").json() == {"status": "ok", "database": "ok"}


# --- /v1/live/cities


def test_cities_are_ranked_by_estimated_aqi_worst_first(api, session):
    add_readings(session, add_city(session, "Agra"), last_hours(24), **MODERATE)
    add_readings(session, add_city(session, "Delhi", "Delhi"), last_hours(24), **POOR)
    add_readings(
        session, add_city(session, "Bhopal", "Madhya Pradesh"), last_hours(24), **SATISFACTORY
    )

    body = api.get("/v1/live/cities").json()

    assert [
        (c["city"]["name"], c["aqi"]["value"], c["aqi"]["category"]) for c in body["cities"]
    ] == [
        ("Delhi", 250, "poor"),
        ("Agra", 150, "moderate"),
        ("Bhopal", 75, "satisfactory"),
    ]
    assert body["cities"][0]["aqi"]["dominant"] == "PM2.5"
    assert body["source"] == "open_meteo_cams"
    assert "Open-Meteo" in body["attribution"] and body["attribution_url"].startswith("https://")


def test_cities_can_be_ranked_best_first_and_limited(api, session):
    add_readings(session, add_city(session, "Agra"), last_hours(24), **MODERATE)
    add_readings(session, add_city(session, "Delhi", "Delhi"), last_hours(24), **POOR)

    body = api.get("/v1/live/cities", params={"order": "asc", "limit": 1}).json()

    assert [c["city"]["name"] for c in body["cities"]] == ["Agra"]


def test_cities_filter_by_state_and_group(api, session):
    agra = add_city(session, "Agra")
    add_readings(session, agra, last_hours(24), **MODERATE)
    add_readings(session, add_city(session, "Delhi", "Delhi"), last_hours(24), **POOR)
    session.add(CityGroupMember(city_id=agra.id, code="IGP"))
    session.commit()

    by_state = api.get("/v1/live/cities", params={"state": "uttar pradesh"}).json()
    by_group = api.get("/v1/live/cities", params={"group": "IGP"}).json()

    assert [c["city"]["name"] for c in by_state["cities"]] == ["Agra"]
    assert [c["city"]["name"] for c in by_group["cities"]] == ["Agra"]


def test_cities_leave_out_stale_cities_and_those_without_an_aqi(api, session):
    add_readings(session, add_city(session, "Agra"), last_hours(24, ending_hours_ago=5), **POOR)
    add_readings(session, add_city(session, "Delhi", "Delhi"), last_hours(24), pm25=105.0)
    add_readings(session, add_city(session, "Bhopal", "Madhya Pradesh"), last_hours(24), **MODERATE)

    body = api.get("/v1/live/cities").json()

    assert [c["city"]["name"] for c in body["cities"]] == ["Bhopal"]


def test_cities_reject_unknown_groups(api):
    assert api.get("/v1/live/cities", params={"group": "XYZ"}).status_code == 422


# --- /v1/live/cities/{id}


def test_city_latest_has_the_newest_hour_and_the_aqi(api, session):
    city = add_city(session)
    add_readings(session, city, last_hours(24), **MODERATE, co=0.8)

    body = api.get(f"/v1/live/cities/{city.id}").json()

    assert (body["status"], body["measure"]) == ("ok", "model_estimate")
    assert body["aqi"] == {
        "value": 150,
        "category": "moderate",
        "dominant": "PM2.5",
        "sub_indices": {"PM2.5": 150, "PM10": 100, "NO2": 25, "CO": 40},
    }
    assert [(r["pollutant"], r["value"], r["unit"]) for r in body["readings"]] == [
        ("PM2.5", 75.0, "µg/m³"),
        ("PM10", 100.0, "µg/m³"),
        ("NO2", 20.0, "µg/m³"),
        ("CO", 0.8, "mg/m³"),
    ]
    assert body["observed_at"].endswith("+05:30")
    assert body["city"]["name"] == "Agra"


def test_city_latest_flags_stale_data(api, session):
    city = add_city(session)
    add_readings(session, city, last_hours(24, ending_hours_ago=5), **MODERATE)

    body = api.get(f"/v1/live/cities/{city.id}").json()

    assert body["status"] == "stale"
    assert body["aqi"]["value"] == 150


def test_city_latest_without_enough_data_for_an_aqi(api, session):
    city = add_city(session)
    add_readings(session, city, last_hours(3), **MODERATE)

    body = api.get(f"/v1/live/cities/{city.id}").json()

    assert (body["status"], body["aqi"], len(body["readings"])) == ("ok", None, 3)


def test_city_latest_ignores_readings_older_than_two_days(api, session):
    city = add_city(session)
    add_readings(session, city, last_hours(1, ending_hours_ago=72), **MODERATE)

    body = api.get(f"/v1/live/cities/{city.id}").json()

    assert (body["status"], body["readings"]) == ("no_recent_readings", [])


def test_city_latest_for_a_city_without_coordinates(api, session):
    city = add_city(session, "Dimapur", "Nagaland", latitude=None, longitude=None)

    assert api.get(f"/v1/live/cities/{city.id}").json()["status"] == "not_in_feed"


def test_city_latest_unknown_city_is_404(api):
    assert api.get("/v1/live/cities/9999").status_code == 404


# --- /v1/live/status and the admin trigger


def test_status_reports_the_last_run(api, session):
    add_city(session)
    api.app.dependency_overrides[get_place_source] = lambda: FakeSource(om_answer(last_hours(2)))
    api.post("/v1/admin/scrape", headers=ADMIN)

    body = api.get("/v1/live/status").json()

    assert body["last_run"]["status"] == "success"
    assert body["last_success"]["id"] == body["last_run"]["id"]
    assert body["cities_with_readings"] == 1
    assert body["data_as_of"] is not None


def test_admin_scrape_requires_the_token(api):
    assert api.post("/v1/admin/scrape").status_code == 401
    assert api.post("/v1/admin/scrape", headers={"X-Admin-Token": "wrong"}).status_code == 401


def test_admin_scrape_runs_the_scraper(api, session):
    add_city(session)
    api.app.dependency_overrides[get_place_source] = lambda: FakeSource(om_answer(last_hours(1)))

    response = api.post("/v1/admin/scrape", headers=ADMIN)

    assert response.status_code == 200
    assert (response.json()["cities_seen"], response.json()["readings_inserted"]) == (1, 6)
