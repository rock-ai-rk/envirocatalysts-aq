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

    datagov_api_key: str = ""
    datagov_resource_id: str = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
    datagov_base_url: str = "https://api.data.gov.in/resource"
    datagov_page_size: int = 1000

    scraper_enabled: bool = True
    scrape_interval_minutes: int = 60
    live_stale_after_hours: int = 3
    live_retention_days: int = 30

    admin_token: str = ""
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
