"""Provider abstraction for versioned annotation records.

ClinVar is intentionally NOT registered: it requires reliable variant normalisation
(left-alignment/trimming) and assembly-aware matching, which are not implemented.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Annotation


@dataclass(frozen=True)
class AnnotationRecord:
    source: str
    source_version: str
    record_id: str
    retrieved_at: datetime
    assembly: str
    chromosome: str
    position: int
    reference: str
    alternate: str
    payload: dict


class AnnotationProvider(Protocol):
    name: str

    def lookup(self, session: Session, sample_id: str, limit: int) -> list[AnnotationRecord]: ...


class StoredAnnotationProvider:
    """Reads annotation rows previously stored for a sample, with source and version."""
    name = "stored"

    def lookup(self, session: Session, sample_id: str, limit: int = 20) -> list[AnnotationRecord]:
        rows = session.scalars(select(Annotation).where(Annotation.sample_id == sample_id)
                               .order_by(Annotation.id).limit(limit))
        return [AnnotationRecord(r.source, r.source_version, r.record_id, r.retrieved_at,
                                 r.assembly, r.chromosome, r.position, r.reference,
                                 r.alternate, r.payload) for r in rows]


PROVIDERS: dict[str, AnnotationProvider] = {"stored": StoredAnnotationProvider()}
UNSUPPORTED_PROVIDERS = {"clinvar": "Requires variant normalisation and assembly-aware matching (not implemented)."}
