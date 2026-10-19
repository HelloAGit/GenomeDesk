"use client";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { proxy, qs } from "@/lib/client";
import { demoVariants } from "@/lib/demo";
import { fmtNum } from "@/lib/format";
import type { Variant, VariantFilters, VariantPage } from "@/lib/types";
import { btn, btnSecondary, inputCls, Notice, TableWrap } from "./ui";

const PAGE_SIZES = [25, 50, 100, 250];

export function VariantsExplorer({ samples, initialSample, demo }: { samples: { id: string; name: string }[]; initialSample?: string; demo: boolean }) {
  const [sample, setSample] = useState(samples.find((s) => s.id === initialSample)?.id ?? samples[0]?.id ?? "");
  const [draft, setDraft] = useState<VariantFilters>({});
  const [filters, setFilters] = useState<VariantFilters>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [page, setPage] = useState<VariantPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const offset = pagination.pageIndex * pagination.pageSize;

  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      if (demo) {
        if (!cancelled) { setPage(demoVariants(sample, filters, offset, pagination.pageSize)); setLoading(false); }
        return;
      }
      const r = await proxy<VariantPage>(`api/samples/${encodeURIComponent(sample)}/variants${qs({ ...filters, offset, limit: pagination.pageSize })}`);
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setPage(r.data);
      else { setPage(null); setError(r.error); }
    })();
    return () => { cancelled = true; };
  }, [sample, filters, offset, pagination.pageSize, demo]);

  const columns = useMemo<ColumnDef<Variant>[]>(() => [
    { header: "Chrom", accessorKey: "chromosome" },
    { header: "Position", accessorKey: "position", cell: (c) => c.getValue<number>().toLocaleString("en-US") },
    { header: "REF", accessorKey: "reference" },
    { header: "ALT", accessorFn: (v) => v.alternates.join(",") },
    { header: "QUAL", accessorKey: "quality", cell: (c) => fmtNum(c.getValue<number | null>()) },
    { header: "Filters", accessorFn: (v) => (v.filters.length ? v.filters.join(";") : ".") },
    { header: "Depth", accessorKey: "site_depth", cell: (c) => fmtNum(c.getValue<number | null>()) },
  ], []);

  const total = page?.total ?? 0;
  const table = useReactTable({
    data: page?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange: setPagination,
  });

  const apply = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...draft });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [draft]);

  if (samples.length === 0) return <Notice tone="empty" title="No samples">Upload a sample first to browse variants.</Notice>;

  const exportQs = qs(filters as Record<string, string | boolean | undefined>);
  const exportBase = `/api/proxy/api/samples/${encodeURIComponent(sample)}/variants/export`;
  const sep = exportQs ? "&" : "?";
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="v-sample" className="mb-1 block text-sm font-medium">Sample</label>
          <select id="v-sample" className={inputCls} value={sample} onChange={(e) => { setSample(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
            {samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="v-chrom" className="mb-1 block text-sm font-medium">Chromosome</label>
          <input id="v-chrom" className={inputCls} value={draft.chromosome ?? ""} onChange={(e) => setDraft({ ...draft, chromosome: e.target.value })} placeholder="e.g. 1, X" />
        </div>
        <div>
          <label htmlFor="v-q" className="mb-1 block text-sm font-medium">Min quality</label>
          <input id="v-q" type="number" min="0" step="any" className={inputCls} value={draft.min_quality ?? ""} onChange={(e) => setDraft({ ...draft, min_quality: e.target.value })} />
        </div>
        <div>
          <label htmlFor="v-ref" className="mb-1 block text-sm font-medium">REF allele</label>
          <input id="v-ref" className={inputCls} value={draft.ref ?? ""} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} pattern="[ACGTNacgtn]*" title="Nucleotides A, C, G, T, N" />
        </div>
        <div>
          <label htmlFor="v-alt" className="mb-1 block text-sm font-medium">ALT allele</label>
          <input id="v-alt" className={inputCls} value={draft.alt ?? ""} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} pattern="[ACGTNacgtn]*" title="Nucleotides A, C, G, T, N" />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <input id="v-pass" type="checkbox" checked={!!draft.pass_only} onChange={(e) => setDraft({ ...draft, pass_only: e.target.checked })} className="h-4 w-4" />
          <label htmlFor="v-pass" className="text-sm">PASS only</label>
          <button type="submit" className={`${btn} ml-4`}>Apply filters</button>
          <button type="button" className={btnSecondary} onClick={() => { setDraft({}); setFilters({}); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>Reset</button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" aria-live="polite" className="text-sm text-slate-700">
          {loading ? "Loading variants…" : error ? "" : `${total.toLocaleString("en-US")} variant${total === 1 ? "" : "s"} match`}
        </p>
        {demo ? <span className="text-sm text-slate-700">Downloads are disabled in demo mode.</span> : (
          <div className="flex gap-2" role="group" aria-label="Download filtered variants">
            <a className={btnSecondary} href={`${exportBase}${exportQs}${sep}format=csv`}>Download CSV</a>
            <a className={btnSecondary} href={`${exportBase}${exportQs}${sep}format=json`}>Download JSON</a>
          </div>
        )}
      </div>

      {error ? <Notice tone="error" title="Could not load variants">{error}</Notice> : null}
      {!error && !loading && page && page.total === 0 ? <Notice tone="empty" title="No variants match these filters" /> : null}

      {page && page.items.length > 0 ? (
        <TableWrap label="Variants">
          <table className="w-full text-left text-sm" aria-busy={loading}>
            <caption className="sr-only">Variants</caption>
            <thead className="bg-slate-100">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} scope="col" className="px-3 py-2">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  {row.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-2 font-mono text-xs">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnSecondary} disabled={pagination.pageIndex === 0 || loading} onClick={() => table.previousPage()}>Previous</button>
        <span className="text-sm">Page {pagination.pageIndex + 1} of {pageCount}</span>
        <button type="button" className={btnSecondary} disabled={pagination.pageIndex + 1 >= pageCount || loading} onClick={() => table.nextPage()}>Next</button>
        <label htmlFor="v-size" className="ml-auto text-sm">Rows per page</label>
        <select id="v-size" className="rounded-md border border-slate-400 px-2 py-1 text-sm" value={pagination.pageSize} onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}>
          {PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}
