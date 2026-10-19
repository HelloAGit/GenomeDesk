import gzip
import math
from pathlib import Path

import pysam

GZIP_MAGIC = b"\x1f\x8b"
QUALITY_BINS = [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, None)]


class VcfValidationError(ValueError):
    """Raised with a message that is safe to show to API clients."""


def detect_format(filename: str | None) -> str:
    name = (filename or "").lower()
    if name.endswith(".vcf.gz"):
        return "vcf.gz"
    if name.endswith(".vcf"):
        return "vcf"
    raise VcfValidationError("Upload a .vcf or .vcf.gz file")


def check_magic(path: Path, source_format: str) -> None:
    with path.open("rb") as handle:
        head = handle.read(16)
    if source_format == "vcf.gz":
        if not head.startswith(GZIP_MAGIC):
            raise VcfValidationError("File is not valid gzip data")
    elif not head.startswith(b"##fileformat=VCF"):
        raise VcfValidationError("File does not start with a VCF ##fileformat header")


def decompress_limited(source: Path, target: Path, max_bytes: int) -> int:
    """Decompress gzip to target, aborting if output exceeds max_bytes (gzip-bomb guard)."""
    total = 0
    try:
        with gzip.open(source, "rb") as reader, target.open("wb") as writer:
            while chunk := reader.read(65536):
                total += len(chunk)
                if total > max_bytes:
                    raise VcfValidationError("Decompressed VCF exceeds configured size limit")
                writer.write(chunk)
    except (OSError, EOFError) as exc:
        raise VcfValidationError("Invalid or truncated gzip data") from exc
    return total


def prepare_vcf(path: Path, source_format: str, max_decompressed_bytes: int) -> Path:
    """Verify magic bytes and return a path to an uncompressed VCF in the same directory."""
    check_magic(path, source_format)
    if source_format == "vcf":
        return path
    target = path.with_name("decompressed.vcf")
    decompress_limited(path, target, max_decompressed_bytes)
    check_magic(target, "vcf")
    return target


def parse_vcf(path, assembly: str, max_records: int):
    """Sequential small-file import; one output row per VCF record, preserving ALTs."""
    records = []
    with pysam.VariantFile(str(path)) as reader:
        declared = next((str(item.value) for item in reader.header.records
                         if item.key == "reference"), None)
        # Recognised explicit assembly labels must agree. Reference paths/URIs
        # are retained as provenance, not guessed or silently converted.
        if declared in {"GRCh37", "GRCh38"} and declared != assembly:
            raise ValueError("VCF reference conflicts with selected assembly")
        for record in reader:
            if len(records) >= max_records:
                raise ValueError("Too many VCF records for this prototype")
            if record.pos < 1 or not record.ref or not record.alts:
                raise ValueError("Each record must have a position, REF and ALT")
            dp = record.info.get("DP")
            if dp is not None and (not isinstance(dp, int) or dp < 0):
                raise ValueError("INFO/DP must be a non-negative integer")
            quality = record.qual
            if quality is not None and not math.isfinite(quality):
                raise ValueError("QUAL must be finite or missing")
            records.append({
                "chromosome": record.contig, "position": record.pos,
                "reference": record.ref, "alternates": list(record.alts),
                "quality": quality, "filters": list(record.filter),
                "site_depth": dp,
            })
    return records, declared


def quality_histogram(qualities) -> list[dict]:
    bins = []
    for low, high in QUALITY_BINS:
        label = f"{low}-{high}" if high is not None else f"{low}+"
        count = sum(q >= low and (high is None or q < high) for q in qualities)
        bins.append({"label": label, "min": low, "max": high, "count": count})
    return bins


def summarise(records):
    qualities = [r["quality"] for r in records if r["quality"] is not None]
    depths = [r["site_depth"] for r in records if r["site_depth"] is not None]
    chromosomes = {}
    for record in records:
        key = record["chromosome"]
        chromosomes[key] = chromosomes.get(key, 0) + 1
    return {
        "record_count": len(records),
        "pass_record_count": sum(r["filters"] == ["PASS"] for r in records),
        "unfiltered_record_count": sum(not r["filters"] for r in records),
        "mean_variant_quality": sum(qualities) / len(qualities) if qualities else None,
        "quality_observation_count": len(qualities),
        "mean_site_depth": sum(depths) / len(depths) if depths else None,
        "depth_observation_count": len(depths),
        "records_by_chromosome": chromosomes,
        "quality_histogram": quality_histogram(qualities),
        "limitations": [
            "Variant sites only: INFO/DP is not genome-wide coverage or sample-specific depth.",
            "Read quality, mapping rate and duplicate rate require separate alignment/QC outputs.",
            "No annotation, pathogenicity classification or diagnosis is performed.",
        ],
    }


