"""One-time import of v0.1 single-table JSON documents into the normalised schema."""
import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Sample
from app.db.session import DEFAULT_PROJECT_ID
from app.services import samples as svc

logger = logging.getLogger("genomedesk.legacy")


def import_legacy_store(session: Session, data_dir: str) -> int:
    path = Path(data_dir) / "genomedesk.sqlite3"
    if not path.exists() or session.scalar(select(func.count()).select_from(Sample)):
        return 0
    try:
        with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as db:
            rows = db.execute("SELECT document FROM samples ORDER BY rowid").fetchall()
    except sqlite3.Error:
        return 0
    count = 0
    for (document,) in rows:
        doc = json.loads(document)
        svc.create_sample(session, DEFAULT_PROJECT_ID, doc["name"], doc["assembly"], doc["sha256"],
                                   doc["size_bytes"], "vcf", doc.get("declared_reference"), doc["records"], None,
                                   sample_id=doc["id"], created_at=datetime.fromisoformat(doc["created_at"]))
        count += 1
    session.commit()
    logger.info("imported %d legacy samples", count)
    return count
