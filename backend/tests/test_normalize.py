import pytest

from app.scraper.normalize import InvalidRecord, parse_record, parse_records
from tests.factories import make_record


def test_parses_current_field_names():
    reading = parse_record(make_record(avg="120", low="80", high="190"))

    assert (reading.station, reading.city, reading.state) == (
        "Anand Vihar, Delhi - DPCC",
        "Delhi",
        "Delhi",
    )
    assert reading.pollutant == "PM2.5"
    assert (reading.avg_value, reading.min_value, reading.max_value) == (120.0, 80.0, 190.0)
    assert reading.latitude == pytest.approx(28.646835)


def test_accepts_legacy_field_names():
    raw = make_record()
    for kind in ("avg", "min", "max"):
        raw[f"pollutant_{kind}"] = raw.pop(f"{kind}_value")

    assert parse_record(raw).avg_value == 120.0


def test_timestamps_are_read_as_ist():
    raw = make_record() | {"last_update": "12-09-2026 14:00:00"}

    assert parse_record(raw).observed_at.isoformat() == "2026-09-12T14:00:00+05:30"


def test_normalises_place_names_and_pollutant_ids():
    reading = parse_record(
        make_record(state="Uttar_Pradesh", city="Greater_Noida", pollutant="OZONE")
    )

    assert (reading.state, reading.city, reading.pollutant) == (
        "Uttar Pradesh",
        "Greater Noida",
        "O3",
    )


def test_missing_values_become_none():
    reading = parse_record(make_record(low="NA", high="", latitude="NA"))

    assert reading.min_value is None
    assert reading.max_value is None
    assert reading.latitude is None
    assert reading.avg_value == 120.0


@pytest.mark.parametrize(
    "change",
    [
        {"station": " "},
        {"pollutant_id": "BENZENE"},
        {"last_update": "yesterday"},
        {"avg_value": "NA", "min_value": "NA", "max_value": "NA"},
    ],
    ids=["no-station", "unknown-pollutant", "bad-timestamp", "no-values"],
)
def test_rejects_unusable_records(change):
    with pytest.raises(InvalidRecord):
        parse_record(make_record() | change)


def test_parse_records_counts_skipped_records():
    readings, skipped = parse_records([make_record(), make_record(pollutant="BENZENE")])

    assert len(readings) == 1
    assert skipped == 1
