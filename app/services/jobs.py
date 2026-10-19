import logging
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import AnalysisJob, Variant

logger = logging.getLogger("genomedesk.jobs")

# Job types that a worker can actually execute today.
RUNNABLE_JOB_TYPES = {"variant_summary"}

# Design-only description of a future FASTQ workflow. Nothing here is executed.
# Versions are pins for the planned integration and have NOT been validated end to end.
FASTQ_PIPELINE_PLAN = {
    "status": "planned",
    "note": ("FASTQ processing is not operational. These stages describe a planned, "
             "version-pinned Nextflow/nf-core integration; no end-to-end test exists yet."),
    "stages": [
        {"name": "fastq_upload", "tool": "GenomeDesk upload service", "pinned_version": "n/a", "status": "planned"},
        {"name": "fastqc", "tool": "FastQC", "pinned_version": "0.12.1", "status": "planned"},
        {"name": "multiqc", "tool": "MultiQC", "pinned_version": "1.25.1", "status": "planned"},
        {"name": "alignment_and_variant_calling", "tool": "nf-core/sarek", "pinned_version": "3.5.1", "status": "planned"},
        {"name": "vcf_generation", "tool": "nf-core/sarek", "pinned_version": "3.5.1", "status": "planned"},
        {"name": "provenance", "tool": "GenomeDesk provenance record", "pinned_version": "n/a", "status": "planned"},
    ],
    "runtime": {"workflow_engine": "Nextflow", "pinned_version": "24.10.4"},
    "provenance_fields": ["pipeline", "pipeline_version", "nextflow_version", "container_digests",
                          "input_sha256", "parameters", "started_at", "finished_at"],
}


class JobError(ValueError):
    pass


def job_dict(job: AnalysisJob) -> dict:
    def iso(value):
        return value.isoformat() if value else None
    return {"id": job.id, "job_type": job.job_type, "status": job.status,
            "sample_id": job.sample_id, "created_at": iso(job.created_at),
            "started_at": iso(job.started_at), "finished_at": iso(job.finished_at),
            "error": job.error, "result": job.result}


def enqueue(session: Session, project_id: str, sample_id: str, job_type: str, created_by: str | None) -> AnalysisJob:
    if job_type not in RUNNABLE_JOB_TYPES:
        raise JobError(f"Job type '{job_type}' is not supported")
    job = AnalysisJob(project_id=project_id, sample_id=sample_id, job_type=job_type,
                      status="queued", created_by=created_by,
                      provenance={"genomedesk_job_handler": job_type})
    session.add(job)
    session.flush()
    return job


def list_jobs(session: Session, project_id: str) -> list[AnalysisJob]:
    return list(session.scalars(select(AnalysisJob).where(AnalysisJob.project_id == project_id)
                                .order_by(AnalysisJob.created_at.desc())))


def _variant_summary(session: Session, job: AnalysisJob) -> dict:
    snv = indel = multi = total = 0
    by_chrom: dict[str, int] = {}
    for ref, alts, chrom in session.execute(
            select(Variant.reference, Variant.alternates, Variant.chromosome)
            .where(Variant.sample_id == job.sample_id)):
        total += 1
        by_chrom[chrom] = by_chrom.get(chrom, 0) + 1
        multi += len(alts) > 1
        if len(ref) == 1 and all(len(a) == 1 for a in alts):
            snv += 1
        else:
            indel += 1
    return {"record_count": total, "snv_like_records": snv, "non_snv_records": indel,
            "multiallelic_records": multi, "records_by_chromosome": by_chrom,
            "note": "Computed from imported VCF records; no annotation or interpretation."}


HANDLERS = {"variant_summary": _variant_summary}


def claim_next(session: Session) -> AnalysisJob | None:
    """Atomically move one queued job to running; safe with several workers."""
    candidate = session.scalar(select(AnalysisJob.id).where(AnalysisJob.status == "queued")
                               .order_by(AnalysisJob.created_at).limit(1))
    if candidate is None:
        return None
    claimed = session.execute(update(AnalysisJob)
                              .where(AnalysisJob.id == candidate, AnalysisJob.status == "queued")
                              .values(status="running", started_at=datetime.now(UTC)))
    session.commit()
    return session.get(AnalysisJob, candidate) if claimed.rowcount == 1 else None


def execute(session: Session, job: AnalysisJob) -> None:
    try:
        job.result = HANDLERS[job.job_type](session, job)
        job.status = "completed"
    except Exception:  # noqa: BLE001 - worker must record any failure and continue
        logger.exception("job %s failed", job.id)
        job.status = "failed"
        job.error = "Job failed; see worker logs"
    job.finished_at = datetime.now(UTC)
    session.commit()
