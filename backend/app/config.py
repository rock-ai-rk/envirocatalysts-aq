from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # SQLite by default so the API runs with zero setup. The code also runs on PostgreSQL,
    # e.g. postgresql+psycopg://aq:aq@localhost:5433/aq
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'aq.db'}"

    # Open-Meteo's air-quality API: free for non-commercial use, no key. The free tier allows
    # 10,000 calls a day; even counting every city in a request as its own call, ~170 cities
    # hourly is ~4,100.
    openmeteo_url: str = "https://air-quality-api.open-meteo.com/v1/air-quality"
    # Cities per request; 50 pairs of coordinates keep the URL around 1.5 KB.
    openmeteo_batch_size: int = 50
    # Each run asks for yesterday and today, so a fresh database has the 24 hours the AQI needs
    # after one run, and a missed run is filled in by the next.
    openmeteo_past_days: int = 1

    scraper_enabled: bool = True
    # The model's hourly values are published ahead of time (it is a forecast), so a run a few
    # minutes past the hour already has the hour that just started.
    scrape_minute: int = 5
    scraper_request_delay_seconds: float = 1.0
    # Identifies this client to Open-Meteo. Add a contact (email or repo URL) in .env.
    scraper_user_agent: str = "envirocatalysts-aq-scraper/0.2 (air quality mobile app; hourly)"
    live_stale_after_hours: int = 3
    live_retention_days: int = 30

    admin_token: str = ""
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
