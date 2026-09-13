from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, check_in, utcnow
from app.domain import LIVE_SOURCE, POLLUTANTS

# SQLite only auto-increments INTEGER PRIMARY KEY columns, so BIGINT ids become INTEGER there.
BigId = BigInteger().with_variant(Integer, "sqlite")

LINK_METHODS = ("name", "distance", "manual")


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
    """One pollutant at one station for one timestamp, as published by CPCB.

    The values are AQI sub-indices (0-500), not concentrations; see app/analytics/live.py.
    """

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
    source: Mapped[str] = mapped_column(String(50), default=LIVE_SOURCE, server_default=LIVE_SOURCE)
    scrape_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("scrape_runs.id", ondelete="SET NULL")
    )

    station: Mapped[LiveStation] = relationship(back_populates="readings")


class StationLink(Base):
    """Which live-feed station reports for a station in the historical data.

    The two sources name stations independently, so app/linking.py matches them by name and then
    by distance. The matcher never overwrites a manual link.
    """

    __tablename__ = "station_links"
    __table_args__ = (CheckConstraint(check_in("method", LINK_METHODS), name="method"),)

    station_id: Mapped[int] = mapped_column(
        ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True
    )
    live_station_id: Mapped[int] = mapped_column(ForeignKey("live_stations.id", ondelete="CASCADE"))
    method: Mapped[str] = mapped_column(String(10))
    distance_m: Mapped[float | None]
    linked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    live_station: Mapped[LiveStation] = relationship()


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
    stations_linked: Mapped[int] = mapped_column(default=0, server_default="0")
    # The feed's own "updated" time. When it hasn't moved since the last successful run, the run
    # stops after one small request and is marked unchanged.
    source_updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    unchanged: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    error: Mapped[str | None] = mapped_column(Text)
