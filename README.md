# GenomeDesk Backend

Research-use, API-only genomic variant explorer with optional Nebius Token Factory explanations. Connect your own frontend/dashboard platform through REST. This is a small-file VCF prototype, not a deployed clinical product or a FASTQ sequencing pipeline.

## Included

- Uncompressed VCF import using pysam; GRCh37/GRCh38 selection and declared-reference provenance.
- Persistent SQLite storage, variant filtering/pagination, aggregate chart-ready metrics, deletion.
- Authenticated API, explicit CORS origins, upload/record limits, temporary input cleanup.
- Optional real Nebius chat-completion integration. No fabricated AI fallback.
- Docker Compose, automated tests, GitHub Actions, synthetic fixture, OpenAPI contract.

## Run locally

Requires Python 3.11+ (3.12 recommended).

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put the generated value in `.env` as `BACKEND_API_KEY`, then:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://localhost:8000/docs and select **Authorize** to enter your backend key. Upload `examples/synthetic.vcf` with assembly `GRCh38` and a synthetic sample name. `/health` is public; all `/api` endpoints require `X-API-Key`.

Alternatively: `docker compose up --build` after configuring `.env`. The named Docker volume persists imported data. Removing that volume deletes it.

## Where Nebius is required

| Location | Required action |
|---|---|
| `.env` | Set `NEBIUS_API_KEY` to your Token Factory secret |
| `.env` | Set `NEBIUS_MODEL` to an exact model ID in your account |
| `app/nebius.py` | Actual API call, fixed `https://api.tokenfactory.nebius.com/v1/` base URL |
| `POST /api/samples/{id}/explain` | Only endpoint that requires and calls Nebius |
| Hosting secret settings | Configure the same variables on the backend host |

Create/access your account at https://tokenfactory.nebius.com and consult https://api.tokenfactory.nebius.com/docs. A separate OpenAI account or key is not required: the OpenAI SDK is the compatible client library. Without Nebius credentials, every non-AI endpoint still works; explanation requests return 503. AI output is unverified draft text and includes source metrics for review. Calls can incur provider charges. The repository contains no live key and tests do not call Nebius.

## Connect another frontend

See [docs/frontend-integration.md](docs/frontend-integration.md). Configure `CORS_ORIGINS` with your exact frontend origin, including scheme and port. Keep both the Nebius key and the shared backend key in server-side secrets. Use your frontend platform's server functions/proxy to call this API. Do not put shared keys in browser bundles or `NEXT_PUBLIC_` variables.

## Create the GitHub repository

This package is ready to push; it does not create a remote repository automatically. With GitHub CLI installed and authenticated:

```bash
git init -b main
git add .
git commit -m "Initial GenomeDesk backend prototype"
gh auth login
gh repo create genomedesk-backend --private --source=. --remote=origin --push
```

Or create an empty private repository at https://github.com/new, then:

```bash
git init -b main
git add .
git commit -m "Initial GenomeDesk backend prototype"
git remote add origin https://github.com/YOUR_USERNAME/genomedesk-backend.git
git push -u origin main
```

If the extracted package already has a Git repository, skip `git init`. Never commit `.env`, real genomic data or database files.

## Verify

```bash
python -m pytest -q
```

See [docs/roadmap.md](docs/roadmap.md) for the FASTQ pipeline and hosting requirements. Dependencies use bounded ranges rather than a reproducible lockfile; resolve and lock a tested environment before a production rollout.
