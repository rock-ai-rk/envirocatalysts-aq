"""Engine, sessions, and the small layer that lets the same code run on SQLite and PostgreSQL."""

from collections.abc import Iterable, Iterator
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import DateTime, MetaData, create_engine, event
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine import Dialect, Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_settings

# Stable constraint names, so Alembic migrations look the same on every database.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UTCDateTime(TypeDecorator):
    """Timezone-aware datetimes on every backend: stored as UTC, returned as aware UTC.

    PostgreSQL has timestamptz. SQLite has no timezone type and would otherwise hand back naive
    datetimes, which can't be compared with aware ones.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime passed to a UTCDateTime column")
        value = value.astimezone(UTC)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def utcnow() -> datetime:
    return datetime.now(UTC)


def check_in(column: str, values: Iterable[str]) -> str:
    """SQL for a CHECK constraint that limits `column` to `values`."""
    return f"{column} IN ({', '.join(f"'{value}'" for value in values)})"


def insert_for(session: Session, model):
    """An INSERT that supports ON CONFLICT (upserts) on both PostgreSQL and SQLite."""
    dialect = session.get_bind().dialect.name
    if dialect == "postgresql":
        return postgresql.insert(model)
    if dialect == "sqlite":
        return sqlite.insert(model)
    raise NotImplementedError(f"upserts are not implemented for {dialect}")


def _create_engine(url: str) -> Engine:
    parsed = make_url(url)
    if parsed.get_backend_name() != "sqlite":
        return create_engine(url, pool_pre_ping=True)

    if parsed.database and parsed.database != ":memory:":
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    # The scheduler writes from a background thread while API requests read from worker threads.
    sqlite_engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(sqlite_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:
        # WAL lets readers work while the scraper writes; SQLite leaves foreign keys off by default.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return sqlite_engine


engine = _create_engine(get_settings().database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
