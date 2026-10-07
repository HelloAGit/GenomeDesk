"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Layers3,
  Dna,
  CheckCheck,
  Activity,
  ArrowUpRight,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { api, number } from "@/lib/client";
import type { Sample, Capabilities } from "@/types/api";
import {
  PageHeading,
  Metric,
  Empty,
  Loading,
  ErrorNotice,
} from "@/components/ui";
import { SampleTable } from "@/components/sample-table";
import { ChromosomeChart } from "@/components/chromosome-chart";
export default function Overview() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [caps, setCaps] = useState<Capabilities>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api<Sample[]>("/api/samples"),
      api<Capabilities>("/api/capabilities"),
    ])
      .then(([s, c]) => {
        setSamples(s);
        setCaps(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const records = samples.reduce((n, s) => n + s.summary.record_count, 0);
  const pass = samples.reduce((n, s) => n + s.summary.pass_record_count, 0);
  const counts: Record<string, number> = {};
  samples.forEach((s) =>
    Object.entries(s.summary.records_by_chromosome).forEach(([k, v]) => {
      counts[k] = (counts[k] || 0) + v;
    }),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR RESEARCH, IN VIEW"
        title="Workspace overview"
        text="From raw variants to a clearer picture. Start exploring your genomic data."
        action={
          <Link href="/upload" className="button">
            <Upload size={17} /> Import VCF
          </Link>
        }
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <FlaskConical size={15} /> BUILT FOR EXPLORATION
          </span>
          <h2>
            Small files.
            <br />
            Meaningful insights.
          </h2>
          <p>
            A focused workspace to inspect variants, explore quality metrics,
            and understand the data behind every sample.
          </p>
          <Link href="/upload">
            Explore a VCF file <ArrowRight size={17} />
          </Link>
        </div>
        <div className="genome-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <Dna className="hero-dna" strokeWidth={0.8} />
          <div className="art-label label-one">
            <span /> GRCh37 / GRCh38
          </div>
          <div className="art-label label-two">
            A <span>—</span> T <span className="art-base">C — G</span>
          </div>
          <div className="art-label label-three">
            VARIANT EXPLORER <ArrowUpRight size={14} />
          </div>
        </div>
      </section>
      {error && <ErrorNotice message={error} retry={load} />}
      <section className="metric-grid" aria-label="Workspace metrics">
        <Metric
          label="Imported samples"
          value={loading || error ? "—" : number(samples.length)}
          note="In your local workspace"
          icon={<Layers3 size={18} />}
        />
        <Metric
          label="Variant records"
          value={loading || error ? "—" : number(records)}
          note="Across all imported samples"
          icon={<Dna size={18} />}
        />
        <Metric
          label="PASS records"
          value={loading || error ? "—" : number(pass)}
          note={
            records
              ? `${((pass / records) * 100).toFixed(1)}% of imported records`
              : "Explicit FILTER = PASS"
          }
          icon={<CheckCheck size={18} />}
        />
        <Metric
          label="Reference assemblies"
          value={
            loading || error
              ? "—"
              : number(new Set(samples.map((s) => s.assembly)).size)
          }
          note="GRCh37 and GRCh38 supported"
          icon={<Activity size={18} />}
        />
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Records by chromosome</h2>
              <p>Distribution across your workspace</p>
            </div>
            <span className="tag neutral">VCF records</span>
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="chart-empty">
              Connect to the backend to view data.
            </div>
          ) : (
            <ChromosomeChart counts={counts} />
          )}
        </section>
        <section className="panel workflow-panel">
          <div className="panel-heading">
            <h2>A simple path to insight</h2>
          </div>
          <div className="workflow-step">
            <span>01</span>
            <div>
              <h3>Import your sample</h3>
              <p>An uncompressed VCF and its reference assembly.</p>
            </div>
          </div>
          <div className="workflow-step">
            <span>02</span>
            <div>
              <h3>Explore the evidence</h3>
              <p>Filter records and examine site-level quality metrics.</p>
            </div>
          </div>
          <div className="workflow-step">
            <span>03</span>
            <div>
              <h3>Keep the context</h3>
              <p>Inspect provenance and review optional AI explanations.</p>
            </div>
          </div>
          <Link className="text-link" href="/reference">
            See how it all connects <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent samples</h2>
            <p>Your latest imports, ready to explore</p>
          </div>
          <Link href="/samples" className="text-link">
            View library <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="chart-empty">Sample data is unavailable.</div>
        ) : samples.length ? (
          <SampleTable samples={samples.slice(0, 5)} />
        ) : (
          <Empty />
        )}
      </section>
      <div className="context-strip">
        <ShieldCheck size={20} />
        <p>
          <strong>Research use, with clear boundaries.</strong> No clinical
          interpretation or annotation.{" "}
          {caps
            ? `Import up to ${number(caps.max_records)} records per file.`
            : "Metrics describe variant sites, not genome-wide coverage."}
        </p>
        <Link href="/reference">
          Learn more <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}
