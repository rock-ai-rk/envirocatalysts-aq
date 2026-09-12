from datetime import date, datetime, timedelta

import pytest

from app.analytics.hourly import (
    IST,
    daily_means,
    hour_profile,
    monthly_stats,
    period_window,
    summarize,
)
from app.domain import Limits


def at(day: date, hour: int) -> datetime:
    """Hour-ending timestamp in IST; hour 24 is midnight at the end of `day`."""
    return datetime(day.year, day.month, day.day, tzinfo=IST) + timedelta(hours=hour)


DAY = date(2024, 12, 1)


def test_midnight_reading_is_the_last_hour_of_the_previous_day():
    readings = [(at(DAY, 1), 10.0), (at(DAY, 24), 30.0)]  # 01:00 and the next day's 00:00

    days = daily_means(readings)
    profile = hour_profile(readings)

    assert [(d.day, d.mean, d.hours) for d in days] == [(DAY, 20.0, 2)]
    assert (profile[0].label, profile[0].mean) == ("01:00", 10.0)
    assert (profile[23].label, profile[23].mean) == ("00:00", 30.0)
    assert profile[5].mean is None and profile[5].samples == 0


def test_daily_mean_needs_16_hours_to_count():
    readings = [(at(DAY, h), 50.0) for h in range(1, 16)] + [
        (at(DAY + timedelta(1), h), 60.0) for h in range(1, 17)
    ]

    first, second = daily_means(readings)

    assert (first.hours, first.valid) == (15, False)
    assert (second.hours, second.valid) == (16, True)


def test_kpis_and_peak_day():
    readings = [(at(DAY, h), 10.0) for h in range(1, 25)]
    readings += [(at(DAY + timedelta(1), h), 100.0 if h == 9 else 20.0) for h in range(1, 25)]

    summary = summarize(readings, DAY, DAY + timedelta(1), Limits(naaqs=60, who=15))

    kpis = summary.kpis
    assert (kpis.hours_with_data, kpis.expected_hours, kpis.coverage) == (48, 48, 1.0)
    assert kpis.mean == pytest.approx((24 * 10 + 23 * 20 + 100) / 48, abs=0.05)
    assert (kpis.peak, kpis.peak_at) == (100.0, at(DAY + timedelta(1), 9))
    assert kpis.above_naaqs_pct == round(100 / 48, 1)
    assert kpis.above_who_pct == 50.0
    assert summary.peak_day == DAY + timedelta(1)


def test_empty_period():
    summary = summarize([], DAY, DAY, Limits(naaqs=60, who=15))

    assert summary.kpis.mean is None
    assert summary.kpis.above_naaqs_pct is None
    assert summary.peak_day is None
    assert len(summary.hours) == 24


def test_monthly_distribution():
    readings = [(at(DAY, 1) + timedelta(hours=i), float(i)) for i in range(101)]  # values 0..100

    [month] = monthly_stats(readings)

    assert month.month == date(2024, 12, 1)
    assert (month.samples, month.median, month.p10, month.p90, month.max) == (
        101,
        50.0,
        10.0,
        90.0,
        100.0,
    )


def test_period_window_covers_whole_ist_days():
    after, until = period_window(date(2024, 4, 1), date(2025, 3, 31))

    assert after == datetime(2024, 4, 1, tzinfo=IST)
    assert until == datetime(2025, 4, 1, tzinfo=IST)
