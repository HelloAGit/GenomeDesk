# GenomeDesk frontend

Next.js 15 (App Router) + TypeScript + Tailwind + Recharts + TanStack Table.

```bash
cp .env.example .env.local   # set BACKEND_API_KEY / GENOMEDESK_API_URL
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

## Security model
- The backend API key lives only in server env (`BACKEND_API_KEY`). The browser talks
  exclusively to `/api/proxy/...` (`app/api/proxy/[...path]/route.ts`), which adds
  `X-API-Key` and forwards an allow-list (`api/*`, `health`) to `GENOMEDESK_API_URL`.
- Server components call the backend directly through `lib/api.ts`.
- This is the backend's *dev API-key compatibility mode*; the UI says so on `/projects`.

## Demo mode
Enable with `?demo=1` (disable `?demo=0`) or the header toggle (cookie `gd_demo=1`).
Synthetic data in `lib/demo.ts` is shown only while demo mode is on, under a persistent banner.

Research and development use only; not a validated clinical diagnostic device.
