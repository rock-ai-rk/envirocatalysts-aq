import csv
import json

import pytest
from sqlalchemy import select

from app.importer.canonical import load_directory
from app.importer.dashboard_export import ConversionError, convert_dashboard_export
from app.models import City, CityAqiDays, CityPollutantMean, Dataset, Period

AQI_HEADER = ["city", "Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def dashboard_export(root):
    """Two cities qualify in FY 2024-25; Varanasi only qualifies in FY 2025-26, so its FY 2024-25
    days appear only in the second run's (lenient) comparison panel."""
    run1, run2 = root / "overview" / "base_FY2024-25", root / "overview" / "base_FY2025-26"
    agra_24 = ["Agra", 97, 186, 77, 4, 0, 0]
    write_csv(
        run1 / "chart1_aqi_days_FY 2024-25.csv",
        AQI_HEADER,
        [agra_24, ["Kanpur", 20, 150, 100, 20, 0, 0]],
    )
    write_csv(
        run1 / "chart1_aqi_days_FY 2025-26.csv",
        AQI_HEADER,
        [["Agra", 110, 180, 70, 5, 0, 0], ["Kanpur", 25, 160, 90, 15, 0, 0]],
    )
    write_csv(
        run1 / "chart2_PM2.5_FY 2024-25.csv",
        ["city", "conc_avg"],
        [["Agra", "31.41369"], ["Kanpur", "58"]],
    )
    write_csv(
        run1 / "chart3_dominant_poll_FY 2024-25.csv",
        ["city", "PM2.5", "PM10", "NO2", "O3", "CO", "SO2", "NH3"],
        [["Agra", 86, 255, 8, 8, 4, 4, 0]],
    )
    write_csv(
        run2 / "chart1_aqi_days_FY 2024-25.csv",
        AQI_HEADER,
        [agra_24, ["Varanasi", 10, 60, 30, 0, 0, 0]],
    )
    write_csv(
        run2 / "chart1_aqi_days_FY 2025-26.csv",
        AQI_HEADER,
        [["Agra", 110, 180, 70, 5, 0, 0], ["Varanasi", 40, 200, 90, 10, 0, 0]],
    )
    for run in ("base_FY2024-25", "base_FY2025-26"):
        write_csv(
            root / "states" / run / "Uttar Pradesh" / "chart1_aqi_days_FY 2024-25.csv",
            AQI_HEADER,
            [["Agra"], ["Kanpur"], ["Varanasi"]],
        )
    write_csv(
        root / "groups" / "base_FY2024-25" / "NCAP" / "chart1_aqi_days_FY 2024-25.csv",
        AQI_HEADER,
        [["Agra"], ["Kanpur"]],
    )
    (root / "map-points.json").write_text(
        json.dumps([{"label": "Agra", "lat": 27.1767, "lon": 78.0081}])
    )
    return root


def test_converted_export_loads_with_every_city_year(session, tmp_path):
    out = tmp_path / "dataset"
    convert_dashboard_export(dashboard_export(tmp_path / "export"), out, "2026-09-15")

    report = load_directory(session, out, replace=True)

    assert report.counts["cities"] == 3
    assert report.counts["city_aqi_days"] == 6  # the shared Agra FY 2024-25 row is kept once
    agra = session.scalar(select(City).where(City.name == "Agra"))
    assert (agra.state, agra.latitude, agra.group_codes) == ("Uttar Pradesh", 27.1767, ["NCAP"])
    varanasi_24 = session.scalar(
        select(CityAqiDays)
        .join(City)
        .join(Period)
        .where(City.name == "Varanasi", Period.key == "FY2024-25")
    )
    # Under 70% of the year, so the API will exclude Varanasi from the FY 2024-25 ranking.
    assert varanasi_24.days_with_data == 100
    mean = session.scalar(select(CityPollutantMean).join(City).where(City.name == "Agra"))
    assert (mean.pollutant, mean.mean) == ("PM2.5", 31.414)
    dataset = session.scalar(select(Dataset))
    assert (dataset.synthetic, dataset.scope) == (False, "overview")
    assert "EnviroCatalysts Air Quality Dashboard" in dataset.source


def test_downloads_that_disagree_are_rejected(tmp_path):
    export = dashboard_export(tmp_path / "export")
    write_csv(
        export / "overview" / "base_FY2025-26" / "chart1_aqi_days_FY 2024-25.csv",
        AQI_HEADER,
        [["Agra", 1, 2, 3, 4, 5, 6]],
    )

    with pytest.raises(
        ConversionError,
        match=r"base_FY2025-26/chart1_aqi_days_FY 2024-25.csv: \('Agra', 'FY2024-25'\)",
    ):
        convert_dashboard_export(export, tmp_path / "out", "2026-09-15")


def test_a_city_without_a_state_is_reported(tmp_path):
    export = dashboard_export(tmp_path / "export")
    for run in ("base_FY2024-25", "base_FY2025-26"):
        write_csv(
            export / "states" / run / "Uttar Pradesh" / "chart1_aqi_days_FY 2024-25.csv",
            AQI_HEADER,
            [["Agra"], ["Kanpur"]],
        )

    with pytest.raises(ConversionError, match="no state found for 1 cities: Varanasi"):
        convert_dashboard_export(export, tmp_path / "out", "2026-09-15")
