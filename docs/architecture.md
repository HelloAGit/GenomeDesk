# Architecture, compatibility assessment and security model

## Dependency / compatibility assessment (v0.1 audit)

| Area | v0.1 finding | v2 action |
|---|---|---|
| Runtime | Python 3.12, FastAPI ≥0.115, pysam 0.23–0.24 (compiled wheels) | Kept; added SQLAlchemy 2, Alembic, psycopg 3 |
| Storage | One SQLite table holding each sample, with all variants, as one JSON document | Normalised tables, indexed variants; documents from the old `genomedesk.sqlite3` are imported once on start |
| Auth | One shared `X-API-Key` | Kept as isolated dev-compat mode; added identity auth + project roles |
| API contract | 7 operations, `docs/openapi.json` | Frozen as `tests/contract/openapi-v0.1.0.json`; CI fails on removed paths/responses or newly required parameters. Additions are additive (new optional response keys such as `quality_histogram`, `source_format`, `project_id`) |
| CI / tests | No workflows; 8 tests | Ruff, pytest, OpenAPI check, frontend, pip-audit, npm audit, gitleaks, Docker builds |
| Known risk | Multipart bodies are parsed before the size check | Still true: enforce body limits at the reverse proxy |

`app/store.py` (old JSON store) is no longer used by the app; `app/vcf.py` re-exports `app.bioinformatics.vcf`.

## Components

- `app/api`: dependencies (auth, project scoping), routers (`scoped.py` is mounted at `/api` for compat mode and `/api/projects/{project_id}` for users), rate-limit middleware.
- `app/db`: SQLAlchemy models, engine/session helpers, legacy import. SQLite tables are auto-created; PostgreSQL deployments run `alembic upgrade head`.
- `app/services`: samples/dashboard/exports, jobs, audit, users, retention.
- `app/bioinformatics`: VCF/VCF.gz validation and parsing.
- `app/ai`: project-scoped tools, annotation provider abstraction, assistant.
- `app/workers`: separate worker process (`python -m app.workers.worker`); HTTP handlers only enqueue.

## Data model

users, projects, project_memberships, samples (aggregate summary JSON only), variants (one row each; indexes on sample/chromosome/position, sample/ordinal, sample/PASS, sample/quality, chromosome/position), analysis_jobs (planned/queued/running/completed/failed + provenance), research_reports, annotations (source, version, record id, retrieval time), audit_events, conversations, conversation_messages.

## Security model

- Tokens: HMAC-SHA256 signed, expiring; passwords: scrypt. `AUTH_SECRET_KEY` (≥32 chars) enables identity auth; registration is closed by default (`python -m app.auth.cli`).
- Authorization: every project route resolves membership first; non-members get 404, insufficient role 403 (viewer read/assist, editor write, owner manage/delete/purge). Assistant tools take the project id from the request context, never from model output.
- Audit events never hold genomic content or secrets. Retention: delete sample/project, `POST /api/projects/{id}/retention/purge`, or `python -m app.services.retention` using `SAMPLE_RETENTION_DAYS`/`AUDIT_RETENTION_DAYS`.
- Not done: encrypted-at-rest storage, token revocation, distributed rate limiting, per-user quotas, login UI in the frontend, MFA.

## Async jobs and planned FASTQ pipeline

Only `variant_summary` is executable. FASTQ stages (FastQC 0.12.1, MultiQC 1.25.1, nf-core/sarek 3.5.1 on Nextflow 24.10.4) are exposed read-only at `/api/jobs/pipelines` with status `planned`; these pins are design intentions that have not been validated by an end-to-end run, so FASTQ/alignment must not be considered operational.
