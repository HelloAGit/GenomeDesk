import os
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.db.models import Base

ROOT = Path(__file__).parents[1]


def alembic_config(url: str) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def urls(tmp_path):
    yield f"sqlite:///{tmp_path}/migrate.sqlite3"
    if os.environ.get("TEST_DATABASE_URL"):
        yield os.environ["TEST_DATABASE_URL"]


@pytest.mark.parametrize("backend", ["sqlite", "external"])
def test_upgrade_matches_models_and_downgrade_is_reversible(tmp_path, backend):
    candidates = list(urls(tmp_path))
    if backend == "external":
        if len(candidates) < 2:
            pytest.skip("TEST_DATABASE_URL (PostgreSQL) not set")
        url = candidates[1]
    else:
        url = candidates[0]
    config = alembic_config(url)
    command.upgrade(config, "head")
    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "projects", "project_memberships", "samples", "variants", "analysis_jobs",
            "research_reports", "annotations", "audit_events"} <= tables
    indexes = {i["name"] for i in inspect(engine).get_indexes("variants")}
    assert "ix_variants_sample_chrom_pos" in indexes
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    command.downgrade(config, "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
    engine.dispose()
