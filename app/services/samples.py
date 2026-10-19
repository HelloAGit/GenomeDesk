import csv
import io
import json
from datetime import UTC, datetime

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.bioinformatics.vcf import summarise
from app.db.models import AnalysisJob, ResearchReport, Sample, Variant

VARIANT_FIELDS = ["chromosome", "position", "reference", "alternates", "quality", "filters", "site_depth"]


def sample_metadata(sample: Sample) -> dict:
    return {
        "id": sample.id, "project_id": sample.project_id, "name": sample.name,
        "assembly": sample.assembly, "created_at": sample.created_at.isoformat(),
        "sha256": sample.sha256, "size_bytes": sample.size_bytes,
        "source_format": sample.source_format,
        "declared_reference": sample.declared_reference,
        "reference_verification": sample.reference_verification,
        "summary": sample.summary,
    }


def variant_row(variant: Variant) -> dict:
    return {"chromosome": variant.chromosome, "position": variant.position,
            "reference": variant.reference, "alternates": variant.alternates,
            "quality": variant.quality, "filters": variant.filters,
            "site_depth": variant.site_depth}


def create_sample(session: Session, project_id: str, name: str, assembly: str, sha256: str,
                  size: int, source_format: str, declared: str | None, records: list[dict],
                  created_by: str | None, sample_id: str | None = None,
                  created_at: datetime | None = None) -> Sample:
    sample = Sample(
        **({"id": sample_id} if sample_id else {}), **({"created_at": created_at} if created_at else {}),
        project_id=project_id, name=name, assembly=assembly, sha256=sha256, size_bytes=size,
        source_format=source_format, declared_reference=declared,
        reference_verification="header-match" if declared == assembly else "user-declared-unverified",
        summary=summarise(records), created_by=created_by,
    )
    session.add(sample)
    session.flush()
    rows = [{
        "sample_id": sample.id, "ordinal": i, "chromosome": r["chromosome"],
        "position": r["position"], "reference": r["reference"], "alternates": r["alternates"],
        "alt_key": "," + ",".join(r["alternates"]) + ",", "quality": r["quality"],
        "filters": r["filters"], "is_pass": r["filters"] == ["PASS"],
        "site_depth": r["site_depth"],
    } for i, r in enumerate(records)]
    for start in range(0, len(rows), 5000):
        session.execute(insert(Variant), rows[start:start + 5000])
    return sample


def get_sample(session: Session, project_id: str, sample_id: str) -> Sample | None:
    sample = session.get(Sample, sample_id)
    return sample if sample and sample.project_id == project_id else None


def list_samples(session: Session, project_id: str) -> list[Sample]:
    return list(session.scalars(select(Sample).where(Sample.project_id == project_id)
                                .order_by(Sample.created_at.desc(), Sample.id)))


def delete_sample(session: Session, sample: Sample) -> None:
    session.execute(delete(Variant).where(Variant.sample_id == sample.id))
    session.execute(delete(AnalysisJob).where(AnalysisJob.sample_id == sample.id))
    session.delete(sample)


def _variant_query(sample_id, chromosome, min_quality, pass_only, ref, alt):
    query = select(Variant).where(Variant.sample_id == sample_id)
    if chromosome is not None:
        query = query.where(Variant.chromosome == chromosome)
    if min_quality is not None:
        query = query.where(Variant.quality >= min_quality)
    if pass_only:
        query = query.where(Variant.is_pass.is_(True))
    if ref:
        query = query.where(Variant.reference == ref)
    if alt:
        escaped = alt.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Variant.alt_key.like(f"%,{escaped},%", escape="\\"))
    return query


def query_variants(session: Session, sample_id: str, chromosome=None, min_quality=None,
                   pass_only=False, ref=None, alt=None, offset=0, limit=100) -> tuple[int, list[dict]]:
    query = _variant_query(sample_id, chromosome, min_quality, pass_only, ref, alt)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    rows = session.scalars(query.order_by(Variant.ordinal).offset(offset).limit(limit))
    return total, [variant_row(v) for v in rows]


