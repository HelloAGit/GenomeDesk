# Frontend and dashboard integration

The API works with any platform able to make multipart and JSON HTTP requests from server-side code. Host the Python backend separately if your frontend platform cannot run it. Use HTTPS for hosted requests.

## Endpoints

All `/api` endpoints require `X-API-Key`. No Nebius key is sent by the frontend.

| Method/path | Input | Output/use |
|---|---|---|
| GET `/health` | None | Liveness |
| GET `/api/capabilities` | None | Supported features and AI configuration flag |
| POST `/api/samples` | Multipart: file, sample_name, assembly | Imported sample metadata, checksum and summary |
| GET `/api/samples` | None | Dashboard sample list |
| GET `/api/samples/{id}` | Sample UUID | Metadata and summary |
| GET `/api/samples/{id}/variants` | chromosome, min_quality, pass_only, offset, limit | Filtered table rows and total |
| GET `/api/samples/{id}/qc` | Sample UUID | Metrics and chromosome counts |
| POST `/api/samples/{id}/explain` | No body | AI text, source metrics, review flag |
| DELETE `/api/samples/{id}` | Sample UUID | 204 on deletion |

Schema: `/openapi.json`; interactive reference: `/docs`; static snapshot: `docs/openapi.json`.

## Server-side TypeScript example

```ts
// Run only inside your frontend platform's server function.
const base = process.env.GENOMEDESK_API_URL!;
const key = process.env.GENOMEDESK_BACKEND_KEY!;

export async function uploadVcf(file: File, name: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("sample_name", name);
  body.set("assembly", "GRCh38");
  const response = await fetch(`${base}/api/samples`, {
    method: "POST", headers: { "X-API-Key": key }, body,
  });
  // Do not set Content-Type manually: fetch supplies the multipart boundary.
  if (!response.ok) throw new Error(`Import failed: ${response.status}`);
  return response.json();
}

export async function fetchQc(id: string) {
  const response = await fetch(`${base}/api/samples/${encodeURIComponent(id)}/qc`, {
    headers: { "X-API-Key": key },
  });
  if (!response.ok) throw new Error(`QC request failed: ${response.status}`);
  return response.json();
}
```

The frontend's proxy must authenticate its own users and restrict access to this single workspace; otherwise it exposes the backend to everyone. CORS is not authentication. This starter has one shared workspace, not multi-user ownership or tenant isolation.

## Dashboard mapping

| Component | JSON field |
|---|---|
| Record count card | `record_count` |
| PASS count card | `pass_record_count` |
| Chromosome bar chart | `records_by_chromosome` |
| Quality card | `mean_variant_quality` and `quality_observation_count` |
| Site depth card | `mean_site_depth` and `depth_observation_count` |
| Variant table | variants endpoint `items` |
| Explanation panel | explain endpoint `text`, labelled AI draft |

Render null metrics as unavailable, never as zero. INFO/DP is site-level depth, not sample-specific depth or whole-genome coverage. Each row represents one VCF record; multiallelic ALT values remain a list. FILTER `.` means unfiltered, not PASS.

Errors: 401 invalid backend key; 404 missing sample; 413 upload too large; 422 malformed/unsupported input; 503 missing configuration; 502 upstream AI failure. Frontend should show a clear error instead of mock success. Escape all text and sanitise any rendered Markdown.

Only small uncompressed VCF files are supported (default 10 MiB / 50,000 records). BCF, compressed VCF, FASTQ, gene filters and annotations are not implemented.
