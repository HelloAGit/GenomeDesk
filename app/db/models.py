"""Normalised SQLAlchemy models. Variants are rows, never serialised documents."""
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

ROLES = ("owner", "editor", "viewer")
JOB_STATES = ("planned", "queued", "running", "completed", "failed")


def _now() -> datetime:
    return datetime.now(UTC)


def _id() -> str:
    return str(uuid4())


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on every backend (SQLite drops tzinfo)."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))


class Sample(Base):
    __tablename__ = "samples"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    assembly: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now, index=True)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    source_format: Mapped[str] = mapped_column(String(10), default="vcf")
    declared_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference_verification: Mapped[str] = mapped_column(String(40))
    summary: Mapped[dict] = mapped_column(JSON)  # aggregate QC only
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    variants = relationship("Variant", cascade="all, delete-orphan", passive_deletes=True)


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (
        Index("ix_variants_sample_chrom_pos", "sample_id", "chromosome", "position"),
        Index("ix_variants_sample_ordinal", "sample_id", "ordinal"),
        Index("ix_variants_sample_pass", "sample_id", "is_pass"),
        Index("ix_variants_sample_quality", "sample_id", "quality"),
        Index("ix_variants_chromosome_position", "chromosome", "position"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id", ondelete="CASCADE"))
    ordinal: Mapped[int] = mapped_column(Integer)
    chromosome: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(Text)
    alternates: Mapped[list] = mapped_column(JSON)
    alt_key: Mapped[str] = mapped_column(Text)  # ",A,G," for allele matching
    quality: Mapped[float | None] = mapped_column(Float, nullable=True)
    filters: Mapped[list] = mapped_column(JSON)
    is_pass: Mapped[bool] = mapped_column(Boolean, default=False)
    site_depth: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    sample_id: Mapped[str | None] = mapped_column(ForeignKey("samples.id", ondelete="CASCADE"), nullable=True)
    job_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(12), index=True)
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class ResearchReport(Base):
    __tablename__ = "research_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    sample_id: Mapped[str | None] = mapped_column(ForeignKey("samples.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (Index("ix_annotations_locus", "sample_id", "chromosome", "position"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id", ondelete="CASCADE"), index=True)
    chromosome: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(Text)
    alternate: Mapped[str] = mapped_column(Text)
    assembly: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(100))
    source_version: Mapped[str] = mapped_column(String(100))
    record_id: Mapped[str] = mapped_column(String(200))
    retrieved_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now, index=True)
    actor: Mapped[str] = mapped_column(String(100))  # user id or "dev-api-key"
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60))
    target_type: Mapped[str] = mapped_column(String(30), default="")
    target_id: Mapped[str] = mapped_column(String(64), default="")
    outcome: Mapped[str] = mapped_column(String(20), default="success")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    actor: Mapped[str] = mapped_column(String(100))
    sample_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    messages = relationship("ConversationMessage", cascade="all, delete-orphan",
                            passive_deletes=True, order_by="ConversationMessage.id")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
