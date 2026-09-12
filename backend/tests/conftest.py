import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

# Configure before the app is imported: tests get their own database and never start the
# scheduler. Set TEST_DATABASE_URL to run the suite against PostgreSQL instead of SQLite.
_tmp_dir = Path(tempfile.mkdtemp(prefix="aq-tests-"))
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", f"sqlite:///{_tmp_dir / 'test.db'}"
)
os.environ["SCRAPER_ENABLED"] = "false"
os.environ["ADMIN_TOKEN"] = "test-admin-token"
os.environ["DATAGOV_API_KEY"] = ""

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from alembic import command
from app.config import BACKEND_DIR
from app.db import Base, SessionLocal, engine
from app.main import create_app


@pytest.fixture(scope="session")
def migrated_db() -> None:
    """Start from an empty database and apply the real migrations, so they're tested too."""
    url = make_url(os.environ["DATABASE_URL"])
    if url.get_backend_name() != "sqlite" and not (url.database or "").endswith("_test"):
        pytest.exit(f"Refusing to reset {url.database!r}: test databases must end in _test")

    with engine.begin() as conn:
        Base.metadata.drop_all(conn)
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


@pytest.fixture
def session(migrated_db) -> Iterator[Session]:
    with SessionLocal() as db_session:
        yield db_session
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def api(session) -> Iterator[TestClient]:
    with TestClient(create_app()) as client:
        yield client
