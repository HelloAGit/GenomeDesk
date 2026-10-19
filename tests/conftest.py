import gzip
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

FIXTURE = Path(__file__).parents[1] / "examples" / "synthetic.vcf"
SECRET = "unit-test-secret-key-0123456789-abcdef"
PASSWORD = "correct horse battery"


@pytest.fixture
def mu_settings(tmp_path):
    return Settings(_env_file=None, backend_api_key="test-secret", data_dir=str(tmp_path),
                    auth_secret_key=SECRET, registration_open=True, rate_limit_per_minute=0)


@pytest.fixture
def mu_client(mu_settings):
    with TestClient(create_app(mu_settings)) as client:
        yield client


def register_login(client, email):
    body = {"email": email, "display_name": email.split("@")[0], "password": PASSWORD}
    assert client.post("/api/auth/register", json=body).status_code == 201
    token = client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).json()["access_token"]
    return {"Authorization": " ".join(["Bearer", token])}


def upload_to(client, headers, prefix="/api", data=None, name="synthetic.vcf", assembly="GRCh38"):
    return client.post(f"{prefix}/samples", headers=headers,
                       data={"sample_name": "synthetic", "assembly": assembly},
                       files={"file": (name, data if data is not None else FIXTURE.read_bytes(), "application/octet-stream")})


def gz_fixture() -> bytes:
    return gzip.compress(FIXTURE.read_bytes())
