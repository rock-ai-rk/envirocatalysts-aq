from datetime import UTC, datetime, timedelta

import pytest

from app.analytics.live import aqi_category, averaged, estimate_aqi, sub_index

AT = datetime(2026, 9, 15, 12, tzinfo=UTC)


def day(value: float, hours: int = 24) -> dict[datetime, float]:
    """The same value for each of the `hours` hours ending at AT."""
    return {AT - timedelta(hours=back): value for back in range(hours)}


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


@pytest.mark.parametrize(
    ("pollutant", "concentration", "index"),
    [
        ("PM2.5", 0, 0),
        ("PM2.5", 30, 50),  # top of Good
        ("PM2.5", 45, 75),  # halfway through Satisfactory
        ("PM2.5", 90, 200),  # top of Moderate
        ("PM2.5", 250, 400),  # top of Very Poor
        ("PM2.5", 315, 450),  # Severe continues the Very Poor slope (130 µg/m³ per 100)
        ("PM2.5", 900, 500),  # capped
        ("PM10", 100, 100),
        ("PM10", 175, 150),
        ("CO", 1.5, 75),  # mg/m³
        ("O3", 134, 150),
        ("NO2", -3, 0),  # a model can dip below zero; treated as zero
    ],
)
def test_sub_index_interpolates_within_cpcb_bands(pollutant, concentration, index):
    assert sub_index(pollutant, concentration) == index


def test_24_hour_average_needs_16_hours():
    assert averaged("PM2.5", day(40, hours=16), AT) == 40
    assert averaged("PM2.5", day(40, hours=15), AT) is None


def test_hours_after_the_asked_hour_are_ignored():
    series = day(40) | {AT + timedelta(hours=1): 400}

    assert averaged("PM2.5", series, AT) == 40


def test_carbon_monoxide_uses_the_highest_8_hour_average_of_the_day():
    series = day(0.5) | {AT - timedelta(hours=back): 1.5 for back in range(10, 18)}

    assert averaged("CO", series, AT) == 1.5


def test_an_8_hour_average_needs_6_of_the_8_hours():
    assert averaged("CO", day(0.5, hours=6), AT) == 0.5
    assert averaged("CO", day(0.5, hours=5), AT) is None


def test_ozone_is_left_out_of_the_estimate():
    series = {"PM2.5": day(45), "PM10": day(60), "NO2": day(20), "O3": day(200)}

    aqi = estimate_aqi(series, AT)

    assert (aqi.value, aqi.dominant) == (75, "PM2.5")
    assert "O3" not in aqi.sub_indices


def test_aqi_is_the_highest_sub_index():
    aqi = estimate_aqi({"PM2.5": day(45), "PM10": day(175), "NO2": day(20), "CO": day(0.5)}, AT)

    assert (aqi.value, aqi.category, aqi.dominant) == (150, "moderate", "PM10")
    assert aqi.sub_indices == {"PM2.5": 75, "PM10": 150, "NO2": 25, "CO": 25}


def test_needs_three_pollutants():
    assert estimate_aqi({"PM2.5": day(120), "NO2": day(40)}, AT) is None


def test_needs_a_particulate():
    assert estimate_aqi({"CO": day(1), "NO2": day(40), "SO2": day(12)}, AT) is None


def test_a_pollutant_without_enough_hours_does_not_count():
    series = {"PM2.5": day(45), "NO2": day(20), "SO2": day(10, hours=6)}

    assert estimate_aqi(series, AT) is None


def test_ties_go_to_the_first_listed_pollutant():
    aqi = estimate_aqi({"PM10": day(175), "PM2.5": day(75), "NO2": day(20)}, AT)

    assert (aqi.value, aqi.dominant) == (150, "PM2.5")
