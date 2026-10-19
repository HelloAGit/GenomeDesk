import type { NextRequest } from 'next/server';

function denied(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function siteOrigin(): URL | null {
  const configured =
    process.env.GENOMEDESK_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!configured) {
    if (process.env.RENDER === 'true' || process.env.VERCEL === '1') throw new Error('Hosted origin missing');
    return null;
  }
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Hosted origin must be an HTTPS origin');
  return url;
}
// Public demo: no browser credentials are required. Host and same-origin checks remain.
// Also called by the REST bridge. The backend X-API-Key is added server-side only.
export function access(request: NextRequest): Response | null {
  let hosted: URL | null;
  let incoming: URL;
  try {
    hosted = siteOrigin();
    incoming = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`);
  } catch { return denied('Invalid site origin configuration.', 503); }
  if (hosted) {
    if (incoming.host !== hosted.host) return denied('This hostname is not allowed.', 403);
  } else if (!['localhost', '127.0.0.1', '[::1]'].includes(incoming.hostname)) {
    return denied('This reference application accepts local requests only.', 403);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== (hosted || incoming).origin) return denied('Cross-origin mutations are not permitted.', 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return denied('Cross-site mutations are not permitted.', 403);
  }
  return null;
}
