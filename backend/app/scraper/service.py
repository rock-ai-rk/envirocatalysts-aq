"""One scrape: read the model at every city with coordinates, store the hours not stored yet, drop
readings past retention, and record the run."""

import logging
from collections.abc import Iterable, Iterator, Sequence
from datetime import timedelta
from typing import Protocol

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import insert_for, utcnow
from app.domain import LIVE_SOURCE
from app.models import City, LiveReading, ScrapeRun
from app.scraper.client import Place
from app.scraper.normalize import InvalidAnswer, parse_answer

logger = logging.getLogger(__name__)

# A run still marked "running" after this long is assumed to have crashed and stops blocking.
RUN_TIMEOUT = timedelta(minutes=10)
CHUNK_SIZE = 500


class PlaceSource(Protocol):
    def fetch(self, places: Sequence[Place]) -> Iterable[tuple[Place, dict]]: ...


def run_scrape(session: Session, source: PlaceSource, retention_days: int) -> ScrapeRun | None:
    """Run one scrape and return its audit row, or None if another run is in progress.

    The in-progress check isn't atomic, so two processes starting at the same moment could both
    run. That only costs extra API calls: readings are unique per (city, pollutant, hour), so the
    second run inserts nothing. A stored hour is never rewritten, even if a later model run
    revises it, so what the app showed can be traced back.
    """
    if _run_in_progress(session):
        logger.info("Skipping scrape: another run is in progress")
        return None

    run = ScrapeRun(source=LIVE_SOURCE)
    session.add(run)
    session.commit()

    try:
        places = _places(session)
        if not places:
            logger.warning("No cities with coordinates yet; load a dataset before scraping")
        run.cities_requested = len(places)
        now = utcnow()
        rows: list[dict] = []
        for place, answer in source.fetch(places):
            try:
                readings, missing = parse_answer(answer, now)
            except InvalidAnswer as exc:
                logger.warning("Skipping city %s: %s", place.city_id, exc)
                continue
            run.cities_seen += bool(readings)
            run.records_seen += len(readings) + missing
            run.records_skipped += missing
            rows.extend(
                {
                    "city_id": place.city_id,
                    "pollutant": r.pollutant,
                    "value": r.value,
                    "observed_at": r.observed_at,
                    "fetched_at": now,
                    "source": LIVE_SOURCE,
                    "scrape_run_id": run.id,
                }
                for r in readings
            )
        run.readings_inserted = _insert_readings(session, rows)
        run.readings_purged = _purge_old_readings(session, retention_days)
        run.status = "success"
    except Exception as exc:
        session.rollback()
        run.status = "failed"
        run.error = f"{type(exc).__name__}: {exc}"[:2000]
        logger.error("Scrape run %s failed: %s", run.id, run.error)

    run.finished_at = utcnow()
    session.commit()
    logger.info(
        "Scrape run %s %s in %.1fs: %s of %s cities, %s hourly values (%s empty), "
        "%s readings inserted, %s purged",
        run.id,
        run.status,
        (run.finished_at - run.started_at).total_seconds(),
        run.cities_seen,
        run.cities_requested,
        run.records_seen,
        run.records_skipped,
        run.readings_inserted,
        run.readings_purged,
    )
    return run


def _places(session: Session) -> list[Place]:
    """Every city with coordinates. Cities without them (not on the dashboard's map) are skipped."""
    rows = session.execute(
        select(City.id, City.latitude, City.longitude)
        .where(City.latitude.is_not(None), City.longitude.is_not(None))
        .order_by(City.id)
    )
    return [Place(city_id, latitude, longitude) for city_id, latitude, longitude in rows]


def _run_in_progress(session: Session) -> bool:
    recent_running = (
        select(ScrapeRun.id)
        .where(ScrapeRun.status == "running", ScrapeRun.started_at >= utcnow() - RUN_TIMEOUT)
        .limit(1)
    )
    return session.scalar(recent_running) is not None


def _insert_readings(session: Session, rows: list[dict]) -> int:
    """Insert readings not stored before; returns how many were new."""
    inserted = 0
    for chunk in _chunks(rows):
        stmt = (
            insert_for(session, LiveReading)
            .values(chunk)
            .on_conflict_do_nothing(index_elements=["city_id", "pollutant", "observed_at"])
            .returning(LiveReading.id)
        )
        inserted += len(session.execute(stmt).all())
    return inserted


def _purge_old_readings(session: Session, retention_days: int) -> int:
    cutoff = utcnow() - timedelta(days=retention_days)
    return session.execute(delete(LiveReading).where(LiveReading.observed_at < cutoff)).rowcount


def _chunks(items: list, size: int = CHUNK_SIZE) -> Iterator[list]:
    for start in range(0, len(items), size):
        yield items[start : start + size]
