import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

function denied(detail: string, status: number, challenge = false) {
  return Response.json({ detail }, { status, headers: {
    'Cache-Control': 'no-store',
    ...(challenge ? { 'WWW-Authenticate': 'Basic realm="GenomeDesk research demo", charset="UTF-8"' } : {}),
  } });
}
export function siteOrigin(): URL | null {
  const configured = process.env.GENOMEDESK_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!configured) {
    if (process.env.RENDER === 'true') throw new Error('Hosted origin missing');
    return null;
  }
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Hosted origin must be an HTTPS origin');
  return url;
}
function sameSecret(actual: string, expected: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(actual), hash(expected));
}
// Also called by the REST bridge, so it remains protected even without Next's proxy.
export function access(request: NextRequest): Response | null {
  let hosted: URL | null;
  let incoming: URL;
  try {
    hosted = siteOrigin();
    incoming = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`);
  } catch { return denied('Invalid site origin configuration.', 503); }
  if (hosted) {
    if (incoming.host !== hosted.host) return denied('This hostname is not allowed.', 403);
    const username = process.env.GENOMEDESK_DEMO_USER;
    const password = process.env.GENOMEDESK_DEMO_PASSWORD;
    if (!username || username.includes(':') || !password || password.length < 16) return denied('Configure the demo login username and a password of at least 16 characters before publishing.', 503);
    const authorization = request.headers.get('authorization') || '';
    let credentials = '';
    if (/^Basic [A-Za-z0-9+/]+=*$/i.test(authorization) && authorization.length < 4096) {
      credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    }
    if (!sameSecret(credentials, `${username}:${password}`)) return denied('Sign in to access the research workspace.', 401, true);
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
