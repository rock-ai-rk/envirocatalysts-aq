from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, check_in, utcnow
from app.domain import LIVE_SOURCE, POLLUTANTS
from app.models.history import City

# SQLite only auto-increments INTEGER PRIMARY KEY columns, so BIGINT ids become INTEGER there.
BigId = BigInteger().with_variant(Integer, "sqlite")


class LiveReading(Base):
    """One pollutant's concentration in one city for one hour, from the CAMS model via Open-Meteo.

    The model is read at the city's coordinates on a grid of roughly 45 km squares, so a value
    describes the area around the city, not any one monitoring station. Units match the historical
    data: µg/m³, and mg/m³ for CO. `observed_at` is the hour the model value is for.

    Readings belong to a city, so loading a new Overview dataset (which replaces the cities)
    deletes them; the next scrape fetches the last day again.
    """

    __tablename__ = "live_readings"
    __table_args__ = (
        UniqueConstraint("city_id", "pollutant", "observed_at"),
        CheckConstraint(check_in("pollutant", POLLUTANTS), name="pollutant"),
        Index("ix_live_readings_observed_at", "observed_at"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id", ondelete="CASCADE"))
    pollutant: Mapped[str] = mapped_column(String(8))
    value: Mapped[float]
    observed_at: Mapped[datetime] = mapped_column(UTCDateTime)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    source: Mapped[str] = mapped_column(String(50), default=LIVE_SOURCE, server_default=LIVE_SOURCE)
    scrape_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("scrape_runs.id", ondelete="SET NULL")
    )

    city: Mapped[City] = relationship()


class ScrapeRun(Base):
    """Audit row for every scraper execution: scheduled, CLI or admin-triggered."""

    __tablename__ = "scrape_runs"
    __table_args__ = (CheckConstraint("status IN ('running', 'success', 'failed')", name="status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(10), default="running")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    cities_requested: Mapped[int] = mapped_column(default=0)  # cities with coordinates
    cities_seen: Mapped[int] = mapped_column(default=0)  # cities the API returned values for
    records_seen: Mapped[int] = mapped_column(default=0)  # hourly values up to now, all cities
    records_skipped: Mapped[int] = mapped_column(default=0)  # of those, hours with no value
    readings_inserted: Mapped[int] = mapped_column(default=0)
    readings_purged: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text)
