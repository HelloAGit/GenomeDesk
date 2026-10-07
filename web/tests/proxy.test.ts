import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { allowed, proxy } from "../lib/proxy";
const id = "00000000-0000-0000-0000-000000000001";
function request(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`http://localhost:3000/api/${path}`, init);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("server-side REST bridge", () => {
  it("allows only existing endpoints and their methods", () => {
    expect(allowed("health", "GET")).toBe(true);
    expect(allowed(`samples/${id}/explain`, "POST")).toBe(true);
    expect(allowed(`samples/${id}/variants`, "POST")).toBe(false);
    expect(allowed("samples/../../health", "GET")).toBe(false);
    expect(allowed("annotation", "GET")).toBe(false);
    expect(allowed("samples", "DELETE")).toBe(false);
  });
  it("keeps the key server-side and forwards only supported variant query fields", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubEnv("GENOMEDESK_API_URL", "http://127.0.0.1:8000");
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ total: 0, items: [] }));
    vi.stubGlobal("fetch", fetch);
    const result = await proxy(
      request(
        `samples/${id}/variants?chromosome=chr2&pass_only=true&limit=25&evil=1`,
      ),
      `samples/${id}/variants`,
    );
    expect(result.status).toBe(200);
    const [url, init] = fetch.mock.calls[0];
    expect(url.pathname).toBe(`/api/samples/${id}/variants`);
    expect(url.searchParams.get("chromosome")).toBe("chr2");
    expect(url.searchParams.has("evil")).toBe(false);
    expect(init.headers.get("X-API-Key")).toBe("server-secret");
    expect(await result.text()).not.toContain("server-secret");
  });
  it("reports missing configuration without attempting a request", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await proxy(request("samples"), "samples")).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports malformed backend URL as configuration failure", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubEnv("GENOMEDESK_API_URL", "not-a-url");
    expect((await proxy(request("samples"), "samples")).status).toBe(503);
  });
  it("maps public health without authenticating", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "");
    const fetch = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetch);
    expect((await proxy(request("health"), "health")).status).toBe(200);
    expect(fetch.mock.calls[0][0].pathname).toBe("/health");
    expect(fetch.mock.calls[0][1].headers.has("X-API-Key")).toBe(false);
  });
  it("rejects cross-origin mutations", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await proxy(
          request(`samples/${id}`, {
            method: "DELETE",
            headers: { Origin: "https://untrusted.example" },
          }),
          `samples/${id}`,
        )
      ).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts the browser loopback origin when Next normalises its internal URL", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const r = request(`samples/${id}`, {
      method: "DELETE",
      headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
    });
    expect((await proxy(r, `samples/${id}`)).status).toBe(204);
  });
  it("rejects DNS rebinding hostnames", async () => {
    expect(
      (
        await proxy(
          request("samples", { headers: { Host: "evil.example:3000" } }),
          "samples",
        )
      ).status,
    ).toBe(403);
  });
  it("bounds multipart requests before forwarding", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubEnv("GENOMEDESK_MAX_BODY_BYTES", "100");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = request("samples", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=x",
        "Content-Length": "101",
      },
      body: "test",
    });
    expect((await proxy(r, "samples")).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds streamed multipart bodies without a Content-Length", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubEnv("GENOMEDESK_MAX_BODY_BYTES", "3");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        await new Response(init.body).arrayBuffer();
        return Response.json({});
      }),
    );
    const r = request("samples", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x" },
      body: "oversized",
    });
    expect((await proxy(r, "samples")).status).toBe(413);
  });
  it("preserves deletion status and clears the response body", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const r = await proxy(
      request(`samples/${id}`, { method: "DELETE" }),
      `samples/${id}`,
    );
    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
  });
  it("preserves validation errors without echoing backend input objects", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            {
              detail: [
                { msg: "Assembly is invalid", input: "sensitive-value" },
              ],
            },
            { status: 422 },
          ),
        ),
    );
    const r = await proxy(request("samples"), "samples");
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ detail: "Assembly is invalid" });
  });
  it("returns a useful error for backend failures without exception leakage", async () => {
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("sensitive connection detail")),
    );
    const r = await proxy(request("samples"), "samples");
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain("sensitive");
  });
});
