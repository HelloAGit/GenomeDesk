# Publish the GenomeDesk frontend on Render

The existing backend is `https://genomedesk.onrender.com`. The root `render.yaml` creates **only** a new Node frontend service named `genomedesk-web`; it does not recreate, reset, or change your backend or its SQLite data.

## Backend prerequisite

The current hosted backend returns 503 on protected endpoints because `BACKEND_API_KEY` is unset. In its Render Environment settings, securely set a random backend API key and save/redeploy. Use the same value for the frontend `GENOMEDESK_BACKEND_KEY`. The public `/health` can succeed even when protected APIs are unconfigured. Never use the demo-login password as the backend key.

## Blueprint deployment

1. Push the prepared repository branch to GitHub.
2. In Render, create a **Blueprint** from `HelloAGit/GenomeDesk`, selecting the branch with `render.yaml`.
3. When prompted for `GENOMEDESK_BACKEND_KEY`, securely copy the value of `BACKEND_API_KEY` from the existing backend service's Environment settings. Do not paste it in chat or commit it.
4. Apply the Blueprint. It uses the free frontend plan, Node 24, root directory `web`, build `npm ci --include=dev && npm run build`, start `npm run start:render`, and health check `/health`.
5. After the frontend service is live, open its **actual URL shown by Render**. Render generates `GENOMEDESK_DEMO_PASSWORD`; retrieve it securely in that service's Environment settings. Sign in through the browser's login prompt with username `researcher` and that password.
6. Verify the health indicator, sample library, synthetic import, filters, and deletion. Use synthetic data for the initial demo. Imported samples live in your existing backend, so delete only your own demo samples.

The service name is not proof of a particular assigned URL. Do not assume a public URL until Render has created it. A free frontend can sleep when idle and needs time to start again. Backend storage remains the responsibility of the existing backend service; use a persistent disk to retain data across redeployments.

## Manual service creation

If using Render's New Web Service instead of a Blueprint, select Node (not Docker), the repository/branch containing `web/`, and use the same commands above. Set these server-only variables:

| Variable                   | Value                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| `GENOMEDESK_API_URL`       | `https://genomedesk.onrender.com`                                    |
| `GENOMEDESK_BACKEND_KEY`   | Same secret as backend `BACKEND_API_KEY`                             |
| `GENOMEDESK_DEMO_USER`     | `researcher` or your chosen username (without a colon)               |
| `GENOMEDESK_DEMO_PASSWORD` | Random secret, at least 16 characters; separate from the backend key |
| `NODE_VERSION`             | `24`                                                                 |

Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically. `start:render` binds to `0.0.0.0` and Next.js reads `PORT`. For a custom domain, set `GENOMEDESK_SITE_URL` to the exact HTTPS frontend origin, with no path/query or credentials. This trusted configured origin is used behind Render's TLS proxy for Host and mutation-origin checks. The backend URL is not the frontend site origin.

## Access controls and credentials

Hosted pages and workspace API routes require HTTP Basic authentication over Render's HTTPS endpoint. Without login configuration, requests fail closed (503). Invalid credentials get a login challenge (401). Unexpected hosts and cross-origin mutations are rejected (403). The public frontend `/health` endpoint is process liveness only and exposes no backend data; authenticated `/api/health` checks backend connectivity. Static JS/CSS assets contain no credentials or workspace data.

The REST bridge also checks access directly, before attaching `X-API-Key`. Browser login credentials are never forwarded to FastAPI. Backend and demo keys remain server-side, and Nebius keys remain only in Python. This is a password-protected shared research demo, not multi-user ownership or tenant isolation. All demo users share one backend workspace and can delete its samples. Rotate the demo password to revoke access; browsers may cache Basic credentials until closed. Use individual accounts and authorization before a production multi-user rollout.

## Deploying through the Render API

Direct deployment from this workspace requires a usable `RENDER_API_KEY`, added through secure environment settings and allowed only to `api.render.com`. Never paste an API key in chat. Account ownership, the GitHub branch, backend secret, and the actual created frontend URL must be verified before claiming deployment succeeded. Do not modify the existing backend service to publish the frontend.

## Checks

`npm test`, `npm run typecheck`, and `npm run build` are run from `web/`. Access tests cover login challenge/failure, valid login, fail-closed configuration, hosted reverse-proxy origin, forbidden host and cross-site mutations, direct API access, backend credential separation, and local-development compatibility. Browser regression tests use a temporary backend and do not touch hosted samples or call Nebius.

In Codex cloud, start Node with `NODE_USE_ENV_PROXY=1` so Node 24 uses the injected HTTPS proxy and configured certificate trust. This is needed for cloud-to-Render checks, not for normal Render-to-Render networking. Do not disable TLS verification.
