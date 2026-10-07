"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, Search, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import type { Sample } from "@/types/api";
import { PageHeading, Empty, Loading, ErrorNotice } from "@/components/ui";
import { SampleTable } from "@/components/sample-table";
export default function Samples() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [search, setSearch] = useState("");
  const [assembly, setAssembly] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError("");
    api<Sample[]>("/api/samples")
      .then(setSamples)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const filtered = samples.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) &&
      (!assembly || s.assembly === assembly),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR DATA COLLECTION"
        title="Sample library"
        text="Every import, its provenance, and a new perspective on your variants."
        action={
          <Link href="/upload" className="button">
            <Upload size={17} /> Import VCF
          </Link>
        }
      />
      {error && <ErrorNotice message={error} retry={load} />}
      <section className="panel">
        <div className="library-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search samples"
              placeholder="Search samples by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by assembly"
            value={assembly}
            onChange={(e) => setAssembly(e.target.value)}
          >
            <option value="">All assemblies</option>
            <option>GRCh37</option>
            <option>GRCh38</option>
          </select>
          <button
            className="button secondary small"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        {loading ? (
          <Loading />
        ) : error ? null : !samples.length ? (
          <Empty />
        ) : !filtered.length ? (
          <div className="empty">
            <h3>No matching samples</h3>
            <p>Try a different name or assembly.</p>
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setAssembly("");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <SampleTable samples={filtered} />
        )}
        <div className="panel-bottom">
          {!loading &&
            !error &&
            `${filtered.length} of ${samples.length} samples`}
          <span>Stored locally in SQLite</span>
        </div>
      </section>
    </>
  );
}
