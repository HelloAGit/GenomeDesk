from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.auth.security import issue_token, verify_token
from app.config import Settings
from app.db.models import AuditEvent
from app.main import create_app
from app.services.retention import purge_expired
from tests.conftest import SECRET, register_login, upload_to

LEGACY = {"X-API-Key": "test-secret"}


def make_project(client, headers, name="P"):
    response = client.post("/api/projects", headers=headers, json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_registration_closed_and_disabled(tmp_path):
    closed = Settings(_env_file=None, data_dir=str(tmp_path / "a"), auth_secret_key=SECRET)
    with TestClient(create_app(closed)) as client:
        body = {"email": "a@example.org", "display_name": "a", "password": "x" * 12}
        assert client.post("/api/auth/register", json=body).status_code == 403
    off = Settings(_env_file=None, data_dir=str(tmp_path / "b"), backend_api_key="k")
    with TestClient(create_app(off)) as client:
        assert client.post("/api/auth/login", json={"email": "a@example.org", "password": "x"}).status_code == 503


def test_login_failures_and_token_tampering(mu_client):
    register_login(mu_client, "alice@example.org")
    bad = mu_client.post("/api/auth/login", json={"email": "alice@example.org", "password": "wrong-password"})
    assert bad.status_code == 401
    assert mu_client.post("/api/auth/login", json={"email": "nobody@example.org", "password": "x"}).status_code == 401
    assert mu_client.get("/api/projects", headers={"Authorization": " ".join(["Bearer", "not-a-real-token"])}).status_code == 401
    expired = issue_token("u", SECRET, 1, now=0)
    assert verify_token(expired, SECRET) is None
    assert verify_token(issue_token("u", SECRET, 5), "another-secret-another-secret-123456") is None


def test_cross_project_access_denied(mu_client):
    alice = register_login(mu_client, "alice@example.org")
    bob = register_login(mu_client, "bob@example.org")
    pa, pb = make_project(mu_client, alice, "A"), make_project(mu_client, bob, "B")
    sample_id = upload_to(mu_client, alice, f"/api/projects/{pa}").json()["id"]

    base = f"/api/projects/{pa}"
    for path in ("/samples", f"/samples/{sample_id}", f"/samples/{sample_id}/variants",
                 f"/samples/{sample_id}/qc", "/dashboard", "/jobs", "/reports", "/audit"):
        assert mu_client.get(f"{base}{path}", headers=bob).status_code == 404, path
    assert upload_to(mu_client, bob, base).status_code == 404
    assert mu_client.delete(f"{base}/samples/{sample_id}", headers=bob).status_code == 404
    assert mu_client.delete(base, headers=bob).status_code == 404
    # A sample id from another project is not reachable through one's own project path.
    assert mu_client.get(f"/api/projects/{pb}/samples/{sample_id}", headers=bob).status_code == 404
    assert mu_client.post(f"/api/projects/{pb}/jobs", headers=bob,
                          json={"job_type": "variant_summary", "sample_id": sample_id}).status_code == 404
    assert mu_client.post(f"/api/projects/{pb}/assistant/chat", headers=bob,
                          json={"message": "hi", "sample_ids": [sample_id]}).status_code == 404
    assert [p["id"] for p in mu_client.get("/api/projects", headers=bob).json()] == [pb]
    # Tokens cannot use the dev default-project routes; the API key cannot see user projects.
    assert mu_client.get("/api/samples", headers=alice).status_code == 403
    assert mu_client.get(f"{base}/samples", headers=LEGACY).status_code == 404
    assert mu_client.get("/api/samples", headers=LEGACY).json() == []


def test_roles(mu_client):
    alice = register_login(mu_client, "alice@example.org")
    bob = register_login(mu_client, "bob@example.org")
    pa = make_project(mu_client, alice)
    base = f"/api/projects/{pa}"
    assert mu_client.post(f"{base}/members", headers=bob, json={"email": "bob@example.org", "role": "viewer"}).status_code == 404
    assert mu_client.post(f"{base}/members", headers=alice, json={"email": "bob@example.org", "role": "viewer"}).status_code == 201
    sample_id = upload_to(mu_client, alice, base).json()["id"]
    assert mu_client.get(f"{base}/samples/{sample_id}", headers=bob).status_code == 200
    assert upload_to(mu_client, bob, base).status_code == 403
    assert mu_client.delete(f"{base}/samples/{sample_id}", headers=bob).status_code == 403
    assert mu_client.get(f"{base}/audit", headers=bob).status_code == 403
    mu_client.post(f"{base}/members", headers=alice, json={"email": "bob@example.org", "role": "editor"})
    assert upload_to(mu_client, bob, base).status_code == 201
    assert mu_client.delete(base, headers=bob).status_code == 403


def test_audit_and_project_deletion(mu_client, mu_settings):
    alice = register_login(mu_client, "alice@example.org")
    pa = make_project(mu_client, alice)
    base = f"/api/projects/{pa}"
    sample_id = upload_to(mu_client, alice, base).json()["id"]
    mu_client.delete(f"{base}/samples/{sample_id}", headers=alice)
    actions = [e["action"] for e in mu_client.get(f"{base}/audit", headers=alice).json()]
    assert "sample.import" in actions and "sample.delete" in actions and "project.create" in actions
    assert mu_client.delete(base, headers=alice).status_code == 204
    assert mu_client.get(base + "/samples", headers=alice).status_code == 404
    assert mu_client.delete("/api/projects/00000000-0000-0000-0000-000000000001", headers=LEGACY).status_code == 409


def test_legacy_mode_isolated_and_disableable(tmp_path):
    settings = Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path),
                        legacy_api_key_enabled=False, auth_secret_key=SECRET)
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/samples", headers=LEGACY).status_code == 401
    with TestClient(create_app(Settings(_env_file=None, data_dir=str(tmp_path / "x")))) as client:
        assert client.get("/api/samples").status_code == 503
    legacy = Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path / "y"))
    with TestClient(create_app(legacy)) as client:
        caps = client.get("/api/capabilities", headers=LEGACY).json()
        assert caps["authentication"] == "single-workspace-server-key"
        assert client.post("/api/projects", headers=LEGACY, json={"name": "x"}).status_code == 403


