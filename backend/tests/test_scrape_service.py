from datetime import timedelta

from sqlalchemy import func, select

from app.db import utcnow
from app.models import LiveReading, ScrapeRun
from app.scraper.service import run_scrape
from tests.factories import FakeSource, add_city, last_hours, om_answer

RETENTION_DAYS = 30


def count(session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_reads_every_city_with_coordinates(session):
    agra = add_city(session, "Agra")
    delhi = add_city(session, "Delhi", "Delhi", 28.61, 77.21)
    add_city(session, "Dimapur", "Nagaland", latitude=None, longitude=None)
    source = FakeSource(om_answer(last_hours(3)))

    run = run_scrape(session, source, RETENTION_DAYS)

    assert run.status == "success"
    assert source.asked == [agra.id, delhi.id]  # Dimapur has no coordinates
    assert (run.cities_requested, run.cities_seen) == (2, 2)
    assert (run.records_seen, run.records_skipped, run.readings_inserted) == (36, 0, 36)
    assert count(session, LiveReading) == 2 * 6 * 3


def test_repeating_a_run_inserts_nothing_new(session):
    add_city(session)
    answer = om_answer(last_hours(3))
    run_scrape(session, FakeSource(answer), RETENTION_DAYS)

    second = run_scrape(session, FakeSource(answer), RETENTION_DAYS)

    assert (second.status, second.readings_inserted) == ("success", 0)
    assert count(session, LiveReading) == 18


def test_a_new_hour_adds_readings_and_keeps_the_stored_ones(session):
    add_city(session)
    run_scrape(session, FakeSource(om_answer(last_hours(2, ending_hours_ago=1))), RETENTION_DAYS)

    # The next run overlaps the first and revises the shared hour; only the new hour is added.
    run = run_scrape(session, FakeSource(om_answer(last_hours(2), pm2_5=99.0)), RETENTION_DAYS)

    assert run.readings_inserted == 6
    values = session.scalars(
        select(LiveReading.value)
        .where(LiveReading.pollutant == "PM2.5")
        .order_by(LiveReading.observed_at)
    ).all()
    assert values == [10.0, 10.0, 99.0]


def test_empty_hours_are_counted(session):
    add_city(session)
    answer = om_answer(last_hours(3), ozone=[None, None, 30.0])

    run = run_scrape(session, FakeSource(answer), RETENTION_DAYS)

    assert (run.records_seen, run.records_skipped, run.readings_inserted) == (18, 2, 16)


def test_a_malformed_answer_skips_that_city_only(session):
    agra = add_city(session, "Agra")
    add_city(session, "Delhi", "Delhi", 28.61, 77.21)
    broken = om_answer(last_hours(3))
    broken["hourly_units"]["pm10"] = "ppb"

    run = run_scrape(
        session, FakeSource(om_answer(last_hours(3)), answers={agra.id: broken}), RETENTION_DAYS
    )

    assert (run.status, run.cities_requested, run.cities_seen) == ("success", 2, 1)
    assert count(session, LiveReading) == 18


def test_readings_past_retention_are_purged(session):
    city = add_city(session)
    old = utcnow() - timedelta(days=RETENTION_DAYS + 1)
    session.add(LiveReading(city_id=city.id, pollutant="PM2.5", value=40, observed_at=old))
    session.commit()

    run = run_scrape(session, FakeSource(om_answer(last_hours(1))), RETENTION_DAYS)

    assert run.readings_purged == 1
    assert count(session, LiveReading) == 6


def test_readings_record_their_source_and_run(session):
    add_city(session)

    run = run_scrape(session, FakeSource(om_answer(last_hours(1))), RETENTION_DAYS)

    assert set(session.scalars(select(LiveReading.source))) == {"open_meteo_cams"}
    assert set(session.scalars(select(LiveReading.scrape_run_id))) == {run.id}


def test_without_cities_the_run_succeeds_with_nothing_to_do(session):
    source = FakeSource(om_answer(last_hours(1)))

    run = run_scrape(session, source, RETENTION_DAYS)

    assert (run.status, run.cities_requested, run.readings_inserted) == ("success", 0, 0)


def test_failure_is_recorded(session):
    add_city(session)

    run = run_scrape(session, FakeSource(error=RuntimeError("HTTP 500")), RETENTION_DAYS)

    assert (run.status, run.error) == ("failed", "RuntimeError: HTTP 500")
    assert run.finished_at is not None
    assert count(session, LiveReading) == 0


def test_skips_while_another_run_is_in_progress(session):
    session.add(ScrapeRun(source="test", status="running"))
    session.commit()

    assert run_scrape(session, FakeSource(), RETENTION_DAYS) is None


def test_a_crashed_run_stops_blocking_after_the_timeout(session):
    session.add(
        ScrapeRun(source="test", status="running", started_at=utcnow() - timedelta(hours=1))
    )
    session.commit()

    assert run_scrape(session, FakeSource(), RETENTION_DAYS).status == "success"
