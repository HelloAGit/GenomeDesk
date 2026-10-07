import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { access } from "../lib/access";
import { proxy as guard } from "../proxy";
import { proxy as bridge } from "../lib/proxy";
function hosted() {
  vi.stubEnv("GENOMEDESK_SITE_URL", "https://genomedesk-web.onrender.com");
  vi.stubEnv("GENOMEDESK_DEMO_USER", "researcher");
  vi.stubEnv("GENOMEDESK_DEMO_PASSWORD", "a-long-demo-test-password");
}
function request(
  path = "/",
  method = "GET",
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost:10000${path}`, {
    method,
    headers: { Host: "genomedesk-web.onrender.com", ...headers },
  });
}
function auth() {
  return `Basic ${Buffer.from("researcher:a-long-demo-test-password").toString("base64")}`;
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("hosted demo access", () => {
  it("rejects unauthenticated pages with a login challenge", () => {
    hosted();
    const r = guard(request());
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain("Basic");
  });
  it("rejects wrong passwords and malformed authentication", () => {
    hosted();
    expect(
      access(request("/", "GET", { Authorization: "Basic !!!!" }))?.status,
    ).toBe(401);
    expect(
      access(
        request("/", "GET", {
          Authorization:
            "Basic " + Buffer.from("researcher:incorrect").toString("base64"),
        }),
      )?.status,
    ).toBe(401);
  });
  it("accepts valid credentials but never forwards them to the backend", async () => {
    hosted();
    vi.stubEnv("GENOMEDESK_BACKEND_KEY", "backend-only-key");
    vi.stubEnv("GENOMEDESK_API_URL", "https://genomedesk.onrender.com");
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ vcf_import: true }));
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await bridge(
          request("/api/capabilities", "GET", { Authorization: auth() }),
          "capabilities",
        )
      ).status,
    ).toBe(200);
    expect(fetch.mock.calls[0][0].origin).toBe(
      "https://genomedesk.onrender.com",
    );
    expect(fetch.mock.calls[0][1].headers.get("X-API-Key")).toBe(
      "backend-only-key",
    );
    expect(fetch.mock.calls[0][1].headers.has("authorization")).toBe(false);
  });
  it("protects direct API access before calling the backend", async () => {
    hosted();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await bridge(request("/api/samples"), "samples")).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed when hosted login is missing or too short", () => {
    hosted();
    vi.stubEnv("GENOMEDESK_DEMO_PASSWORD", "");
    expect(access(request())?.status).toBe(503);
    vi.stubEnv("GENOMEDESK_DEMO_PASSWORD", "short");
    expect(access(request())?.status).toBe(503);
  });
  it("fails closed with invalid hosted origin", () => {
    hosted();
    vi.stubEnv("GENOMEDESK_SITE_URL", "http://genomedesk-web.onrender.com");
    expect(access(request())?.status).toBe(503);
  });
  it("uses Render injected HTTPS origin behind its reverse proxy", () => {
    hosted();
    vi.stubEnv("GENOMEDESK_SITE_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://genomedesk-web.onrender.com");
    expect(access(request("/", "GET", { Authorization: auth() }))).toBe(null);
  });
  it("does not allow a forged host to bypass login", () => {
    hosted();
    expect(
      access(request("/", "GET", { Host: "127.0.0.1:3000" }))?.status,
    ).toBe(403);
  });
  it("allows same-origin mutation over HTTPS but rejects cross-site mutation", () => {
    hosted();
    expect(
      access(
        request("/api/samples", "POST", {
          Authorization: auth(),
          Origin: "https://genomedesk-web.onrender.com",
        }),
      ),
    ).toBe(null);
    expect(
      access(
        request("/api/samples", "POST", {
          Authorization: auth(),
          Origin: "https://evil.example",
        }),
      )?.status,
    ).toBe(403);
  });
  it("serves only the public liveness endpoint without login", () => {
    hosted();
    expect(guard(request("/health")).status).toBe(200);
    expect(guard(request("/api/health")).status).toBe(401);
  });
  it("keeps unconfigured local development available without login", () => {
    vi.stubEnv("GENOMEDESK_SITE_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    vi.stubEnv("RENDER", "");
    expect(access(new NextRequest("http://localhost:3000/"))).toBe(null);
  });
});
