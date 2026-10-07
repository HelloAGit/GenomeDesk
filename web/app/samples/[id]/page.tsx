"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Dna,
  CheckCheck,
  Activity,
  Layers3,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
} from "lucide-react";
import { api, number, date, bytes } from "@/lib/client";
import type {
  Sample,
  QC,
  VariantPage,
  Capabilities,
  Explanation,
} from "@/types/api";
import { PageHeading, ErrorNotice, Loading, Metric } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChromosomeChart } from "@/components/chromosome-chart";
export default function SampleDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [sample, setSample] = useState<Sample>();
  const [qc, setQc] = useState<QC>();
  const [caps, setCaps] = useState<Capabilities>();
  const [page, setPage] = useState<VariantPage>();
  const [error, setError] = useState("");
  const [variantError, setVariantError] = useState("");
  const [loading, setLoading] = useState(true);
  const [variantLoading, setVariantLoading] = useState(true);
  const [chromosome, setChromosome] = useState("");
  const [quality, setQuality] = useState("");
  const [pass, setPass] = useState(false);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [explanation, setExplanation] = useState<Explanation>();
  const [explaining, setExplaining] = useState(false);
  const [aiError, setAiError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const limit = 25;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api<Sample>(`/api/samples/${id}`),
      api<QC>(`/api/samples/${id}/qc`),
      api<Capabilities>("/api/capabilities"),
    ])
      .then(([s, q, c]) => {
        if (active) {
          setSample(s);
          setQc(q);
          setCaps(c);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setVariantLoading(true);
    setVariantError("");
    setPage(undefined);
    const p = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      pass_only: String(pass),
    });
    if (chromosome) p.set("chromosome", chromosome);
    if (quality) p.set("min_quality", quality);
    api<VariantPage>(`/api/samples/${id}/variants?${p}`, {
      signal: controller.signal,
    })
      .then(setPage)
      .catch((e) => {
        if (!controller.signal.aborted) setVariantError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setVariantLoading(false);
      });
    return () => controller.abort();
  }, [id, chromosome, quality, pass, offset, revision]);
  async function explain() {
    setExplaining(true);
    setAiError("");
    try {
      setExplanation(
        await api<Explanation>(`/api/samples/${id}/explain`, {
          method: "POST",
        }),
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Explanation failed.");
    } finally {
      setExplaining(false);
    }
  }
  async function remove() {
    setDeleting(true);
    setError("");
    try {
      await api(`/api/samples/${id}`, { method: "DELETE" });
      router.push("/samples");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed.");
      setDeleting(false);
      setConfirming(false);
    }
  }
  if (loading) return <Loading text="Loading sample and quality metrics…" />;
  if (error && !sample)
    return (
      <>
        <Link className="text-link" href="/samples">
          <ArrowLeft size={16} /> Back to library
        </Link>
        <ErrorNotice message={error} retry={() => setRevision((r) => r + 1)} />
      </>
    );
  if (!sample || !qc) return null;
  return (
    <>
      <Link className="back-link" href="/samples">
        <ArrowLeft size={16} /> Sample library
      </Link>
      <PageHeading
        eyebrow="SAMPLE EXPLORER"
        title={sample.name}
        text={`Imported ${date(sample.created_at)} · ${bytes(sample.size_bytes)} · ${sample.assembly}`}
        action={
          <button
            className="button secondary danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={16} /> Delete sample
          </button>
        }
      />
      {error && <ErrorNotice message={error} />}
      <div className="sample-context">
        <span className="tag neutral">{sample.assembly}</span>
        <span
          className={`tag ${sample.reference_verification === "header-match" ? "green" : "amber"}`}
        >
          <ShieldCheck size={13} />
          {sample.reference_verification === "header-match"
            ? "Reference header match"
            : "User-declared · Unverified"}
        </span>
        <span className="muted">{sample.id}</span>
      </div>
      <section className="metric-grid">
        <Metric
          label="Variant records"
          value={number(qc.record_count)}
          note="One row per VCF record"
          icon={<Dna size={18} />}
        />
        <Metric
          label="PASS records"
          value={number(qc.pass_record_count)}
          note={`${number(qc.unfiltered_record_count)} unfiltered records (not PASS)`}
          icon={<CheckCheck size={18} />}
        />
        <Metric
          label="Mean variant quality"
          value={number(qc.mean_variant_quality)}
          note={`${number(qc.quality_observation_count)} quality observations`}
          icon={<Activity size={18} />}
        />
        <Metric
          label="Mean site depth"
          value={number(qc.mean_site_depth)}
          note={`${number(qc.depth_observation_count)} INFO/DP observations`}
          icon={<Layers3 size={18} />}
        />
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Records by chromosome</h2>
              <p>Distribution within this sample</p>
            </div>
            <span className="tag neutral">Site-level data</span>
          </div>
          <ChromosomeChart counts={qc.records_by_chromosome} />
        </section>
        <section className="panel provenance">
          <div className="panel-heading">
            <h2>Import provenance</h2>
            <ShieldCheck size={19} />
          </div>
          <dl>
            <dt>Selected assembly</dt>
            <dd>{sample.assembly}</dd>
            <dt>Declared reference</dt>
            <dd>{sample.declared_reference ?? "Not declared in header"}</dd>
            <dt>Verification</dt>
            <dd>{sample.reference_verification}</dd>
            <dt>SHA-256 checksum</dt>
            <dd className="checksum">{sample.sha256}</dd>
          </dl>
          <p>
            Header agreement records the declared assembly. It does not verify
            each locus against a reference genome.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Variant explorer</h2>
            <p>Filter the evidence, one record at a time</p>
          </div>
          <span className="tag green">
            {page ? `${number(page.total)} matching` : "…"}
          </span>
        </div>
        <div className="variant-toolbar">
          <label>
            Chromosome
            <select
              value={chromosome}
              onChange={(e) => {
                setChromosome(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All chromosomes</option>
              {Object.keys(qc.records_by_chromosome)
                .sort((a, b) =>
                  a.localeCompare(b, undefined, { numeric: true }),
                )
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          <label>
            Minimum quality
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Any quality"
              value={quality}
              onChange={(e) => {
                if (e.target.value !== "" && Number(e.target.value) < 0) return;
                setQuality(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={pass}
              onChange={(e) => {
                setPass(e.target.checked);
                setOffset(0);
              }}
            />{" "}
            PASS only
          </label>
          <button
            className="text-link"
            onClick={() => {
              setChromosome("");
              setQuality("");
              setPass(false);
              setOffset(0);
            }}
          >
            Reset filters
          </button>
        </div>
        {variantError && (
          <ErrorNotice
            message={variantError}
            retry={() => setRevision((r) => r + 1)}
          />
        )}
        {variantLoading ? (
          <Loading text="Fetching variant records…" />
        ) : page?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chromosome</th>
                  <th>Position</th>
                  <th>REF</th>
                  <th>ALT</th>
                  <th>Quality</th>
                  <th>Filter</th>
                  <th>Site depth</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((v, i) => (
                  <tr key={`${offset}-${i}`}>
                    <td>
                      <span className="tag neutral">{v.chromosome}</span>
                    </td>
                    <td className="numeric">{number(v.position)}</td>
                    <td>
                      <span className="base-ref">{v.reference}</span>
                    </td>
                    <td>
                      <span className="base-alt">
                        {v.alternates.join(", ")}
                      </span>
                    </td>
                    <td>{number(v.quality)}</td>
                    <td>
                      <span
                        className={`tag ${v.filters.length === 1 && v.filters[0] === "PASS" ? "green" : v.filters.length ? "amber" : "neutral"}`}
                      >
                        {v.filters.length ? v.filters.join(", ") : "Unfiltered"}
                      </span>
                    </td>
                    <td>{number(v.site_depth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !variantError && (
            <div className="empty compact">
              <h3>No records match these filters</h3>
              <p>Adjust your chromosome, quality, or PASS filter.</p>
            </div>
          )
        )}
        <div className="pagination">
          <span>
            {page
              ? page.total
                ? `${offset + 1}–${Math.min(offset + limit, page.total)} of ${number(page.total)} records`
                : "0 records"
              : "Records unavailable"}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={offset === 0 || variantLoading || !page}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="button secondary small"
              disabled={!page || offset + limit >= page.total || variantLoading}
              onClick={() => setOffset(offset + limit)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <section className="panel ai-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Sparkles size={20} /> Research explanation
            </h2>
            <p>Optional AI context from aggregate QC metrics only</p>
          </div>
          <span className={`tag ${caps?.ai_configured ? "green" : "neutral"}`}>
            {caps?.ai_configured ? "Nebius configured" : "Not configured"}
          </span>
        </div>
        <div className="ai-content">
          {aiError && <ErrorNotice message={aiError} />}
          {explanation ? (
            <>
              <span className="tag amber">
                AI draft · Researcher review required
              </span>
              <p className="explanation-text">{explanation.text}</p>
              <small className="muted">
                {explanation.model} · {date(explanation.generated_at)}
              </small>
              <details className="source-metrics">
                <summary>View source metrics</summary>
                <pre>{JSON.stringify(explanation.source_metrics, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p>
              {caps?.ai_configured
                ? "Generate a research draft that explains these measurements and their limits. No names, loci, genotypes, or raw files are sent to the provider."
                : "AI explanations are optional. Configure the Nebius key and exact model ID in the Python backend to enable this feature. You can explore all sample data without AI."}
            </p>
          )}
          <button
            className="button secondary"
            disabled={!caps?.ai_configured || explaining}
            onClick={explain}
          >
            {explaining ? (
              <>
                <span className="spinner" /> Generating draft…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {explanation
                  ? "Generate another draft"
                  : "Generate explanation"}
              </>
            )}
          </button>
        </div>
      </section>
      <div className="limitations">
        <Info size={20} />
        <div>
          <h3>Interpret these metrics in context</h3>
          <ul>
            {qc.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog busy={deleting} onClose={() => setConfirming(false)}>
          <button
            className="icon-button modal-close"
            aria-label="Cancel deletion"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            <X size={20} />
          </button>
          <span className="delete-symbol">
            <Trash2 size={25} />
          </span>
          <h2 id="delete-title">Delete this sample?</h2>
          <p>
            “{sample.name}” and its imported variant records will be permanently
            removed from this workspace.
          </p>
          <div className="modal-actions">
            <button
              autoFocus
              className="button secondary"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Keep sample
            </button>
            <button
              className="button destructive"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
