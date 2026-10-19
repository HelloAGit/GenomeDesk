import gzip

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import gz_fixture, upload_to

H = {"X-API-Key": "test-secret"}


def make_client(tmp_path, **overrides):
    settings = Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path),
                        rate_limit_per_minute=0, **overrides)
    return TestClient(create_app(settings))


def test_vcf_gz_import_matches_plain(tmp_path):
    with make_client(tmp_path) as client:
        plain = upload_to(client, H).json()
        gz = upload_to(client, H, data=gz_fixture(), name="synthetic.vcf.gz")
        assert gz.status_code == 201, gz.text
        body = gz.json()
        assert body["source_format"] == "vcf.gz"
        assert body["summary"]["record_count"] == plain["summary"]["record_count"] == 4
        assert len(body["sha256"]) == 64 and body["sha256"] != plain["sha256"]
        assert body["reference_verification"] == "header-match"


def test_invalid_uploads_have_meaningful_errors(tmp_path):
    with make_client(tmp_path) as client:
        not_gzip = upload_to(client, H, data=b"plain text", name="x.vcf.gz")
        assert not_gzip.status_code == 422 and "gzip" in not_gzip.json()["detail"]
        truncated = upload_to(client, H, data=gz_fixture()[:30], name="x.vcf.gz")
        assert truncated.status_code == 422
        bad_magic = upload_to(client, H, data=b"hello\n", name="x.vcf")
        assert bad_magic.status_code == 422 and "##fileformat" in bad_magic.json()["detail"]
        assert upload_to(client, H, data=b"x", name="x.bam").status_code == 422
        wrong_assembly = upload_to(client, H, data=gz_fixture(), name="x.vcf.gz", assembly="GRCh37")
        assert wrong_assembly.status_code == 422
        assert client.get("/api/samples", headers=H).json() == []


def test_decompression_limit(tmp_path):
    with make_client(tmp_path, max_decompressed_bytes=100) as client:
        response = upload_to(client, H, data=gz_fixture(), name="x.vcf.gz")
        assert response.status_code == 422 and "Decompressed" in response.json()["detail"]
    with make_client(tmp_path / "b", max_upload_bytes=20) as client:
        assert upload_to(client, H, data=gz_fixture(), name="x.vcf.gz").status_code == 413


def test_allele_filters_and_quality_histogram(tmp_path):
    with make_client(tmp_path) as client:
        sample = upload_to(client, H).json()
        url = f"/api/samples/{sample['id']}/variants"
        assert client.get(url, params={"alt": "G"}, headers=H).json()["total"] == 2
        assert client.get(url, params={"alt": "A"}, headers=H).json()["total"] == 2
        assert client.get(url, params={"ref": "C", "alt": "G"}, headers=H).json()["total"] == 1
        assert client.get(url, params={"alt": "%"}, headers=H).json()["total"] == 0
        assert client.get(url, params={"chromosome": "chr1", "ref": "A"}, headers=H).json()["total"] == 1
        hist = client.get(f"/api/samples/{sample['id']}/qc", headers=H).json()["quality_histogram"]
        assert sum(b["count"] for b in hist) == 3  # QUAL "." is excluded, not imputed
        assert {b["label"]: b["count"] for b in hist}["50+"] == 2


def test_downloads(tmp_path):
    with make_client(tmp_path) as client:
        sid = upload_to(client, H).json()["id"]
        csv_resp = client.get(f"/api/samples/{sid}/variants/export", params={"format": "csv", "pass_only": True}, headers=H)
        assert csv_resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in csv_resp.headers["content-disposition"]
        assert len(csv_resp.text.strip().splitlines()) == 3
        js = client.get(f"/api/samples/{sid}/variants/export", params={"format": "json"}, headers=H).json()
        assert len(js) == 4
        summary = client.get(f"/api/samples/{sid}/summary", params={"format": "csv"}, headers=H)
        assert "record_count,4" in summary.text
        assert client.get(f"/api/samples/{sid}/summary", headers=H).json()["summary"]["record_count"] == 4


def test_csv_formula_injection_neutralised():
    from app.services.samples import csv_safe
    assert csv_safe("=HYPERLINK()") == "'=HYPERLINK()"
    assert csv_safe("@x") == "'@x" and csv_safe("+1") == "'+1" and csv_safe("-1") == "'-1"
    assert csv_safe(-1.5) == "-1.5"
    assert csv_safe("chr1") == "chr1" and csv_safe(None) == ""


def test_legacy_documents_are_imported(tmp_path):
    import json
    import sqlite3
    db = sqlite3.connect(tmp_path / "genomedesk.sqlite3")
    db.execute("CREATE TABLE samples (id TEXT PRIMARY KEY, document TEXT NOT NULL)")
    doc = {"id": "11111111-1111-1111-1111-111111111111", "name": "old", "assembly": "GRCh38",
           "created_at": "2025-01-01T00:00:00+00:00", "sha256": "0" * 64, "size_bytes": 1,
           "declared_reference": "GRCh38",
           "records": [{"chromosome": "chr1", "position": 5, "reference": "A", "alternates": ["T"],
                        "quality": 30.0, "filters": ["PASS"], "site_depth": 7}]}
    db.execute("INSERT INTO samples VALUES (?, ?)", (doc["id"], json.dumps(doc)))
    db.commit()
    db.close()
    with make_client(tmp_path) as client:
        got = client.get(f"/api/samples/{doc['id']}", headers=H).json()
        assert got["name"] == "old" and got["summary"]["record_count"] == 1
        assert client.get(f"/api/samples/{doc['id']}/variants", headers=H).json()["items"][0]["position"] == 5
    with make_client(tmp_path) as client:  # second start must not duplicate
        assert len(client.get("/api/samples", headers=H).json()) == 1


def test_gzip_bomb_guard_direct(tmp_path):
    import pytest

    from app.bioinformatics.vcf import VcfValidationError, decompress_limited
    source = tmp_path / "a.gz"
    source.write_bytes(gzip.compress(b"A" * 10000))
    with pytest.raises(VcfValidationError):
        decompress_limited(source, tmp_path / "out", 1000)
