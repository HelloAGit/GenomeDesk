"""Isolated live backend for browser tests: temporary SQLite, no live AI."""
import os
import subprocess
import tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="genomedesk-e2e-") as data:
    environment = dict(os.environ, BACKEND_API_KEY="e2e-local-only-key", DATA_DIR=data,
                       NEBIUS_API_KEY="", NEBIUS_MODEL="")
    result = subprocess.run([str(root / ".venv/bin/python"), "-m", "uvicorn", "app.main:app",
                             "--host", "127.0.0.1", "--port", "8011"], cwd=root, env=environment)
    raise SystemExit(result.returncode)
