# Verification

Python 3.12: `python -m pytest -q` — 40 passed, 1 skipped (PostgreSQL migration test runs only when `TEST_DATABASE_URL` is set, as in CI). The original 8 v0.1 tests are unchanged and pass.

Verified authentication, import/filtering/QC semantics, invalid input, reference mismatch, size and record limits, persistence, deletion, missing AI configuration, mocked AI success/error handling, and CORS.

Nebius requests were mocked; no live API key was supplied. Docker deployment and a hosted frontend were not exercised. FASTQ processing and per-user tenancy are not implemented.
