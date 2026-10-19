import json
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app import nebius
from app.ai.tools import Toolbox, ToolError
from app.config import Settings
from app.db.models import Annotation
from app.db.session import make_engine, make_session_factory
from app.main import create_app
from app.workers.worker import run_once
from tests.conftest import register_login, upload_to

H = {"X-API-Key": "test-secret"}


def client_for(tmp_path, **overrides):
    settings = Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path),
                        rate_limit_per_minute=0, **overrides)
    return TestClient(create_app(settings)), settings


def capture_chat(monkeypatch, reply="sample_1 has 4 records."):
    calls = []

    async def fake(messages, config):
        calls.append(messages)
        return reply
    monkeypatch.setattr(nebius, "chat", fake)
    return calls


def test_unavailable_state_still_returns_direct_measurements(tmp_path):
    client, _ = client_for(tmp_path)
    with client:
        sid = upload_to(client, H).json()["id"]
        status = client.get("/api/assistant/status", headers=H).json()
        assert status["available"] is False and status["reason"]
        body = client.post("/api/assistant/chat", headers=H, json={"message": "QC?", "sample_ids": [sid]}).json()
        assert body["status"] == "unavailable" and body["interpretation"] is None
        assert body["direct_measurements"][0]["metrics"]["record_count"] == 4
        assert body["retrieved_evidence"] == []
        assert body["sources"][0]["version"] and "Research use only" in body["disclaimer"]
        assert any("No annotation evidence" in x for x in body["limitations"])


def test_grounded_answer_privacy_and_followup(tmp_path, monkeypatch):
    calls = capture_chat(monkeypatch)
    client, _ = client_for(tmp_path, nebius_api_key="fake", nebius_model="fake-model")
    with client:
        sid = upload_to(client, H).json()["id"]
        first = client.post("/api/assistant/chat", headers=H, json={"message": "Summarise QC", "sample_ids": [sid]}).json()
        assert first["status"] == "ok"
        assert first["interpretation"]["text"] == f"{sid} has 4 records."
        sent = calls[0][-1]["content"]
        assert "synthetic" not in sent and sid not in sent  # name and id are pseudonymised
        assert "position" not in sent and "alternates" not in sent
        assert json.loads(sent)["samples"][0]["record_count"] == 4
        second = client.post("/api/assistant/chat", headers=H, json={
            "message": "And chromosome counts?", "conversation_id": first["conversation_id"]}).json()
        assert second["sample_ids"] == [sid]  # follow-up keeps sample context
        assert any(m["content"] == "Summarise QC" for m in calls[1])
        assert not any(sid in m["content"] for m in calls[1][:-1])  # history replays pseudonymous labels only
        assert second["direct_measurements"][0]["metrics"]["records_by_chromosome"] == {"chr1": 2, "chr2": 2}


def test_variant_level_sharing_only_when_approved(tmp_path, monkeypatch):
    calls = capture_chat(monkeypatch)
    client, _ = client_for(tmp_path, nebius_api_key="fake", nebius_model="fake-model", ai_share_variant_level=True)
    with client:
        sid = upload_to(client, H).json()["id"]
        client.post("/api/assistant/chat", headers=H, json={"message": "variants", "sample_ids": [sid]})
        assert "position" in calls[0][-1]["content"]


def test_provider_failure_does_not_crash(tmp_path, monkeypatch):
    async def boom(messages, config):
        raise RuntimeError("secret provider detail")
    monkeypatch.setattr(nebius, "chat", boom)
    client, _ = client_for(tmp_path, nebius_api_key="fake", nebius_model="fake-model")
    with client:
        sid = upload_to(client, H).json()["id"]
        response = client.post("/api/assistant/chat", headers=H, json={"message": "x", "sample_ids": [sid]})
        assert response.status_code == 200 and response.json()["status"] == "provider_error"
        assert "secret" not in response.text
        assert response.json()["direct_measurements"]


def test_no_data_and_unknown_sample(tmp_path):
    client, _ = client_for(tmp_path)
    with client:
        body = client.post("/api/assistant/chat", headers=H, json={"message": "hello"}).json()
        assert body["status"] == "no_data" and "No evidence" in body["message"]
        assert client.post("/api/assistant/chat", headers=H, json={"message": "x", "sample_ids": ["nope"]}).status_code == 404
        assert client.post("/api/assistant/chat", headers=H, json={"message": "x" * 2001}).status_code == 422


def test_summary_creates_report_and_comparison(tmp_path, monkeypatch):
    capture_chat(monkeypatch)
    client, _ = client_for(tmp_path, nebius_api_key="fake", nebius_model="fake-model")
    with client:
        a, b = upload_to(client, H).json()["id"], upload_to(client, H).json()["id"]
        body = client.post("/api/assistant/summary", headers=H, json={"sample_ids": [a, b]}).json()
        assert "compare_samples" in body["tools_used"]
        reports = client.get("/api/reports", headers=H).json()
        assert len(reports) == 1 and reports[0]["kind"] == "assistant_summary"
        assert client.get("/api/dashboard", headers=H).json()["research_history"][0]["id"] == reports[0]["id"]


