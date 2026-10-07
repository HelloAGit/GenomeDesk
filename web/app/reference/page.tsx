import { ArrowRight, Code2, ShieldCheck, Workflow, Info } from "lucide-react";
import { PageHeading } from "@/components/ui";
const endpoints = [
  ["GET", "/health", "Backend health; no key required"],
  [
    "GET",
    "/api/capabilities",
    "Feature flags, upload limits, and AI availability",
  ],
  ["POST", "/api/samples", "Multipart VCF import: file, sample_name, assembly"],
  ["GET", "/api/samples", "Sample library, metadata, and summaries"],
  ["GET", "/api/samples/{id}", "Sample metadata and reference provenance"],
  [
    "GET",
    "/api/samples/{id}/variants",
    "chromosome, min_quality, pass_only, offset, limit",
  ],
  [
    "GET",
    "/api/samples/{id}/qc",
    "Aggregate metrics and chromosome record counts",
  ],
  [
    "POST",
    "/api/samples/{id}/explain",
    "Optional AI draft using aggregate metrics",
  ],
  ["DELETE", "/api/samples/{id}", "Permanently remove a sample; returns 204"],
];
export default function Reference() {
  return (
    <>
      <PageHeading
        eyebrow="BUILD ON THE REFERENCE"
        title="One API. Your next frontend."
        text="A practical blueprint for reproducing this workspace on another platform."
      />
      <section className="panel reference-intro">
        <Code2 size={29} />
        <div>
          <h2>A server-side bridge keeps keys private</h2>
          <p>
            The browser calls this Next.js app. Its route handlers attach the
            backend key and forward only supported requests to FastAPI. Nebius
            credentials remain exclusively in Python.
          </p>
        </div>
      </section>
      <div className="architecture">
        <span>
          Browser<small>Interactive interface</small>
        </span>
        <ArrowRight />
        <span>
          Next.js server<small>Server-only backend key</small>
        </span>
        <ArrowRight />
        <span>
          FastAPI + SQLite<small>VCF parsing & persistence</small>
        </span>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>REST endpoint reference</h2>
            <p>The actual backend contract, with no invented endpoints</p>
          </div>
          <Workflow size={21} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Backend path</th>
                <th>Purpose / parameters</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(([method, path, purpose]) => (
                <tr key={method + path}>
                  <td>
                    <span
                      className={`tag ${method === "DELETE" ? "amber" : "green"}`}
                    >
                      {method}
                    </span>
                  </td>
                  <td>
                    <code>{path}</code>
                  </td>
                  <td>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="reference-grid">
        <section className="panel reference-card">
          <h2>
            <ShieldCheck size={19} /> Connection contract
          </h2>
          <p>
            All backend <code>/api/*</code> calls use <code>X-API-Key</code>.
            This web app uses <code>GENOMEDESK_API_URL</code> and{" "}
            <code>GENOMEDESK_BACKEND_KEY</code> in <code>web/.env.local</code>.
            Never use a <code>NEXT_PUBLIC_</code> prefix for a key.
          </p>
          <p>
            Run this local demo on loopback. A hosted frontend must add user
            authentication and workspace access controls to its own server
            functions. CORS does not authenticate users.
          </p>
          <h3>Error behavior</h3>
          <p>
            401: invalid key · 404: sample missing · 413: oversized upload ·
            422: invalid input · 503: missing configuration · 502: upstream
            unavailable.
          </p>
        </section>
        <section className="panel reference-card">
          <h2>
            <Info size={19} /> Preserve the meaning
          </h2>
          <ul>
            <li>Null quality or depth means unavailable, never zero.</li>
            <li>INFO/DP is variant-site depth, not genome-wide coverage.</li>
            <li>FILTER “.” is unfiltered; it is not PASS.</li>
            <li>Multiallelic ALT values remain a list in one record.</li>
            <li>Header agreement is provenance, not locus verification.</li>
            <li>AI output is a draft requiring researcher review.</li>
          </ul>
        </section>
      </div>
      <section className="panel reference-card">
        <h2>Reproduce the import flow</h2>
        <p>
          Use multipart form data. Let fetch supply the content-type boundary.
          This example runs in your platform’s server function.
        </p>
        <pre>{`const body = new FormData();
body.set("file", file);
body.set("sample_name", name);
body.set("assembly", "GRCh38");

const response = await fetch(
  new URL("/api/samples", process.env.GENOMEDESK_API_URL),
  {
    method: "POST",
    headers: { "X-API-Key": process.env.GENOMEDESK_BACKEND_KEY },
    body,
    cache: "no-store",
  }
);
if (!response.ok) throw new Error(
  \`Import failed: \${response.status}\`
);
const sample = await response.json();`}</pre>
        <p>
          The local web proxy mirrors the API paths, with{" "}
          <code>/api/health</code> mapped to the backend’s <code>/health</code>.
          Read <code>docs/local-reference.md</code> for setup, state mapping,
          and validation instructions. FastAPI serves the live contract at{" "}
          <code>/openapi.json</code> and interactive documentation at{" "}
          <code>/docs</code>.
        </p>
      </section>
    </>
  );
}
