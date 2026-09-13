import pytest

from app.analytics.live import aqi_category, station_aqi


@pytest.mark.parametrize(
    ("aqi", "category"),
    [
        (0, "good"),
        (50, "good"),
        (51, "satisfactory"),
        (100, "satisfactory"),
        (101, "moderate"),
        (200, "moderate"),
        (201, "poor"),
        (301, "very_poor"),
        (400, "very_poor"),
        (401, "severe"),
    ],
)
def test_category_bounds_follow_cpcb(aqi, category):
    assert aqi_category(aqi) == category


def test_aqi_is_the_highest_sub_index():
    aqi = station_aqi({"PM2.5": 46, "PM10": 88, "CO": 25, "SO2": 9, "NH3": None})

    assert (aqi.value, aqi.category, aqi.dominant, aqi.pollutants_used) == (
        88,
        "satisfactory",
        "PM10",
        4,
    )


def test_needs_three_pollutants():
    assert station_aqi({"PM2.5": 120, "CO": 30, "NO2": None}) is None


def test_needs_a_particulate():
    assert station_aqi({"CO": 30, "NO2": 40, "SO2": 12, "O3": 60}) is None


def test_ties_go_to_the_first_listed_pollutant():
    assert station_aqi({"PM10": 150, "PM2.5": 150, "NO2": 20}).dominant == "PM2.5"
