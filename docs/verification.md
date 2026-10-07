# Verification

Python 3.12: `python -m pytest -q` — 8 tests passed.

Verified authentication, import/filtering/QC semantics, invalid input, reference mismatch, size and record limits, persistence, deletion, missing AI configuration, mocked AI success/error handling, and CORS.

Nebius requests were mocked; no live API key was supplied. Docker deployment and a hosted frontend were not exercised. FASTQ processing and per-user tenancy are not implemented.

## Local Next.js reference application

Validated with Python 3.12 and Node 24:

- Existing backend suite: 8 tests passed; Python application files unchanged.
- Server-side proxy: 13 unit tests passed, including endpoint/method restrictions, private key attachment, supported query forwarding, public health, missing/invalid configuration, origin/host protections, declared and streaming body limits, backend errors, and deletion status.
- All 6 Chromium browser scenarios passed (5 in the suite run, followed by the corrected full-workflow scenario in a targeted rerun): live import/filter/QC/persistence/deletion, invalid files and assembly, mobile navigation, proxy restrictions, pagination reset, and mocked AI draft/error UI.
- TypeScript checks and production build passed.
- Production Next.js server verified against the real backend: page responses, health, authenticated capabilities, synthetic VCF import, QC, PASS filtering, and deletion. The temporary smoke sample was removed.
- The configured backend key was absent from compiled browser assets and page HTML.
- Production dependency audit reported no vulnerabilities.

Browser tests use temporary SQLite data and a test-only key. Live Nebius and hosted multi-user deployment remain untested. No application data is fabricated.

## Render hosting preparation

- 24 unit tests passed (13 REST bridge tests and 11 hosted-access tests).
- All 6 browser regression tests passed in one full run.
- TypeScript and production build passed with the Next.js access proxy.
- Production hosted-mode HTTP checks passed: unauthenticated page/API challenge, valid login, public liveness, backend health forwarding over HTTPS through the cloud proxy, invalid host, and cross-origin mutation rejection.
- The existing Render backend has working public health but protected capabilities returned 503 with `Set BACKEND_API_KEY before using this API`; its backend key must be configured before the dashboard can use sample APIs.
- Public frontend creation is not verified; it requires Render account deployment access.
