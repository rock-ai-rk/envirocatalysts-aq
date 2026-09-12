"""Runs the scraper on an interval inside the API process."""

import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.models import ScrapeRun
from app.scraper.client import DataGovClient
from app.scraper.service import run_scrape

logger = logging.getLogger(__name__)


def scrape_once(settings: Settings | None = None) -> ScrapeRun | None:
    settings = settings or get_settings()
    with DataGovClient.from_settings(settings) as client, SessionLocal() as session:
        return run_scrape(session, client, settings.live_retention_days)


def start_scheduler(settings: Settings) -> BackgroundScheduler | None:
    if not settings.scraper_enabled:
        logger.info("Scraper schedule disabled (SCRAPER_ENABLED=false)")
        return None
    if not settings.datagov_api_key:
        logger.warning("DATAGOV_API_KEY is not set, so scheduled scraping is off")
        return None

    scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Kolkata"))
    scheduler.add_job(
        scrape_once,
        "interval",
        minutes=settings.scrape_interval_minutes,
        next_run_time=datetime.now(UTC),  # also run once at startup
        id="datagov-realtime",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scraper scheduled every %s minutes", settings.scrape_interval_minutes)
    return scheduler
