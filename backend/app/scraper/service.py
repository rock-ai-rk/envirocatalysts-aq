"""One scrape: check the feed changed, fetch it, parse it, upsert stations, insert readings, link
stations to the historical data, and record the run."""

import logging
from collections.abc import Iterable, Iterator
from datetime import datetime, timedelta
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import insert_for, utcnow
from app.domain import LIVE_SOURCE
from app.linking import refresh_links
from app.models import LiveReading, LiveStation, ScrapeRun
from app.scraper.normalize import Reading, parse_records

logger = logging.getLogger(__name__)

# A run still marked "running" after this long is assumed to have crashed and stops blocking.
RUN_TIMEOUT = timedelta(minutes=10)
CHUNK_SIZE = 500


class RecordSource(Protocol):
    def updated_at(self) -> datetime | None: ...

    def fetch_all(self) -> Iterable[dict]: ...

    def redact(self, text: str) -> str: ...


def run_scrape(
    session: Session, source: RecordSource, retention_days: int, force: bool = False
) -> ScrapeRun | None:
    """Run one scrape and return its audit row, or None if another run is in progress.

    If the feed's update time matches the last successful run's, nothing more is fetched and the
    run is marked unchanged; `force` fetches anyway.

    The in-progress check isn't atomic, so two processes starting at the same moment could both
    run. That only costs an extra API call: readings are unique per (station, pollutant,
    timestamp), so the second run inserts nothing.
    """
    if _run_in_progress(session):
        logger.info("Skipping scrape: another run is in progress")
        return None

    run = ScrapeRun(source=LIVE_SOURCE)
    session.add(run)
    session.commit()

    try:
        run.source_updated_at = source.updated_at()
        if not force and run.source_updated_at is not None:
            run.unchanged = run.source_updated_at == _last_source_update(session)
        if not run.unchanged:
            records = list(source.fetch_all())
            readings, skipped = parse_records(records)
            station_ids = _upsert_stations(session, readings)
            run.records_seen = len(records)
            run.records_skipped = skipped
            run.stations_seen = len(station_ids)
            run.readings_inserted = _insert_readings(session, readings, station_ids, run.id)
            run.stations_linked = refresh_links(session).linked
        run.readings_purged = _purge_old_readings(session, retention_days)
        run.status = "success"
    except Exception as exc:
        session.rollback()
        run.status = "failed"
        # The API key travels in the query string, so scrub it before it reaches the DB or logs.
        run.error = source.redact(f"{type(exc).__name__}: {exc}")[:2000]
        logger.error("Scrape run %s failed: %s", run.id, run.error)

    run.finished_at = utcnow()
    session.commit()
    _log_run(run)
    return run


def _log_run(run: ScrapeRun) -> None:
    seconds = (run.finished_at - run.started_at).total_seconds()
    if run.unchanged:
        logger.info(
            "Scrape run %s unchanged in %.1fs: feed last updated %s, nothing fetched",
            run.id,
            seconds,
            run.source_updated_at.isoformat(),
        )
        return
    logger.info(
        "Scrape run %s %s in %.1fs: %s records fetched, %s skipped, %s stations, "
        "%s readings inserted, %s purged, %s stations linked",
        run.id,
        run.status,
        seconds,
        run.records_seen,
        run.records_skipped,
        run.stations_seen,
        run.readings_inserted,
        run.readings_purged,
        run.stations_linked,
    )


def _last_source_update(session: Session) -> datetime | None:
    return session.scalar(
        select(ScrapeRun.source_updated_at)
        .where(ScrapeRun.status == "success", ScrapeRun.source_updated_at.is_not(None))
        .order_by(ScrapeRun.id.desc())
        .limit(1)
    )


def _run_in_progress(session: Session) -> bool:
    recent_running = (
        select(ScrapeRun.id)
        .where(ScrapeRun.status == "running", ScrapeRun.started_at >= utcnow() - RUN_TIMEOUT)
        .limit(1)
    )
    return session.scalar(recent_running) is not None


def _upsert_stations(session: Session, readings: list[Reading]) -> dict[str, int]:
    """Insert new stations, refresh known ones, and return {station name: id}."""
    by_name = {reading.station: reading for reading in readings}
    now = utcnow()
    ids: dict[str, int] = {}
    for chunk in _chunks(list(by_name.values())):
        stmt = insert_for(session, LiveStation).values(
            [
                {
                    "name": r.station,
                    "city": r.city,
                    "state": r.state,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "first_seen_at": now,
                    "last_seen_at": now,
                }
                for r in chunk
            ]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["name"],
            set_={
                "city": stmt.excluded.city,
                "state": stmt.excluded.state,
                "latitude": func.coalesce(stmt.excluded.latitude, LiveStation.latitude),
                "longitude": func.coalesce(stmt.excluded.longitude, LiveStation.longitude),
                "last_seen_at": stmt.excluded.last_seen_at,
            },
        ).returning(LiveStation.id, LiveStation.name)
        ids.update({name: station_id for station_id, name in session.execute(stmt)})
    return ids


def _insert_readings(
    session: Session, readings: list[Reading], station_ids: dict[str, int], run_id: int
) -> int:
    """Insert readings not seen before; returns how many were new."""
    now = utcnow()
    rows = [
        {
            "station_id": station_ids[r.station],
            "pollutant": r.pollutant,
            "avg_value": r.avg_value,
            "min_value": r.min_value,
            "max_value": r.max_value,
            "observed_at": r.observed_at,
            "fetched_at": now,
            "source": LIVE_SOURCE,
            "scrape_run_id": run_id,
        }
        for r in readings
    ]
    inserted = 0
    for chunk in _chunks(rows):
        stmt = (
            insert_for(session, LiveReading)
            .values(chunk)
            .on_conflict_do_nothing(index_elements=["station_id", "pollutant", "observed_at"])
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
