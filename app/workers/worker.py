"""Isolated job worker: python -m app.workers.worker. Never runs inside HTTP handlers."""
import logging
import time

from app.config import Settings
from app.db.session import init_db, make_engine, make_session_factory
from app.services import jobs

logger = logging.getLogger("genomedesk.worker")


def run_once(factory) -> int:
    done = 0
    while True:
        with factory() as session:
            job = jobs.claim_next(session)
            if job is None:
                return done
            jobs.execute(session, job)
            done += 1


def main() -> None:  # pragma: no cover - long-running loop
    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    engine = make_engine(settings.resolved_database_url())
    factory = make_session_factory(engine)
    init_db(engine, factory)
    logger.info("worker started")
    while True:
        if not run_once(factory):
            time.sleep(2)


if __name__ == "__main__":  # pragma: no cover
    main()
