"""Project-scoped routes.

Included twice by app.main: under /api/projects/{project_id} for identity-based users and
under /api for the dev API-key compatibility mode (which maps to the default project).
"""
import hashlib
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import nebius
from app.ai import assistant
from app.api.deps import ProjectCtx, get_session, project_ctx
from app.bioinformatics.vcf import VcfValidationError, detect_format, parse_vcf, prepare_vcf
from app.db.models import AnalysisJob, ResearchReport
from app.schemas.api import Assembly, ChatIn, JobIn, JobOut, SampleOut, SummaryIn, VariantPage
from app.services import audit, jobs
from app.services import samples as svc

router = APIRouter()


def _sample_or_404(session: Session, ctx: ProjectCtx, sample_id: str):
    sample = svc.get_sample(session, ctx.project.id, sample_id)
    if sample is None:
        raise HTTPException(404, "Sample not found")
    return sample


def _audit(session: Session, ctx: ProjectCtx, action: str, target_type="", target_id="", outcome="success", **detail):
    audit.record(session, ctx.principal.actor, action, ctx.project.id, target_type, target_id, outcome, detail)
    session.commit()


@router.post("/samples", status_code=201, response_model=SampleOut)
async def upload_sample(
    request: Request,
    file: UploadFile = File(...),
    assembly: Assembly = Form(...),
    sample_name: str = Form(..., min_length=1, max_length=100),
    ctx: ProjectCtx = Depends(project_ctx),
    session: Session = Depends(get_session),
):
    settings = request.app.state.settings
    ctx.require("editor")
    try:
        source_format = detect_format(file.filename)
    except VcfValidationError as exc:
        await file.close()
        raise HTTPException(422, str(exc)) from exc
    digest = hashlib.sha256()
    size = 0
    try:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ("input.vcf.gz" if source_format == "vcf.gz" else "input.vcf")
            with path.open("wb") as output:
                while chunk := await file.read(65536):
                    size += len(chunk)
                    if size > settings.max_upload_bytes:
                        raise HTTPException(413, "Upload exceeds configured size limit")
                    digest.update(chunk)
                    output.write(chunk)
            try:
                def load():
                    plain = prepare_vcf(path, source_format, settings.max_decompressed_bytes)
                    return parse_vcf(plain, assembly, settings.max_records)
                records, declared = await run_in_threadpool(load)
            except VcfValidationError as exc:
                raise HTTPException(422, str(exc)) from exc
            except (ValueError, OSError, KeyError, TypeError) as exc:
                raise HTTPException(422, "Invalid or unsupported VCF input") from exc
    finally:
        await file.close()

    def save():
        sample = svc.create_sample(session, ctx.project.id, sample_name, assembly, digest.hexdigest(),
                                   size, source_format, declared, records,
                                   ctx.principal.user.id if ctx.principal.user else None)
        audit.record(session, ctx.principal.actor, "sample.import", ctx.project.id, "sample", sample.id,
                     detail={"format": source_format, "size_bytes": size, "records": len(records)})
        session.commit()
        return svc.sample_metadata(sample)
    return await run_in_threadpool(save)


