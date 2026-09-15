"""record which screen's data each loaded dataset provides (overview, hourly or all)

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-15 15:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Batch mode so SQLite can add the CHECK constraint (it rebuilds the table).
    with op.batch_alter_table("datasets", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("scope", sa.String(length=10), nullable=False, server_default="all")
        )
        batch_op.create_check_constraint(
            op.f("ck_datasets_scope"), "scope IN ('all', 'overview', 'hourly')"
        )


def downgrade() -> None:
    with op.batch_alter_table("datasets", schema=None) as batch_op:
        batch_op.drop_constraint(op.f("ck_datasets_scope"), type_="check")
        batch_op.drop_column("scope")
