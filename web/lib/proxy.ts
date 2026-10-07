import type { NextRequest } from "next/server";
import { access } from "./access";
const id =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function allowed(path: string, method: string) {
  if (path === "health" || path === "capabilities") return method === "GET";
  if (path === "samples") return method === "GET" || method === "POST";
  if (new RegExp(`^samples/${id}$`).test(path))
    return method === "GET" || method === "DELETE";
  if (new RegExp(`^samples/${id}/(variants|qc)$`).test(path))
    return method === "GET";
  return new RegExp(`^samples/${id}/explain$`).test(path) && method === "POST";
}
function error(detail: string, status: number) {
  return Response.json(
    { detail },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function proxy(
  request: NextRequest,
  path: string,
): Promise<Response> {
  if (!allowed(path, request.method))
    return error("Endpoint or method is not supported.", 404);
  const denied = access(request);
  if (denied) return denied;
  const key = process.env.GENOMEDESK_BACKEND_KEY;
  if (!key && path !== "health")
    return error(
      "Backend connection is not configured. Set GENOMEDESK_BACKEND_KEY in the frontend server environment and restart the web server.",
      503,
    );
  let url: URL;
  try {
    url = new URL(
      path === "health" ? "/health" : `/api/${path}`,
      process.env.GENOMEDESK_API_URL || "http://127.0.0.1:8000",
    );
  } catch {
    return error("Invalid backend URL configuration.", 503);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return error("Invalid backend URL configuration.", 503);
  if (path.endsWith("/variants"))
    for (const name of [
      "chromosome",
      "min_quality",
      "pass_only",
      "offset",
      "limit",
    ]) {
      const value = request.nextUrl.searchParams.get(name);
      if (value !== null) url.searchParams.set(name, value);
    }
  const headers = new Headers();
  if (path !== "health") headers.set("X-API-Key", key!);
  let body: ReadableStream<Uint8Array> | undefined;
  if (request.method === "POST" && path === "samples") {
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data;"))
      return error("Upload requires multipart form data.", 415);
    const maximum = Number(process.env.GENOMEDESK_MAX_BODY_BYTES || 12582912);
    if (!Number.isSafeInteger(maximum) || maximum <= 0)
      return error("Invalid proxy upload limit configuration.", 503);
    if (Number(request.headers.get("content-length")) > maximum)
      return error("Upload exceeds the local proxy size limit.", 413);
    let size = 0;
    body = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          size += chunk.byteLength;
          if (size > maximum) throw new Error("BODY_TOO_LARGE");
          controller.enqueue(chunk);
        },
      }),
    );
    headers.set("Content-Type", type);
  }
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(path.endsWith("/explain") ? 75000 : 30000),
      ...(body ? { duplex: "half" } : {}),
    } as RequestInit);
    if (response.status === 204)
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    const data = await response.json();
    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail
                .map((e: { msg?: string }) => e.msg || "Invalid input")
                .join("; ")
            : "Backend request failed.";
      return error(detail, response.status);
    }
    return Response.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    if (
      cause instanceof Error &&
      (cause.message === "BODY_TOO_LARGE" ||
        (cause.cause instanceof Error &&
          cause.cause.message === "BODY_TOO_LARGE"))
    )
      return error("Upload exceeds the local proxy size limit.", 413);
    return error(
      "The backend could not complete this request. Check that FastAPI is running and retry.",
      502,
    );
  }
}
