import logging

from sqlalchemy.orm import Session

from app.db.models import AuditEvent

logger = logging.getLogger("genomedesk.audit")


def record(session: Session, actor: str, action: str, project_id: str | None = None,
           target_type: str = "", target_id: str = "", outcome: str = "success",
           detail: dict | None = None) -> None:
    """Append an audit event. Never pass genomic content, tokens or file contents in detail."""
    session.add(AuditEvent(actor=actor, project_id=project_id, action=action,
                           target_type=target_type, target_id=target_id,
                           outcome=outcome, detail=detail or {}))
    logger.info("audit action=%s outcome=%s project=%s target=%s/%s",
                action, outcome, project_id, target_type, target_id)
