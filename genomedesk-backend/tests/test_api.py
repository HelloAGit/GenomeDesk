from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app import nebius

FIXTURE = Path(__file__).parents[1] / "examples" / "synthetic.vcf"
HEADERS = {"X-API-Key": "test-secret"}


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path))


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as client:
        yield client


def upload(client, data=None, assembly="GRCh38"):
    return client.post("/api/samples", headers=HEADERS,
                       data={"sample_name": "synthetic", "assembly": assembly},
                       files={"file": ("synthetic.vcf", data or FIXTURE.read_bytes(), "text/plain")})


def test_authentication(client):
    assert client.get("/health").status_code == 200
    assert client.get("/api/samples").status_code == 401
    assert client.get("/api/samples", headers={"X-API-Key": "wrong"}).status_code == 401


def test_import_filter_metrics_delete(client):
    response = upload(client)
    assert response.status_code == 201, response.text
    sample = response.json()
    assert sample["reference_verification"] == "header-match"
    assert len(sample["sha256"]) == 64
    sample_id = sample["id"]
    qc = client.get(f"/api/samples/{sample_id}/qc", headers=HEADERS).json()
    assert qc["record_count"] == 4
    assert qc["pass_record_count"] == 2
    assert qc["unfiltered_record_count"] == 1
    assert qc["mean_site_depth"] == 20
    assert qc["depth_observation_count"] == 3
    url = f"/api/samples/{sample_id}/variants"
    result = client.get(url, params={"pass_only": True, "limit": 1}, headers=HEADERS).json()
    assert result["total"] == 2 and len(result["items"]) == 1
    result = client.get(url, params={"min_quality": 50}, headers=HEADERS).json()
    assert result["total"] == 2
    result = client.get(url, params={"chromosome": "chr2"}, headers=HEADERS).json()
    assert result["items"][0]["alternates"] == ["A", "G"]
    assert client.delete(f"/api/samples/{sample_id}", headers=HEADERS).status_code == 204
    assert client.get(url, headers=HEADERS).status_code == 404


def test_invalid_and_reference_mismatch(client):
    assert upload(client, b"not a VCF").status_code == 422
    assert upload(client, assembly="GRCh37").status_code == 422
    assert upload(client, assembly="unknown").status_code == 422
    assert client.get("/api/samples", headers=HEADERS).json() == []


def test_limits(settings):
    settings.max_upload_bytes = 10
    with TestClient(create_app(settings)) as client:
        assert upload(client).status_code == 413
    settings.max_upload_bytes = 10000
    settings.max_records = 2
    with TestClient(create_app(settings)) as client:
        assert upload(client).status_code == 422


def test_persistence(settings):
    with TestClient(create_app(settings)) as first:
        sample_id = upload(first).json()["id"]
    with TestClient(create_app(settings)) as second:
        assert second.get(f"/api/samples/{sample_id}", headers=HEADERS).status_code == 200


def test_missing_nebius_credentials(client):
    sample_id = upload(client).json()["id"]
    assert client.post(f"/api/samples/{sample_id}/explain", headers=HEADERS).status_code == 503


def test_ai_payload_and_failure(settings, monkeypatch):
    settings.nebius_api_key = "fake-test-key"
    settings.nebius_model = "fake-test-model"
    payloads = []

    async def fake(summary, config):
        payloads.append(summary)
        return "Research draft."

    monkeypatch.setattr(nebius, "explain", fake)
    with TestClient(create_app(settings)) as client:
        sample_id = upload(client).json()["id"]
        url = f"/api/samples/{sample_id}/explain"
        response = client.post(url, headers=HEADERS)
        assert response.json()["review_required"] is True
        assert "records" not in payloads[0] and "name" not in payloads[0]

        async def fail(summary, config):
            raise ValueError("provider error containing sensitive information")

        monkeypatch.setattr(nebius, "explain", fail)
        response = client.post(url, headers=HEADERS)
        assert response.status_code == 502
        assert "sensitive" not in response.text


def test_cors(client):
    response = client.options("/api/samples", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "X-API-Key",
    })
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    response = client.options("/api/samples", headers={
        "Origin": "https://unapproved.example", "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 400
