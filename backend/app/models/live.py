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
from app.domain import POLLUTANTS

# SQLite only auto-increments INTEGER PRIMARY KEY columns, so BIGINT ids become INTEGER there.
BigId = BigInteger().with_variant(Integer, "sqlite")


class LiveStation(Base):
    """A monitoring station, named the way the CPCB real-time feed names it."""

    __tablename__ = "live_stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    first_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    readings: Mapped[list["LiveReading"]] = relationship(back_populates="station")


class LiveReading(Base):
    """One pollutant value at one station for one timestamp, as published by CPCB."""

    __tablename__ = "live_readings"
    __table_args__ = (
        UniqueConstraint("station_id", "pollutant", "observed_at"),
        CheckConstraint(check_in("pollutant", POLLUTANTS), name="pollutant"),
        Index("ix_live_readings_observed_at", "observed_at"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("live_stations.id", ondelete="CASCADE"))
    pollutant: Mapped[str] = mapped_column(String(8))
    avg_value: Mapped[float | None]
    min_value: Mapped[float | None]
    max_value: Mapped[float | None]
    observed_at: Mapped[datetime] = mapped_column(UTCDateTime)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    scrape_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("scrape_runs.id", ondelete="SET NULL")
    )

    station: Mapped[LiveStation] = relationship(back_populates="readings")


class ScrapeRun(Base):
    """Audit row for every scraper execution: scheduled, CLI or admin-triggered."""

    __tablename__ = "scrape_runs"
    __table_args__ = (CheckConstraint("status IN ('running', 'success', 'failed')", name="status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(10), default="running")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    records_seen: Mapped[int] = mapped_column(default=0)
    records_skipped: Mapped[int] = mapped_column(default=0)
    stations_seen: Mapped[int] = mapped_column(default=0)
    readings_inserted: Mapped[int] = mapped_column(default=0)
    readings_purged: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text)
