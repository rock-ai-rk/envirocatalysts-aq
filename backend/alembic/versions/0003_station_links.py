"""link historical stations to live-feed stations; record feed freshness on scrape runs

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-13 12:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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
    with op.batch_alter_table("live_readings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "source",
                sa.String(length=50),
                server_default="datagov_cpcb_realtime",
                nullable=False,
            )
        )
    with op.batch_alter_table("scrape_runs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("stations_linked", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(
            sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("unchanged", sa.Boolean(), server_default=sa.false(), nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("scrape_runs", schema=None) as batch_op:
        batch_op.drop_column("unchanged")
        batch_op.drop_column("source_updated_at")
        batch_op.drop_column("stations_linked")
    with op.batch_alter_table("live_readings", schema=None) as batch_op:
        batch_op.drop_column("source")
    op.drop_table("station_links")
