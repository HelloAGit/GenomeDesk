import hashlib
import secrets
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from openai import APIError
from starlette.concurrency import run_in_threadpool

from app.config import Settings
from app.store import Store
from app.vcf import parse_vcf, summarise
from app import nebius


def create_app(settings=None):
    settings = settings or Settings()
    app = FastAPI(title="GenomeDesk Backend", version="0.1.0")
    store = Store(settings.data_dir)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_credentials=False, allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-API-Key"],
    )
    key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

    def authorised(key=Depends(key_header)):
        if not settings.backend_api_key:
            raise HTTPException(503, "Set BACKEND_API_KEY before using this API")
        if not key or not secrets.compare_digest(key, settings.backend_api_key):
            raise HTTPException(401, "Invalid API key")

    def sample_or_404(sample_id):
        sample = store.get(sample_id)
        if sample is None:
            raise HTTPException(404, "Sample not found")
        return sample

    def metadata(sample):
        return {k: v for k, v in sample.items() if k != "records"}

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/api/capabilities", dependencies=[Depends(authorised)])
    def capabilities():
        return {"vcf_import": True, "fastq_processing": False,
                "annotation": False, "authentication": "single-workspace-server-key",
                "ai_configured": bool(settings.nebius_api_key and settings.nebius_model),
                "max_upload_bytes": settings.max_upload_bytes,
                "max_records": settings.max_records}

    @app.post("/api/samples", status_code=201, dependencies=[Depends(authorised)])
    async def upload_sample(
        file: UploadFile = File(...),
        assembly: Literal["GRCh37", "GRCh38"] = Form(...),
        sample_name: str = Form(..., min_length=1, max_length=100),
    ):
        if not file.filename or not file.filename.lower().endswith(".vcf"):
            await file.close()
            raise HTTPException(422, "Upload an uncompressed .vcf file")
        digest = hashlib.sha256()
        size = 0
        try:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "input.vcf"
                with path.open("wb") as output:
                    while chunk := await file.read(65536):
                        size += len(chunk)
                        if size > settings.max_upload_bytes:
                            raise HTTPException(413, "Upload exceeds configured size limit")
                        digest.update(chunk)
                        output.write(chunk)
                try:
                    records, declared = await run_in_threadpool(
                        parse_vcf, path, assembly, settings.max_records
                    )
                except (ValueError, OSError, KeyError, TypeError) as exc:
                    raise HTTPException(422, "Invalid or unsupported VCF input") from exc
        finally:
            await file.close()
        sample = {
            "id": str(uuid4()), "name": sample_name, "assembly": assembly,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sha256": digest.hexdigest(), "size_bytes": size,
            "declared_reference": declared,
            "reference_verification": "header-match" if declared == assembly else "user-declared-unverified",
            "summary": summarise(records), "records": records,
        }
        await run_in_threadpool(store.save, sample)
        return metadata(sample)

    @app.get("/api/samples", dependencies=[Depends(authorised)])
    def list_samples():
        return [metadata(sample) for sample in store.list()]

    @app.get("/api/samples/{sample_id}", dependencies=[Depends(authorised)])
    def get_sample(sample_id: str):
        return metadata(sample_or_404(sample_id))

    @app.get("/api/samples/{sample_id}/variants", dependencies=[Depends(authorised)])
    def variants(sample_id: str, chromosome: str | None = None,
                 min_quality: float | None = Query(None, ge=0),
                 pass_only: bool = False, offset: int = Query(0, ge=0),
                 limit: int = Query(100, ge=1, le=1000)):
        rows = sample_or_404(sample_id)["records"]
        rows = [r for r in rows if
                (chromosome is None or r["chromosome"] == chromosome) and
                (min_quality is None or (r["quality"] is not None and r["quality"] >= min_quality)) and
                (not pass_only or r["filters"] == ["PASS"])]
        return {"total": len(rows), "offset": offset, "limit": limit,
                "items": rows[offset:offset + limit]}

    @app.get("/api/samples/{sample_id}/qc", dependencies=[Depends(authorised)])
    def qc(sample_id: str):
        return sample_or_404(sample_id)["summary"]

    @app.post("/api/samples/{sample_id}/explain", dependencies=[Depends(authorised)])
    async def explain_sample(sample_id: str):
        sample = await run_in_threadpool(sample_or_404, sample_id)
        if not settings.nebius_api_key or not settings.nebius_model:
            raise HTTPException(503, "Set NEBIUS_API_KEY and NEBIUS_MODEL to enable AI")
        try:
            text = await nebius.explain(sample["summary"], settings)
        except (APIError, ValueError) as exc:
            raise HTTPException(502, "AI provider unavailable; retry later") from exc
        return {"text": text, "model": settings.nebius_model,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "review_required": True, "source_metrics": sample["summary"]}

    @app.delete("/api/samples/{sample_id}", status_code=204, dependencies=[Depends(authorised)])
    def delete_sample(sample_id: str):
        sample_or_404(sample_id)
        store.delete(sample_id)

    return app


app = create_app()
