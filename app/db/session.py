from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base, Project

DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001"


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        if ":memory:" not in url:
            Path(url.split("///", 1)[1]).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(url, connect_args={"timeout": 30})

        @event.listens_for(engine, "connect")
        def _pragmas(connection, _record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        return engine
    return create_engine(url, pool_pre_ping=True)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def init_db(engine: Engine, factory: sessionmaker[Session]) -> None:
    """Create tables for local SQLite use; PostgreSQL deployments should run Alembic."""
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
    with factory() as session, session.begin():
        if session.get(Project, DEFAULT_PROJECT_ID) is None:
            session.add(Project(id=DEFAULT_PROJECT_ID, name="Default workspace",
                                description="Project used by the dev API-key compatibility mode.",
                                is_default=True))
