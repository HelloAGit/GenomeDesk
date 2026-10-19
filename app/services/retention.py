"""Configured retention purge: python -m app.services.retention"""
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent, Sample
from app.services import audit
from app.services import samples as svc


def purge_expired(session: Session, sample_days: int, audit_days: int) -> dict:
    now = datetime.now(UTC)
    deleted_samples = deleted_events = 0
    if sample_days > 0:
        for sample in session.scalars(select(Sample).where(Sample.created_at < now - timedelta(days=sample_days))).all():
            svc.delete_sample(session, sample)
            deleted_samples += 1
    if audit_days > 0:
        deleted_events = session.execute(delete(AuditEvent).where(
            AuditEvent.created_at < now - timedelta(days=audit_days))).rowcount
    audit.record(session, "retention-job", "retention.purge",
                 detail={"samples_deleted": deleted_samples, "audit_events_deleted": deleted_events})
    session.commit()
    return {"samples_deleted": deleted_samples, "audit_events_deleted": deleted_events}


def main() -> None:  # pragma: no cover
    from app.config import Settings
    from app.db.session import init_db, make_engine, make_session_factory
    settings = Settings()
    engine = make_engine(settings.resolved_database_url())
    factory = make_session_factory(engine)
    init_db(engine, factory)
    with factory() as session:
        print(purge_expired(session, settings.sample_retention_days, settings.audit_retention_days))


if __name__ == "__main__":  # pragma: no cover
    main()
