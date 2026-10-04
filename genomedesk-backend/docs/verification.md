# Verification

Python 3.12: `python -m pytest -q` — 8 tests passed.

Verified authentication, import/filtering/QC semantics, invalid input, reference mismatch, size and record limits, persistence, deletion, missing AI configuration, mocked AI success/error handling, and CORS.

Nebius requests were mocked; no live API key was supplied. Docker deployment and a hosted frontend were not exercised. FASTQ processing and per-user tenancy are not implemented.
