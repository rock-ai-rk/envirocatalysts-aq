"""Runs the scraper on an interval inside the API process."""

import logging
from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.domain import IST
from app.models import ScrapeRun
from app.scraper.client import DataGovClient
from app.scraper.service import run_scrape

logger = logging.getLogger(__name__)


def scrape_once(settings: Settings | None = None, force: bool = False) -> ScrapeRun | None:
    settings = settings or get_settings()
    with DataGovClient.from_settings(settings) as client, SessionLocal() as session:
        return run_scrape(session, client, settings.live_retention_days, force=force)


def start_scheduler(settings: Settings) -> BackgroundScheduler | None:
    if not settings.scraper_enabled:
        logger.info("Scraper schedule disabled (SCRAPER_ENABLED=false)")
        return None
    if not settings.datagov_api_key:
        logger.warning("DATAGOV_API_KEY is not set, so scheduled scraping is off")
        return None

    scheduler = BackgroundScheduler(timezone=IST)
    scheduler.add_job(
        scrape_once,
        CronTrigger(minute=settings.scrape_minute, timezone=IST),
        next_run_time=datetime.now(UTC),  # also run once at startup
        id="datagov-realtime",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scraper scheduled hourly at :%02d IST", settings.scrape_minute)
    return scheduler
