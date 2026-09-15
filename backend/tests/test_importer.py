import re

import pytest
from sqlalchemy import func, select

from app.domain import HOURLY_COLUMNS
from app.importer.canonical import InvalidDataset, load_directory
from app.importer.demo import write_demo_dataset
from app.models import City, CityAqiDays, Dataset, StationHourly
from tests.factories import small_dataset, write_dataset


def count(session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_loads_every_table(session, tmp_path):
    report = load_directory(session, small_dataset(tmp_path))

    assert report.counts == {
        "cities": 4,
        "city_aqi_days": 6,
        "city_pollutant_means": 6,
        "city_dominant_days": 3,
        "stations": 2,
        "station_hourly": 4,
    }
    agra = session.scalar(select(City).where(City.name == "Agra"))
    assert agra.group_codes == ["IGP", "NCAP"]
    assert session.scalar(select(Dataset.name)) == "test-dataset"


def test_loading_twice_changes_nothing(session, tmp_path):
    directory = small_dataset(tmp_path)
    load_directory(session, directory)
    load_directory(session, directory)

    assert count(session, City) == 4
    assert count(session, CityAqiDays) == 6
    assert count(session, StationHourly) == 4


def test_replace_removes_previous_data(session, tmp_path):
    load_directory(session, small_dataset(tmp_path / "first"))
    other = write_dataset(tmp_path / "second", cities=[["Kanpur", "Uttar Pradesh", "", "", "NCAP"]])

    load_directory(session, other, replace=True)

    assert list(session.scalars(select(City.name))) == ["Kanpur"]
    assert count(session, StationHourly) == 0


@pytest.mark.parametrize(
    ("tables", "message"),
    [
        (
            {"city_aqi_days": [["Nowhere", "X", "FY2024-25", 1, 0, 0, 0, 0, 0, 1]]},
            "city_aqi_days.csv:2: city 'Nowhere' (X) is not in cities.csv",
        ),
        (
            {"city_aqi_days": [["Agra", "Uttar Pradesh", "FY2024-26", 1, 0, 0, 0, 0, 0, 1]]},
            "city_aqi_days.csv:2: 'FY2024-26'",
        ),
        (
            {"city_aqi_days": [["Agra", "Uttar Pradesh", "FY2024-25", 200, 200, 0, 0, 0, 0, 350]]},
            "add up to more than days_with_data",
        ),
        (
            {"city_pollutant_means": [["Agra", "Uttar Pradesh", "FY2024-25", "Benzene", 3, 300]]},
            "unknown pollutant 'Benzene'",
        ),
    ],
    ids=["unknown-city", "bad-period", "too-many-days", "unknown-pollutant"],
)
def test_bad_rows_are_reported_and_nothing_is_saved(session, tmp_path, tables, message):
    directory = write_dataset(tmp_path, cities=[["Agra", "Uttar Pradesh", "", "", ""]], **tables)

    with pytest.raises(InvalidDataset, match=re.escape(message)):
        load_directory(session, directory)

    assert count(session, City) == 0


def test_missing_manifest_is_reported(session, tmp_path):
    directory = small_dataset(tmp_path)
    (directory / "manifest.json").unlink()

    with pytest.raises(InvalidDataset, match="manifest.json: missing"):
        load_directory(session, directory)


def test_demo_dataset_loads_and_is_marked_synthetic(session, tmp_path):
    write_demo_dataset(tmp_path)

    report = load_directory(session, tmp_path)

    assert report.counts["cities"] == 40
    assert report.counts["station_hourly"] > 200_000
    assert session.scalar(select(Dataset.synthetic)) is True


def test_every_hourly_pollutant_has_a_column():
    assert set(HOURLY_COLUMNS.values()) <= set(StationHourly.__table__.columns.keys())
