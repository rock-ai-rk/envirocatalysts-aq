import pytest
from sqlalchemy import select

from app.importer.canonical import load_directory
from app.linking import distance_m, location_key, refresh_links
from app.models import LiveStation, Station, StationLink
from app.scraper.service import run_scrape
from tests.factories import FakeSource, make_record, small_dataset

AGRA = {"city": "Agra", "state": "Uttar_Pradesh"}


def agra_record(station: str, latitude: str, longitude: str) -> dict:
    return make_record(station=station, latitude=latitude, longitude=longitude, **AGRA)


def links(session) -> dict[str, tuple[str, str]]:
    """{historical station name: (live station name, method)}"""
    rows = session.execute(
        select(Station.name, LiveStation.name, StationLink.method)
        .join(StationLink, StationLink.station_id == Station.id)
        .join(LiveStation, LiveStation.id == StationLink.live_station_id)
    )
    return {station: (live, method) for station, live, method in rows}


@pytest.fixture
def agra(session, tmp_path):
    """Agra's historical stations: Sanjay Palace (27.19, 78.00), Shahjahan Garden (27.17, 78.02)."""
    load_directory(session, small_dataset(tmp_path))
    return session


def test_location_key_ignores_city_agency_case_and_punctuation():
    assert location_key("Anand Vihar, Delhi - DPCC") == "anand vihar"
    assert location_key("Anand  Vihar") == "anand vihar"
    assert location_key("SDM Office_Khagra, Kishanganj - BSPCB") == "sdm office khagra"


def test_links_by_location_name_within_the_city(agra):
    run_scrape(
        agra, FakeSource([agra_record("Sanjay Palace, Agra - UPPCB", "27.1987", "78.0061")]), 30
    )

    assert links(agra) == {"Sanjay Palace": ("Sanjay Palace, Agra - UPPCB", "name")}


def test_links_by_distance_when_names_differ(agra):
    # About 70 m from Shahjahan Garden, under a different name.
    run_scrape(
        agra, FakeSource([agra_record("Collectorate, Agra - UPPCB", "27.1705", "78.0205")]), 30
    )

    assert links(agra) == {"Shahjahan Garden": ("Collectorate, Agra - UPPCB", "distance")}
    link = agra.scalars(select(StationLink)).one()
    assert link.distance_m == pytest.approx(73, abs=5)


def test_does_not_link_distant_stations_or_other_cities(agra):
    records = [
        agra_record("Rohta, Agra - UPPCB", "27.25", "77.95"),  # ~8 km away
        make_record(station="Sanjay Palace, Delhi - DPCC", latitude="27.19", longitude="78.00"),
    ]

    run_scrape(agra, FakeSource(records), 30)
    report = refresh_links(agra)

    assert links(agra) == {}
    assert sorted(report.unmatched) == ["Sanjay Palace, Agra", "Shahjahan Garden, Agra"]


def test_run_counts_new_links_and_later_runs_keep_them(agra):
    records = [agra_record("Sanjay Palace, Agra - UPPCB", "27.1987", "78.0061")]

    first = run_scrape(agra, FakeSource(records), 30)
    second = run_scrape(agra, FakeSource(records), 30)

    assert (first.stations_linked, second.stations_linked) == (1, 0)
    assert len(links(agra)) == 1


def test_manual_links_are_never_replaced(agra):
    run_scrape(
        agra,
        FakeSource(
            [
                agra_record("Sanjay Palace, Agra - UPPCB", "27.1987", "78.0061"),
                agra_record("Collectorate, Agra - UPPCB", "27.1705", "78.0205"),
            ]
        ),
        30,
    )
    sanjay = agra.scalar(select(Station).where(Station.name == "Sanjay Palace"))
    link = agra.get(StationLink, sanjay.id)
    link.live_station_id = agra.scalar(
        select(LiveStation.id).where(LiveStation.name.startswith("Collectorate"))
    )
    link.method = "manual"
    agra.commit()

    refresh_links(agra)

    assert links(agra)["Sanjay Palace"] == ("Collectorate, Agra - UPPCB", "manual")


def test_importing_links_to_stations_already_scraped(session, tmp_path):
    run_scrape(
        session,
        FakeSource([agra_record("Sanjay Palace, Agra - UPPCB", "27.1987", "78.0061")]),
        30,
    )

    report = load_directory(session, small_dataset(tmp_path))

    assert report.counts["station_links"] == 1
    assert links(session) == {"Sanjay Palace": ("Sanjay Palace, Agra - UPPCB", "name")}


def test_distance_needs_coordinates_on_both_sides():
    here = Station(name="a", latitude=28.6, longitude=77.2)
    nowhere = LiveStation(name="b", city="c", state="d", latitude=None, longitude=None)

    assert distance_m(here, nowhere) is None
    assert distance_m(here, here) == 0
