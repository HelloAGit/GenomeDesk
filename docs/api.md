# API summary

Interactive reference: `/docs`. Auth: `X-API-Key` (dev compatibility mode, default project) **or** `Authorization: ****** from `POST /api/auth/login` (project routes under `/api/projects/{project_id}`).

## v0.1 endpoints (unchanged)
`GET /health`, `GET /api/capabilities`, `POST/GET /api/samples`, `GET/DELETE /api/samples/{id}`, `GET /api/samples/{id}/variants`, `GET /api/samples/{id}/qc`, `POST /api/samples/{id}/explain`.
Additive changes: `.vcf.gz` accepted; extra optional filters `ref`, `alt`; extra response keys (`project_id`, `source_format`, `quality_histogram`, capability flags).

## New endpoints (each also available as `/api/projects/{project_id}/...`)
| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard` | Computed project metrics, chromosome/quality distributions, sample comparison, research history |
| `GET /api/samples/{id}/variants/export?format=csv\|json` | Filtered variant download |
| `GET /api/samples/{id}/summary?format=csv\|json` | QC summary download |
| `GET/POST /api/jobs`, `GET /api/jobs/{id}`, `GET /api/jobs/pipelines` | Async jobs (worker-executed); planned FASTQ design |
| `GET /api/assistant/status`, `POST /api/assistant/chat`, `POST /api/assistant/summary` | Assistant |
| `GET /api/reports` | Saved research summaries |

Identity routes: `POST /api/auth/register` (closed by default), `POST /api/auth/login`, `GET /api/auth/me`, `GET/POST /api/projects`, `DELETE /api/projects/{id}`, `POST /api/projects/{id}/members`, `GET /api/projects/{id}/audit`, `POST /api/projects/{id}/retention/purge`.

Assistant response: `status` (`ok`, `unavailable`, `provider_error`, `no_data`), `direct_measurements`, `retrieved_evidence`, `interpretation` (model text, labelled), `sources`, `retrieval_date`, `limitations`, `disclaimer`, `tools_used`, `conversation_id`.
