from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.db import utcnow
from app.models import LiveReading, LiveStation, ScrapeRun
from app.scraper.service import run_scrape
from tests.factories import FakeSource, make_record

RETENTION_DAYS = 30


def feed() -> list[dict]:
    return [
        make_record(pollutant="PM2.5"),
        make_record(pollutant="PM10", avg="210"),
        make_record(station="Bawana, Delhi - DPCC", pollutant="PM2.5", avg="95"),
        make_record(pollutant="BENZENE"),  # not a pollutant we track
    ]


def count(session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_first_run_stores_stations_and_readings(session):
    run = run_scrape(session, FakeSource(feed()), RETENTION_DAYS)

    assert run.status == "success"
    assert (run.records_seen, run.records_skipped, run.stations_seen, run.readings_inserted) == (
        4,
        1,
        2,
        3,
    )
    assert count(session, LiveStation) == 2
    assert count(session, LiveReading) == 3


def test_repeating_a_run_inserts_nothing_new(session):
    run_scrape(session, FakeSource(feed()), RETENTION_DAYS)
    second = run_scrape(session, FakeSource(feed()), RETENTION_DAYS)

    assert second.status == "success"
    assert second.readings_inserted == 0
    assert count(session, LiveStation) == 2
    assert count(session, LiveReading) == 3


def test_new_hour_adds_readings_and_refreshes_the_station(session):
    run_scrape(session, FakeSource([make_record(hours_ago=1)]), RETENTION_DAYS)
    run_scrape(session, FakeSource([make_record(hours_ago=0, latitude="28.7")]), RETENTION_DAYS)

    assert count(session, LiveReading) == 2
    assert session.scalars(select(LiveStation)).one().latitude == pytest.approx(28.7)


def test_readings_past_retention_are_purged(session):
    records = [make_record(hours_ago=24 * 40), make_record(pollutant="PM10")]

    run = run_scrape(session, FakeSource(records), RETENTION_DAYS)

    assert run.readings_purged == 1
    assert count(session, LiveReading) == 1


def test_failure_is_recorded_with_the_key_redacted(session):
    run = run_scrape(session, FakeSource(error=RuntimeError("boom for secret-key")), RETENTION_DAYS)

    assert run.status == "failed"
    assert run.error == "RuntimeError: boom for ***"
    assert run.finished_at is not None
    assert count(session, LiveReading) == 0


def test_skips_while_another_run_is_in_progress(session):
    session.add(ScrapeRun(source="test", status="running"))
    session.commit()

    assert run_scrape(session, FakeSource(feed()), RETENTION_DAYS) is None


def test_a_crashed_run_stops_blocking_after_the_timeout(session):
    session.add(ScrapeRun(source="test", status="running", started_at=utcnow() - timedelta(hours=1)))
    session.commit()

    assert run_scrape(session, FakeSource(feed()), RETENTION_DAYS).status == "success"
