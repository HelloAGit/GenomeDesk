# GenomeDesk

Genomic Sequence Read — A research-use, API-only genomic variant explorer with optional Nebius Token Factory explanations. Connect your own frontend/dashboard platform through REST. This is a small-file VCF prototype designed for efficient variant analysis and metadata exploration.

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