@router.get("/samples", response_model=list[SampleOut])
def list_samples(ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    return [svc.sample_metadata(s) for s in svc.list_samples(session, ctx.project.id)]


@router.get("/samples/{sample_id}", response_model=SampleOut)
def get_sample(sample_id: str, ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    return svc.sample_metadata(_sample_or_404(session, ctx, sample_id))


@router.get("/samples/{sample_id}/variants", response_model=VariantPage)
def variants(sample_id: str, chromosome: str | None = None,
             min_quality: float | None = Query(None, ge=0), pass_only: bool = False,
             ref: str | None = Query(None, max_length=200), alt: str | None = Query(None, max_length=200),
             offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000),
             ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    sample = _sample_or_404(session, ctx, sample_id)
    total, items = svc.query_variants(session, sample.id, chromosome, min_quality, pass_only,
                                      ref, alt, offset, limit)
    return {"total": total, "offset": offset, "limit": limit, "items": items}


def _download(body: str, media: str, filename: str) -> Response:
    return Response(body, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}"', "X-Content-Type-Options": "nosniff"})


@router.get("/samples/{sample_id}/variants/export")
def export_variants(request: Request, sample_id: str, format: Literal["csv", "json"] = "csv",
                    chromosome: str | None = None, min_quality: float | None = Query(None, ge=0),
                    pass_only: bool = False, ref: str | None = Query(None, max_length=200),
                    alt: str | None = Query(None, max_length=200),
                    ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    sample = _sample_or_404(session, ctx, sample_id)
    body, media = svc.export_variants(session, sample.id, format, request.app.state.settings.max_records,
                                      chromosome=chromosome, min_quality=min_quality,
                                      pass_only=pass_only, ref=ref, alt=alt)
    _audit(session, ctx, "variants.export", "sample", sample.id, format=format)
    return _download(body, media, f"variants-{sample.id}.{format}")


@router.get("/samples/{sample_id}/summary")
def summary_download(sample_id: str, format: Literal["csv", "json"] = "json",
                     ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    sample = _sample_or_404(session, ctx, sample_id)
    body, media = svc.export_summary(sample, format)
    return _download(body, media, f"summary-{sample.id}.{format}")


@router.get("/samples/{sample_id}/qc")
def qc(sample_id: str, ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    return _sample_or_404(session, ctx, sample_id).summary


@router.post("/samples/{sample_id}/explain")
async def explain_sample(request: Request, sample_id: str, ctx: ProjectCtx = Depends(project_ctx),
                         session: Session = Depends(get_session)):
    settings = request.app.state.settings
    sample = await run_in_threadpool(_sample_or_404, session, ctx, sample_id)
    summary = sample.summary
    if not settings.nebius_api_key or not settings.nebius_model:
        raise HTTPException(503, "Set NEBIUS_API_KEY and NEBIUS_MODEL to enable AI")
    try:
        text = await nebius.explain(summary, settings)
    except Exception as exc:  # noqa: BLE001 - never leak provider details or crash
        raise HTTPException(502, "AI provider unavailable; retry later") from exc
    await run_in_threadpool(_audit, session, ctx, "ai.explain", "sample", sample.id)
    return {"text": text, "model": settings.nebius_model,
            "generated_at": datetime.now(UTC).isoformat(),
            "review_required": True, "source_metrics": summary}


@router.delete("/samples/{sample_id}", status_code=204)
def delete_sample(sample_id: str, ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    ctx.require("editor")
    sample = _sample_or_404(session, ctx, sample_id)
    svc.delete_sample(session, sample)
    audit.record(session, ctx.principal.actor, "sample.delete", ctx.project.id, "sample", sample_id)
    session.commit()


@router.get("/dashboard")
def dashboard(ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    return svc.dashboard(session, ctx.project)


@router.get("/jobs/pipelines")
def pipelines(ctx: ProjectCtx = Depends(project_ctx)):
    return jobs.FASTQ_PIPELINE_PLAN


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    return [jobs.job_dict(j) for j in jobs.list_jobs(session, ctx.project.id)]


@router.post("/jobs", status_code=201, response_model=JobOut)
def create_job(body: JobIn, ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    ctx.require("editor")
    sample = _sample_or_404(session, ctx, body.sample_id)
    job = jobs.enqueue(session, ctx.project.id, sample.id, body.job_type,
                       ctx.principal.user.id if ctx.principal.user else None)
    audit.record(session, ctx.principal.actor, "job.create", ctx.project.id, "job", job.id)
    session.commit()
    return jobs.job_dict(job)


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    job = session.get(AnalysisJob, job_id)
    if job is None or job.project_id != ctx.project.id:
        raise HTTPException(404, "Job not found")
    return jobs.job_dict(job)


@router.get("/assistant/status")
def assistant_status(request: Request, ctx: ProjectCtx = Depends(project_ctx)):
    return assistant.ai_status(request.app.state.settings)


async def _assistant(request, ctx, session, message, sample_ids, conversation_id, mode):
    try:
        result = await assistant.respond(session, ctx.project.id, ctx.principal.actor, message,
                                         sample_ids, conversation_id, request.app.state.settings, mode)
    except assistant.AssistantNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    audit.record(session, ctx.principal.actor, f"assistant.{mode}", ctx.project.id, "conversation",
                 result["conversation_id"], outcome=result["status"],
                 detail={"sample_ids": result["sample_ids"]})
    session.commit()
    return result


@router.post("/assistant/chat")
async def assistant_chat(request: Request, body: ChatIn, ctx: ProjectCtx = Depends(project_ctx),
                         session: Session = Depends(get_session)):
    return await _assistant(request, ctx, session, body.message, body.sample_ids, body.conversation_id, "chat")


@router.post("/assistant/summary")
async def assistant_summary(request: Request, body: SummaryIn, ctx: ProjectCtx = Depends(project_ctx),
                            session: Session = Depends(get_session)):
    return await _assistant(request, ctx, session,
                            "Write a concise research summary of the supplied QC metrics for these samples.",
                            body.sample_ids, body.conversation_id, "summary")


@router.get("/reports")
def reports(ctx: ProjectCtx = Depends(project_ctx), session: Session = Depends(get_session)):
    rows = session.query(ResearchReport).filter_by(project_id=ctx.project.id)\
        .order_by(ResearchReport.created_at.desc()).limit(100)
    return [{"id": r.id, "kind": r.kind, "title": r.title,
             "created_at": r.created_at.isoformat(), "sample_id": r.sample_id} for r in rows]