def csv_safe(value) -> str:
    if value is None:
        return ""
    if isinstance(value, int | float) and not isinstance(value, bool):
        return str(value)  # genuine numbers (including negatives) are not formulas
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def export_variants(session: Session, sample_id: str, fmt: str, max_rows: int, **filters) -> tuple[str, str]:
    _, rows = query_variants(session, sample_id, offset=0, limit=max_rows, **filters)
    if fmt == "json":
        return json.dumps(rows), "application/json"
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(VARIANT_FIELDS)
    for row in rows:
        writer.writerow([csv_safe(",".join(row[f])) if f in ("alternates", "filters")
                         else csv_safe(row[f]) for f in VARIANT_FIELDS])
    return out.getvalue(), "text/csv"


def export_summary(sample: Sample, fmt: str) -> tuple[str, str]:
    summary = sample.summary
    document = {"sample_id": sample.id, "sample_name": sample.name, "assembly": sample.assembly,
                "sha256": sample.sha256, "generated_at": datetime.now(UTC).isoformat(),
                "summary": summary}
    if fmt == "json":
        return json.dumps(document), "application/json"
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["metric", "key", "value"])
    for key in ("record_count", "pass_record_count", "unfiltered_record_count",
                "mean_variant_quality", "quality_observation_count", "mean_site_depth",
                "depth_observation_count"):
        writer.writerow(["summary", key, csv_safe(summary.get(key))])
    for chrom, count in summary["records_by_chromosome"].items():
        writer.writerow(["records_by_chromosome", csv_safe(chrom), count])
    for item in summary.get("quality_histogram", []):
        writer.writerow(["quality_histogram", item["label"], item["count"]])
    return out.getvalue(), "text/csv"


def dashboard(session: Session, project, history_limit: int = 10) -> dict:
    samples = list_samples(session, project.id)
    total = sum(s.summary["record_count"] for s in samples)
    passed = sum(s.summary["pass_record_count"] for s in samples)
    chromosomes: dict[str, int] = {}
    histogram: dict[str, dict] = {}
    q_sum = q_n = d_sum = d_n = 0
    for s in samples:
        sm = s.summary
        for chrom, count in sm["records_by_chromosome"].items():
            chromosomes[chrom] = chromosomes.get(chrom, 0) + count
        for item in sm.get("quality_histogram", []):
            slot = histogram.setdefault(item["label"], {**item, "count": 0})
            slot["count"] += item["count"]
        if sm["mean_variant_quality"] is not None:
            q_sum += sm["mean_variant_quality"] * sm["quality_observation_count"]
            q_n += sm["quality_observation_count"]
        if sm["mean_site_depth"] is not None:
            d_sum += sm["mean_site_depth"] * sm["depth_observation_count"]
            d_n += sm["depth_observation_count"]
    reports = session.scalars(select(ResearchReport).where(ResearchReport.project_id == project.id)
                              .order_by(ResearchReport.created_at.desc()).limit(history_limit))
    return {
        "project": {"id": project.id, "name": project.name},
        "sample_total": len(samples), "variant_total": total, "pass_variant_total": passed,
        "mean_variant_quality": q_sum / q_n if q_n else None,
        "mean_site_depth": d_sum / d_n if d_n else None,
        "chromosome_distribution": [{"chromosome": c, "count": n} for c, n in sorted(chromosomes.items())],
        "quality_histogram": list(histogram.values()),
        "sample_comparison": [{
            "id": s.id, "name": s.name, "assembly": s.assembly,
            "record_count": s.summary["record_count"],
            "pass_record_count": s.summary["pass_record_count"],
            "mean_variant_quality": s.summary["mean_variant_quality"],
            "mean_site_depth": s.summary["mean_site_depth"],
        } for s in samples],
        "research_history": [{"id": r.id, "kind": r.kind, "title": r.title,
                              "created_at": r.created_at.isoformat(), "sample_id": r.sample_id}
                             for r in reports],
        "limitations": ["Metrics are aggregated from imported VCF records only; INFO/DP is site depth, "
                        "not genome-wide coverage."],
    }
