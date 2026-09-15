"""Operator endpoints, protected by the ADMIN_TOKEN shared secret."""

import secrets
from collections.abc import Iterator

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models import ScrapeRun
from app.schemas import ScrapeRunOut
from app.scraper.client import OpenMeteoClient
from app.scraper.service import PlaceSource, run_scrape

router = APIRouter(prefix="/v1/admin", tags=["admin"])


def require_admin(
    x_admin_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = settings.admin_token.encode()
    given = (x_admin_token or "").encode()
    if not expected or not secrets.compare_digest(given, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid X-Admin-Token")


def get_place_source(settings: Settings = Depends(get_settings)) -> Iterator[PlaceSource]:
    with OpenMeteoClient.from_settings(settings) as client:
        yield client


@router.post("/scrape", response_model=ScrapeRunOut, dependencies=[Depends(require_admin)])
def trigger_scrape(
    source: PlaceSource = Depends(get_place_source),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ScrapeRun:
    """Run the scraper now instead of waiting for the schedule."""
    run = run_scrape(session, source, settings.live_retention_days)
    if run is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A scrape is already running")
    return run
