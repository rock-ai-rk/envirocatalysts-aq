"""Real Overview data and demo hourly data served together, each labelled with its own source."""

import pytest
from sqlalchemy import func, select

from app.importer.canonical import InvalidDataset, load_directory
from app.models import City, Dataset, Station, StationHourly
from tests.factories import write_dataset

AGRA = ["Agra", "Uttar Pradesh", 27.18, 78.01, "NCAP IGP"]


def overview_dataset(directory):
    return write_dataset(
        directory,
        scope="overview",
        cities=[AGRA],
        city_aqi_days=[["Agra", "Uttar Pradesh", "FY2024-25", 100, 150, 60, 30, 10, 0, 350]],
    )


def hourly_dataset(directory, station="Sanjay Palace", city="Agra"):
    return write_dataset(
        directory,
        synthetic=True,
        scope="hourly",
        stations=[[city, "Uttar Pradesh", station, "DEMO_1", 27.19, 78.0]],
        station_hourly=[
            [city, "Uttar Pradesh", station, "2024-04-01 01:00", 50, 90, 20, 5, 0.8, 30]
        ],
    )


def count(session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_hourly_dataset_attaches_stations_without_touching_cities(session, tmp_path):
    load_directory(session, overview_dataset(tmp_path / "overview"), replace=True)

    report = load_directory(session, hourly_dataset(tmp_path / "hourly"), replace=True)

    assert report.counts == {"stations": 1, "station_hourly": 1, "station_links": 0}
    agra = session.scalar(select(City).where(City.name == "Agra"))
    assert agra.group_codes == ["IGP", "NCAP"]  # still as the overview dataset set them
    assert [d.scope for d in session.scalars(select(Dataset).order_by(Dataset.id))] == [
        "overview",
        "hourly",
    ]


def test_replacing_hourly_data_keeps_the_overview(session, tmp_path):
    load_directory(session, overview_dataset(tmp_path / "overview"), replace=True)
    load_directory(session, hourly_dataset(tmp_path / "first"), replace=True)

    load_directory(session, hourly_dataset(tmp_path / "second", station="Nunhai"), replace=True)

    assert list(session.scalars(select(Station.name))) == ["Nunhai"]
    assert count(session, StationHourly) == 1
    assert count(session, City) == 1
    assert [d.scope for d in session.scalars(select(Dataset).order_by(Dataset.id))] == [
        "overview",
        "hourly",
    ]


def test_hourly_station_needs_a_loaded_city(session, tmp_path):
    load_directory(session, overview_dataset(tmp_path / "overview"), replace=True)

    with pytest.raises(InvalidDataset, match=r"stations.csv:2: city 'Kanpur'"):
        load_directory(session, hourly_dataset(tmp_path / "hourly", city="Kanpur"))


def test_unknown_scope_is_rejected(session, tmp_path):
    with pytest.raises(InvalidDataset, match="scope 'weekly' is not one of"):
        load_directory(session, write_dataset(tmp_path / "d", scope="weekly"))


def test_meta_reports_each_screens_source(api, session, tmp_path):
    load_directory(session, overview_dataset(tmp_path / "overview"), replace=True)
    load_directory(session, hourly_dataset(tmp_path / "hourly"))

    datasets = api.get("/v1/meta").json()["datasets"]

    assert (datasets["overview"]["scope"], datasets["overview"]["synthetic"]) == ("overview", False)
    assert (datasets["hourly"]["scope"], datasets["hourly"]["synthetic"]) == ("hourly", True)


def test_a_full_dataset_serves_both_screens(api, session, tmp_path):
    load_directory(session, write_dataset(tmp_path / "full", synthetic=True, cities=[AGRA]))

    datasets = api.get("/v1/meta").json()["datasets"]

    assert datasets["overview"]["scope"] == datasets["hourly"]["scope"] == "all"
