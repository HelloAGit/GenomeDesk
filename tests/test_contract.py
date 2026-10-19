import json

from app.config import Settings
from app.main import create_app
from scripts.check_openapi_compat import BASELINE, compare


def test_v1_contract_preserved(tmp_path):
    new = create_app(Settings(_env_file=None, data_dir=str(tmp_path))).openapi()
    assert compare(json.loads(BASELINE.read_text()), new) == []


def test_compat_checker_detects_breaking_changes(tmp_path):
    old = json.loads(BASELINE.read_text())
    new = create_app(Settings(_env_file=None, data_dir=str(tmp_path))).openapi()
    del new["paths"]["/api/samples/{sample_id}/qc"]
    assert any("removed" in p for p in compare(old, new))
