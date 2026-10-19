# Deploy the GenomeDesk frontend to Vercel

## Architecture and prerequisites

Deploy `web/` as a Next.js application. The Python FastAPI backend is a separate service; this repository's backend uses SQLite and needs persistent writable storage, so it is not configured for Vercel's serverless runtime. Keep the backend on a host with persistent storage and an HTTPS URL.

You need a Vercel account connected to this repository and a running backend with `BACKEND_API_KEY` configured. The browser calls same-origin Next.js route handlers, which proxy the allowlisted API requests to FastAPI and attach the backend key server-side. Browser-to-backend CORS is not required.

## Vercel project setup

1. Import `HelloAGit/GenomeDesk` into Vercel and select the deployment branch.
2. Set **Root Directory** to `web` (leave “Include files outside the root directory” disabled).
3. Keep the detected **Next.js** framework and defaults: install `npm install`, build `npm run build`, and output `.next`. `web/vercel.json` identifies the framework; Next.js handles page routes, `/health`, and the `/api/*` proxy routes, so no SPA rewrites or custom output directory are needed.
4. Add the environment variables below in the Vercel project's **Settings → Environment Variables** for each environment you deploy. Redeploy after changing them.

| Variable | Required | Value |
| --- | --- | --- |
| `GENOMEDESK_API_URL` | Yes | Backend origin, for example `https://your-backend.example` (no path). |
| `GENOMEDESK_BACKEND_KEY` | Yes | The same secret value as the backend's `BACKEND_API_KEY`. Mark it sensitive; never use a `NEXT_PUBLIC_` prefix. |
| `GENOMEDESK_SITE_URL` | Only for a custom domain or alias not covered by Vercel's system URLs | The exact HTTPS origin users visit, such as `https://genomedesk.example.com`, with no path. The app uses `VERCEL_PROJECT_PRODUCTION_URL` for the production alias and `VERCEL_URL` for preview deployments. |
| `GENOMEDESK_MAX_BODY_BYTES` | Optional | Maximum proxied multipart request size. For Vercel, keep it at or below `4194304` bytes. |

Set `BACKEND_API_KEY` only in the backend host's secret settings. If AI explanations are enabled, configure `NEBIUS_API_KEY` and `NEBIUS_MODEL` on the backend only. Do not add either backend secret to browser-visible variables. There is no need to configure `CORS_ORIGINS` for this server-to-server proxy.

Vercel's system environment variables must be enabled for the project. The production project URL or preview deployment URL is used for origin checks automatically. Set `GENOMEDESK_SITE_URL` when serving the app from a custom domain or alias not covered by those URLs so host and same-origin mutation checks match that domain.

## Deployment constraints and access

Vercel Functions limit request and response bodies to 4.5 MB. The app's backend can accept larger VCF files, but uploads through the Vercel proxy must fit within that platform limit, including multipart overhead; larger files will be rejected before reaching the app. This limit cannot be increased by changing `GENOMEDESK_MAX_BODY_BYTES`. Supporting larger uploads requires a different upload architecture or a frontend host that permits the required body size.

Keep the Python API on a platform that supports persistent storage; Vercel is configured here for the frontend only. Function execution limits also apply to long-running backend requests such as explanations, so verify that the selected Vercel plan's function duration is adequate.

The current reference app has a shared workspace and no browser login. Anyone who can reach an unprotected deployment can use its frontend to read, import, and delete data in that shared backend workspace. Enable Vercel Deployment Protection or an equivalent access-control layer before sharing a deployment; this frontend proxy is not per-user authorization or tenant isolation.

## Verify the deployment

1. Open the deployment URL and check that the frontend loads over HTTPS.
2. Open `/health` and confirm it returns a `200` response; this only checks frontend process liveness.
3. Check the backend connection in the app (or request `/api/health`) and confirm authenticated capabilities load. A `503` can indicate missing Vercel variables or backend key configuration; a `502` usually indicates the backend is unreachable.
4. Verify the sample library and, with a small synthetic VCF that fits the Vercel body limit, test import, filtering, and deletion. Avoid using real genomic data for initial verification.

For local setup and the frontend/backend credential boundary, see [local reference setup](local-reference.md).
