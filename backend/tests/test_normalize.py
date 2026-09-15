from datetime import UTC, datetime, timedelta

import pytest

from app.scraper.normalize import InvalidAnswer, parse_answer
from tests.factories import om_answer

NOW = datetime(2026, 9, 15, 17, 5, tzinfo=UTC)
HOURS = [NOW.replace(minute=0) + timedelta(hours=offset) for offset in (-2, -1, 0, 1, 2)]


def test_reads_every_pollutant_for_hours_up_to_now():
    readings, missing = parse_answer(om_answer(HOURS, pm2_5=55.2), NOW)

    # Three hours have passed (15:00, 16:00, 17:00); 18:00 and 19:00 are still forecasts.
    assert missing == 0
    assert len(readings) == 6 * 3
    pm25 = [r for r in readings if r.pollutant == "PM2.5"]
    assert [(r.observed_at.hour, r.value) for r in pm25] == [(15, 55.2), (16, 55.2), (17, 55.2)]
    assert pm25[0].observed_at.tzinfo is UTC


def test_carbon_monoxide_becomes_milligrams():
    readings, _ = parse_answer(om_answer(HOURS, carbon_monoxide=834.0), NOW)

    assert {r.value for r in readings if r.pollutant == "CO"} == {0.834}


def test_empty_hours_are_counted_not_stored():
    answer = om_answer(HOURS, ozone=[None, 40.0, None, 41.0, 42.0])

    readings, missing = parse_answer(answer, NOW)

    assert missing == 2
    assert [r.observed_at.hour for r in readings if r.pollutant == "O3"] == [16]


def test_a_new_unit_is_rejected_rather_than_misread():
    answer = om_answer(HOURS)
    answer["hourly_units"]["carbon_monoxide"] = "mg/m³"

    with pytest.raises(InvalidAnswer, match="carbon_monoxide is in 'mg/m³'"):
        parse_answer(answer, NOW)


def test_both_spellings_of_the_micro_sign_are_accepted():
    answer = om_answer(HOURS)
    answer["hourly_units"]["pm10"] = "µg/m³"  # U+00B5 rather than the API's U+03BC

    assert parse_answer(answer, NOW)[0]


@pytest.mark.parametrize(
    "broken",
    [
        lambda answer: answer.pop("hourly"),
        lambda answer: answer["hourly"].pop("pm10"),
        lambda answer: answer["hourly"]["pm10"].pop(),
        lambda answer: answer["hourly"]["time"].__setitem__(0, "yesterday"),
    ],
    ids=["no hourly block", "variable missing", "arrays differ in length", "bad time"],
)
def test_malformed_answers_are_rejected(broken):
    answer = om_answer(HOURS)
    broken(answer)

    with pytest.raises(InvalidAnswer):
        parse_answer(answer, NOW)
