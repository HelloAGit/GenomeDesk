import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = (process.env.GENOMEDESK_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const FORWARD_REQUEST_HEADERS = ["content-type", "content-length", "accept"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition", "content-length", "cache-control"];

function allowed(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((s) => s === "" || s === "." || s === ".." || /[\\/\0]/.test(s))) return false;
  const joined = segments.join("/");
  return joined === "health" || joined.startsWith("api/");
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!allowed(path)) return NextResponse.json({ detail: "Path not allowed" }, { status: 404 });

  const headers = new Headers();
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const key = process.env.BACKEND_API_KEY;
  if (key) headers.set("X-API-Key", key);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const target = `${BASE}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error duplex is required for streaming request bodies in Node
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const out = new Headers();
    for (const h of FORWARD_RESPONSE_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    return new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}

export { handle as GET, handle as POST, handle as DELETE };