def test_rate_limits(tmp_path):
    settings = Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path),
                        rate_limit_per_minute=3, auth_rate_limit_per_minute=2, auth_secret_key=SECRET)
    with TestClient(create_app(settings)) as client:
        codes = [client.get("/api/samples", headers=LEGACY).status_code for _ in range(5)]
        assert codes == [200, 200, 200, 429, 429]
        assert client.get("/health").status_code == 200
        login = [client.post("/api/auth/login", json={"email": "a@example.org", "password": "x"}).status_code
                 for _ in range(3)]
        assert login == [401, 401, 429]


def test_request_validation(mu_client):
    alice = register_login(mu_client, "alice@example.org")
    assert mu_client.post("/api/projects", headers=alice, json={"name": ""}).status_code == 422
    assert mu_client.post("/api/auth/register", json={"email": "bad", "display_name": "x", "password": "long-enough-pw"}).status_code == 422


def test_retention_purge(mu_client, mu_settings):
    alice = register_login(mu_client, "alice@example.org")
    pa = make_project(mu_client, alice)
    base = f"/api/projects/{pa}"
    upload_to(mu_client, alice, base)
    assert mu_client.post(f"{base}/retention/purge", headers=alice, json={"older_than_days": 1}).json() == {"samples_deleted": 0}
    assert mu_client.post(f"{base}/retention/purge", headers=alice, json={"older_than_days": 0}).status_code == 422
    from app.db.session import make_engine, make_session_factory
    factory = make_session_factory(make_engine(mu_settings.resolved_database_url()))
    with factory() as session:
        for sample_id in [s["id"] for s in mu_client.get(f"{base}/samples", headers=alice).json()]:
            from app.db.models import Sample
            session.get(Sample, sample_id).created_at = datetime.now(UTC) - timedelta(days=40)
        session.commit()
        old_event = AuditEvent(actor="x", action="old", created_at=datetime.now(UTC) - timedelta(days=400))
        session.add(old_event)
        session.commit()
        result = purge_expired(session, sample_days=30, audit_days=365)
    assert result == {"samples_deleted": 1, "audit_events_deleted": 1}
    assert mu_client.get(f"{base}/samples", headers=alice).json() == []
