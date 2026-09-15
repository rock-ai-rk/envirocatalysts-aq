"""live feed from Open-Meteo (CAMS model) per city, replacing CPCB stations on data.gov.in

The data.gov.in feed needs an API key, which needs a government sign-up with a phone number. The
live tables are rebuilt around cities: live_stations and station_links go, and live_readings and
scrape_runs get new columns. Scraped data can be fetched again, so nothing is carried over.

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-15 23:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

POLLUTANT_CHECK = "pollutant IN ('PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3', 'NH3')"
STATUS_CHECK = "status IN ('running', 'success', 'failed')"


def upgrade() -> None:
    _drop_live_tables(("station_links", "live_readings", "live_stations", "scrape_runs"))
    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cities_requested", sa.Integer(), nullable=False),
        sa.Column("cities_seen", sa.Integer(), nullable=False),
        sa.Column("records_seen", sa.Integer(), nullable=False),
        sa.Column("records_skipped", sa.Integer(), nullable=False),
        sa.Column("readings_inserted", sa.Integer(), nullable=False),
        sa.Column("readings_purged", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint(STATUS_CHECK, name=op.f("ck_scrape_runs_status")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scrape_runs")),
    )
    op.create_table(
        "live_readings",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=False),
        sa.Column("city_id", sa.Integer(), nullable=False),
        sa.Column("pollutant", sa.String(length=8), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=50), server_default="open_meteo_cams", nullable=False),
        sa.Column("scrape_run_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(POLLUTANT_CHECK, name=op.f("ck_live_readings_pollutant")),
        sa.ForeignKeyConstraint(
            ["city_id"],
            ["cities.id"],
            name=op.f("fk_live_readings_city_id_cities"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["scrape_run_id"],
            ["scrape_runs.id"],
            name=op.f("fk_live_readings_scrape_run_id_scrape_runs"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_live_readings")),
        sa.UniqueConstraint(
            "city_id", "pollutant", "observed_at", name=op.f("uq_live_readings_city_id")
        ),
    )
    op.create_index("ix_live_readings_observed_at", "live_readings", ["observed_at"])


def downgrade() -> None:
    """Back to the station tables of revisions 0001 and 0003, empty."""
    _drop_live_tables(("live_readings", "scrape_runs"))
    op.create_table(
        "live_stations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_live_stations")),
        sa.UniqueConstraint("name", name=op.f("uq_live_stations_name")),
    )
    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_seen", sa.Integer(), nullable=False),
        sa.Column("records_skipped", sa.Integer(), nullable=False),
        sa.Column("stations_seen", sa.Integer(), nullable=False),
        sa.Column("readings_inserted", sa.Integer(), nullable=False),
        sa.Column("readings_purged", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("stations_linked", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unchanged", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.CheckConstraint(STATUS_CHECK, name=op.f("ck_scrape_runs_status")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scrape_runs")),
    )
    op.create_table(
        "live_readings",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("pollutant", sa.String(length=8), nullable=False),
        sa.Column("avg_value", sa.Float(), nullable=True),
        sa.Column("min_value", sa.Float(), nullable=True),
        sa.Column("max_value", sa.Float(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scrape_run_id", sa.Integer(), nullable=True),
        sa.Column(
            "source", sa.String(length=50), server_default="datagov_cpcb_realtime", nullable=False
        ),
        sa.CheckConstraint(POLLUTANT_CHECK, name=op.f("ck_live_readings_pollutant")),
        sa.ForeignKeyConstraint(
            ["scrape_run_id"],
            ["scrape_runs.id"],
            name=op.f("fk_live_readings_scrape_run_id_scrape_runs"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["station_id"],
            ["live_stations.id"],
            name=op.f("fk_live_readings_station_id_live_stations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_live_readings")),
        sa.UniqueConstraint(
            "station_id", "pollutant", "observed_at", name=op.f("uq_live_readings_station_id")
        ),
    )
    op.create_index("ix_live_readings_observed_at", "live_readings", ["observed_at"])
    op.create_table(
        "station_links",
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("live_station_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "method IN ('name', 'distance', 'manual')", name=op.f("ck_station_links_method")
        ),
        sa.ForeignKeyConstraint(
            ["live_station_id"],
            ["live_stations.id"],
            name=op.f("fk_station_links_live_station_id_live_stations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["station_id"],
            ["stations.id"],
            name=op.f("fk_station_links_station_id_stations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("station_id", name=op.f("pk_station_links")),
    )


def _drop_live_tables(tables: tuple[str, ...]) -> None:
    """Drop tables that reference each other, children first."""
    if "live_readings" in tables:
        op.drop_index("ix_live_readings_observed_at", table_name="live_readings")
    for table in tables:
        op.drop_table(table)
