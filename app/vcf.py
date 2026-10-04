import math
import pysam


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
        "limitations": [
            "Variant sites only: INFO/DP is not genome-wide coverage or sample-specific depth.",
            "Read quality, mapping rate and duplicate rate require separate alignment/QC outputs.",
            "No annotation, pathogenicity classification or diagnosis is performed.",
        ],
    }