def test_conversations_are_project_scoped(mu_client, monkeypatch):
    capture_chat(monkeypatch)
    alice = register_login(mu_client, "alice@example.org")
    bob = register_login(mu_client, "bob@example.org")
    pa = mu_client.post("/api/projects", headers=alice, json={"name": "A"}).json()["id"]
    pb = mu_client.post("/api/projects", headers=bob, json={"name": "B"}).json()["id"]
    sid = upload_to(mu_client, alice, f"/api/projects/{pa}").json()["id"]
    conv = mu_client.post(f"/api/projects/{pa}/assistant/chat", headers=alice,
                          json={"message": "x", "sample_ids": [sid]}).json()["conversation_id"]
    assert mu_client.post(f"/api/projects/{pb}/assistant/chat", headers=bob,
                          json={"message": "x", "conversation_id": conv}).status_code == 404


def test_annotation_records_are_versioned_and_sourced(tmp_path):
    client, settings = client_for(tmp_path)
    with client:
        sid = upload_to(client, H).json()["id"]
        factory = make_session_factory(make_engine(settings.resolved_database_url()))
        with factory() as session:
            session.add(Annotation(sample_id=sid, chromosome="chr1", position=1000, reference="A", alternate="G",
                                   assembly="GRCh38", source="synthetic-test-db", source_version="2024-01",
                                   record_id="SYN-1", retrieved_at=datetime(2025, 1, 2, tzinfo=UTC),
                                   payload={"summary": "synthetic record"}))
            session.commit()
        body = client.post("/api/assistant/chat", headers=H, json={"message": "x", "sample_ids": [sid]}).json()
        assert body["retrieved_evidence"][0]["source_version"] == "2024-01"
        assert body["retrieval_date"].startswith("2025-01-02")
        assert {"id": "synthetic-test-db", "version": "2024-01", "type": "retrieved-annotation"} in body["sources"]


def test_toolbox_denies_other_projects(tmp_path):
    client, settings = client_for(tmp_path)
    with client:
        sid = upload_to(client, H).json()["id"]
        factory = make_session_factory(make_engine(settings.resolved_database_url()))
        with factory() as session:
            with pytest.raises(ToolError):
                Toolbox(session, "other-project").call("get_sample_qc", sample_id=sid)
            assert Toolbox(session, "other-project").call("list_samples") == []
            with pytest.raises(ToolError):
                Toolbox(session, "x").call("drop_tables")


def test_job_lifecycle_runs_in_worker_not_request(tmp_path):
    client, settings = client_for(tmp_path)
    with client:
        sid = upload_to(client, H).json()["id"]
        job = client.post("/api/jobs", headers=H, json={"job_type": "variant_summary", "sample_id": sid})
        assert job.status_code == 201 and job.json()["status"] == "queued"
        assert client.get(f"/api/jobs/{job.json()['id']}", headers=H).json()["status"] == "queued"
        factory = make_session_factory(make_engine(settings.resolved_database_url()))
        assert run_once(factory) == 1
        done = client.get(f"/api/jobs/{job.json()['id']}", headers=H).json()
        assert done["status"] == "completed"
        assert done["result"]["record_count"] == 4 and done["result"]["multiallelic_records"] == 1
        assert run_once(factory) == 0
        assert client.post("/api/jobs", headers=H, json={"job_type": "fastqc", "sample_id": sid}).status_code == 422
        assert client.post("/api/jobs", headers=H, json={"job_type": "variant_summary", "sample_id": "x"}).status_code == 404


def test_failed_job_is_recorded(tmp_path, monkeypatch):
    from app.services import jobs
    client, settings = client_for(tmp_path)
    with client:
        sid = upload_to(client, H).json()["id"]
        client.post("/api/jobs", headers=H, json={"job_type": "variant_summary", "sample_id": sid})
        monkeypatch.setitem(jobs.HANDLERS, "variant_summary", lambda s, j: 1 / 0)
        run_once(make_session_factory(make_engine(settings.resolved_database_url())))
        job = client.get("/api/jobs", headers=H).json()[0]
        assert job["status"] == "failed" and job["error"] and "division" not in job["error"]


def test_fastq_pipeline_is_only_planned(tmp_path):
    client, _ = client_for(tmp_path)
    with client:
        plan = client.get("/api/jobs/pipelines", headers=H).json()
        assert plan["status"] == "planned"
        assert all(s["status"] == "planned" for s in plan["stages"])
        assert client.get("/api/capabilities", headers=H).json()["fastq_processing"] is False
