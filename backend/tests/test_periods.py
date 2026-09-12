from datetime import date

import pytest

from app.periods import parse_period


def test_financial_year_runs_april_to_march():
    period = parse_period("FY2024-25")

    assert (period.frequency, period.label) == ("FY", "FY 2024-25")
    assert (period.start_date, period.end_date) == (date(2024, 4, 1), date(2025, 3, 31))
    assert period.days == 365


def test_financial_year_with_a_leap_day():
    assert parse_period("FY2023-24").days == 366


def test_calendar_year_and_month():
    assert parse_period("CY2025").end_date == date(2025, 12, 31)
    month = parse_period("2024-02")
    assert (month.label, month.days) == ("Feb 2024", 29)


@pytest.mark.parametrize("key", ["FY2024-26", "2024-13", "FY24-25", "2024"])
def test_rejects_malformed_keys(key):
    with pytest.raises(ValueError):
        parse_period(key)
