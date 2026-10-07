# Local reference web application

`web/` is a Next.js App Router + TypeScript + Tailwind + Recharts reference frontend for the existing FastAPI backend. It is a single-workspace research demo with optional password-protected Render hosting, not a multi-user service. No backend architecture or endpoints were changed.

## Start locally

Python 3.12 and Node 20.9+ are required (Node 22 or 24 recommended).

From the repository root:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

Configure the backend `.env` with a generated `BACKEND_API_KEY`. Use a JSON array for CORS, such as `CORS_ORIGINS=["http://localhost:3000"]`. Leave Nebius credentials unset unless you intend to use live explanations. The web proxy does not need browser-to-backend CORS.

```bash
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd web
npm ci
cp .env.example .env.local
# Securely edit .env.local: set GENOMEDESK_BACKEND_KEY to the backend's BACKEND_API_KEY.
npm run dev
```

Open the local site on port 3000. Both processes bind to loopback by default. Changes to `web/.env.local` require restarting Next.js. The backend keeps SQLite data in `data/`; restarting either process preserves imports.

## Connection and credential boundaries

Browser → same-origin Next.js `/api/*` → FastAPI `/api/*` → SQLite. `/api/health` maps to FastAPI `/health`. The Next route handler has an explicit endpoint/method allowlist and supports only known variant query parameters. It adds `X-API-Key` using server-only `GENOMEDESK_BACKEND_KEY`; browser code never receives it. Do not prefix keys with `NEXT_PUBLIC_`. Redirects are rejected, responses are uncached, local Host headers are restricted to loopback names to reject DNS rebinding, mutations reject cross-origin browser requests, and multipart bodies are streamed with a size cap. `GENOMEDESK_MAX_BODY_BYTES` defaults to 12 MiB including multipart overhead; adjust it along with the backend file limit for larger allowed files. The backend independently enforces its file and record limits.

Keep Nebius credentials only in the Python environment. The browser requests `/api/samples/{id}/explain`; Python sends aggregate QC only to Nebius. There is no fake AI fallback. If missing configuration is reported, the UI disables generation. Actual provider failures are displayed as errors. Explanation text is rendered as escaped plain text, not HTML or Markdown.

Local development requires no login and accepts only loopback hosts. Hosted mode requires a separate shared demo username/password and an exact HTTPS site origin. The hosted demo has one shared workspace, not per-user ownership; CORS and a shared key do not isolate users. See [Render deployment](render-deployment.md) for the implemented hosted access controls.

## Interface and API mapping

| Screen            | API inputs                          | Behavior                                                                                    |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Overview          | samples, capabilities, health       | Real sample counts, record/PASS totals, chromosome distribution, recent samples             |
| Sample library    | samples                             | Client-side name/assembly search and manual refresh                                         |
| Import            | capabilities, multipart sample POST | File/size validation, assembly selection, name, synthetic example, loading/error states     |
| Sample detail     | sample, QC, variants                | Metrics, provenance, checksum, chromosome chart, server-side variant filters and pagination |
| Explanation       | explain POST                        | Explicit generation, availability flag, review-required draft and source metrics            |
| Delete            | sample DELETE                       | Confirmation, irreversible deletion, return to updated library                              |
| Integration guide | static contract reference           | Existing endpoints, security boundaries, reproduction example and metric semantics          |

The bundled synthetic file is an exact copy of `examples/synthetic.vcf`; it is not imported automatically. No dashboard values are fabricated. Empty, loading, API error, no-match, and missing-AI states are distinct. A stale or missing sample produces the actual backend error.

Quality/depth nulls render as “Unavailable.” INFO/DP is site-level depth, not genome-wide coverage. FILTER `.` is unfiltered, not PASS. ALT arrays stay together. Each variant row is one VCF record. No annotation, clinical interpretation, gene filtering, FASTQ pipeline, or tenancy is implied.

## Validation

```bash
# Repository root
.venv/bin/python -m pytest -q
# web/
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start a real FastAPI process on port 8011 with temporary SQLite storage and a test-only key, and a Next.js process on port 3011. They do not use or delete workspace data or call Nebius. These ports must be free. The Python `.venv` is required. Tests cover import, filters, missing metrics, multiallelic ALT, refresh/persistence, deletion/cancellation, invalid files/assembly, responsive navigation, and proxy restrictions. Proxy unit tests verify endpoint allowlisting, private key attachment, validation errors, upload limit, health mapping, deletion status, and unavailable backend behavior.

If browser downloads are restricted but Chromium is already installed, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.

The production build can be started with `npm start` after configuring `.env.local` and running FastAPI separately. Dependencies are locked in `web/package-lock.json`; Node dependencies stay under `web/`.

## Blueprint for another platform

Reproduce the data types in `web/types/api.ts`, endpoint whitelist and key handling in `web/lib/proxy.ts`, and UI state transitions above. Fetch sample metadata and QC together, then fetch variants independently as filters or pagination change. Reset offset on filter changes and cancel obsolete variant requests. Use backend totals for pagination. Propagate status codes and meaningful errors instead of showing mock success. After deletion, refresh the library. Check capabilities before presenting unsupported functions or AI generation.

## Connect the local frontend to the Render backend

The existing backend is at `https://genomedesk.onrender.com`. To use it from the local reference site, configure `web/.env.local`:

```dotenv
GENOMEDESK_API_URL=https://genomedesk.onrender.com
GENOMEDESK_BACKEND_KEY=
```

Securely set `GENOMEDESK_BACKEND_KEY` to the **same value** as `BACKEND_API_KEY` in the Render backend service's Environment settings. A locally generated development key is not necessarily the deployed key. Do not paste the key in chat, commit it, or use a `NEXT_PUBLIC_` prefix. No Nebius key belongs in the frontend.

Restart Next.js from `web/` with `npm run dev`. The local site calls its own Next.js server, which forwards the requests over HTTPS to Render. The Python backend does not need to run locally in this mode. Browser-to-Render CORS is unnecessary because these are server-to-server calls.

Check the local web proxy's `/api/health` for backend health, then `/api/capabilities` for authenticated access. A 401 means the backend key differs; a 503 indicates missing configuration; a 502 can indicate networking, startup delays, or backend unavailability. Use the deployed backend's `/health` as Render's backend health check path; its `/` is not a homepage.

This connects the **local frontend** to the hosted backend. It does not publish a frontend web service. To publish it, use the tested frontend-only Blueprint and hosted login described in [Render deployment](render-deployment.md). The Render frontend build uses root directory `web`, build command `npm ci && npm run build`, and start command `npx next start --hostname 0.0.0.0 --port $PORT`. Set the same two server-only variables in that frontend service's Environment settings.
