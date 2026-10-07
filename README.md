# GenomeDesk

Genomic Sequence Read — A research-use genomic variant explorer with a FastAPI backend, a local reference web application, and optional Nebius Token Factory explanations. Connect your own frontend/dashboard platform through REST. This is a small-file VCF prototype designed for efficient variant analysis and metadata exploration.

## Features

- **Uncompressed VCF Import**: Using pysam with GRCh37/GRCh38 selection and declared-reference provenance.
- **Persistent Storage**: SQLite database with variant filtering, pagination, aggregate metrics, and deletion support.
- **Secure API**: Authenticated endpoints, explicit CORS origins, configurable upload/record limits, and automatic cleanup of temporary inputs.
- **Optional AI Integration**: Real Nebius chat-completion integration for variant explanations (no fabricated AI fallback).
- **DevOps Ready**: Docker Compose, automated test suite, GitHub Actions CI/CD, synthetic test fixtures, and OpenAPI contract documentation.

## Getting Started

### Requirements

- Python 3.11+ (3.12 recommended)

### Installation & Setup

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

Generate a secure API key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Add the generated key to `.env` as `BACKEND_API_KEY`.

### Running Locally

**Option 1: Direct with uvicorn**

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://localhost:8000/docs and select **Authorize** to enter your backend key. Upload `examples/synthetic.vcf` with assembly `GRCh38` and a synthetic sample name. The `/health` endpoint is public; all `/api/*` endpoints require authentication.

**Option 2: Docker Compose**

```bash
docker compose up --build
```

The named Docker volume persists imported data across restarts. Remove the volume to reset the database.

## Nebius Token Factory Integration

To enable variant explanations via Nebius:

| Component | Action |
|-----------|--------|
| `.env` | Set `NEBIUS_API_KEY` to your Token Factory secret |
| `.env` | Set `NEBIUS_MODEL` to an exact model ID in your account |
| `app/nebius.py` | Calls `https://api.tokenfactory.nebius.com/v1/` (fixed endpoint) |
| `POST /api/samples/{id}/explain` | Only endpoint that requires Nebius |
| Hosting environment | Configure the same environment variables on your backend host |

**Setup**: Create/access your account at https://tokenfactory.nebius.com and consult https://api.tokenfactory.nebius.com/docs. The OpenAI SDK is compatible with the Nebius endpoint; no separate OpenAI account or key is needed.

## Frontend Integration

See [docs/frontend-integration.md](docs/frontend-integration.md) for detailed frontend setup.

**Key Configuration**: Set `CORS_ORIGINS` with your exact frontend origin (including scheme and port). Protect both the Nebius key and the shared backend API key as secrets.

## Testing

```bash
python -m pytest -q
```

## Documentation

- **Roadmap & FASTQ Pipeline**: See [docs/roadmap.md](docs/roadmap.md)
- **Deployment & Hosting**: See hosting requirements in [docs/roadmap.md](docs/roadmap.md)

## Development Notes

Dependencies use bounded version ranges for flexibility. Lock a tested environment before production deployment.

## License

See repository for licensing details.

## Local reference web application

A complete interactive reference frontend is available in `web/`, built with Next.js, TypeScript, Tailwind CSS, Recharts, and Lucide icons. It connects to the existing FastAPI backend through server-side route handlers, keeping both backend and Nebius credentials out of browser code.

Start the backend as above, then:

```bash
cd web
npm ci
cp .env.example .env.local
# Set GENOMEDESK_BACKEND_KEY to the backend's BACKEND_API_KEY in .env.local.
npm run dev
```

The local site provides an overview, searchable sample library, VCF import (including the synthetic fixture), variant filtering/pagination, QC charts, provenance, optional AI drafts, deletion confirmation, and an API integration guide. It binds to loopback and is intended for local research/demo use. See [local reference setup and blueprint](docs/local-reference.md) for configuration, security boundaries, and tests.

## Public Render demo

A frontend-only Render Blueprint is provided in `render.yaml`. It connects to the existing backend at `https://genomedesk.onrender.com`, adds a shared demo login, and uses a public frontend health check. See [Render deployment instructions](docs/render-deployment.md) for secure settings and publishing.
