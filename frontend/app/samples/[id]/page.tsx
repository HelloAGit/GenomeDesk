import type { Metadata } from "next";
import Link from "next/link";
import { SimpleBarChart } from "@/components/Charts";
import { DeleteSample } from "@/components/DeleteSample";
import { Card, ErrorNotice, Notice, PageHeader, StatCard, btnSecondary } from "@/components/ui";
import { isDemo } from "@/lib/api";
import { getQc, getSample } from "@/lib/data";
import { fmtBytes, fmtDate, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Sample" };
export const dynamic = "force-dynamic";

export default async function SamplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, qc, demo] = await Promise.all([getSample(id), getQc(id), isDemo()]);
  if (!r.ok) {
    return (<><PageHeader title="Sample" /><ErrorNotice error={r.status === 404 ? "Sample not found." : r.error} /><p className="mt-4"><Link className="text-blue-700 underline" href="/samples">Back to samples</Link></p></>);
  }
  const s = r.data;
  const sum = qc.ok ? qc.data : s.summary;
  const base = `/api/proxy/api/samples/${encodeURIComponent(id)}`;
  return (
    <>
      <PageHeader title={s.name}>{s.assembly} · {s.source_format} · imported {fmtDate(s.created_at)}</PageHeader>
      {!qc.ok ? <div className="mb-4"><Notice tone="warn" title="QC endpoint unavailable">Showing the stored summary instead ({qc.error}).</Notice></div> : null}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Records" value={fmtNum(sum.record_count)} />
        <StatCard label="PASS records" value={fmtNum(sum.pass_record_count)} />
        <StatCard label="Mean quality" value={fmtNum(sum.mean_variant_quality)} />
        <StatCard label="Mean site depth" value={fmtNum(sum.mean_site_depth)} />
      </dl>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Records by chromosome">
          <SimpleBarChart label="Records by chromosome" data={Object.entries(sum.records_by_chromosome).map(([c, n]) => ({ name: c, Records: n }))} series={[{ key: "Records", color: "#1d4ed8" }]} />
        </Card>
        <Card title="Quality histogram">
          <SimpleBarChart label="Quality histogram" data={sum.quality_histogram.map((b) => ({ name: b.label, Records: b.count }))} series={[{ key: "Records", color: "#7c3aed" }]} />
        </Card>
      </div>
      <Card title="Provenance" className="mt-6">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-medium">SHA-256</dt><dd className="break-all font-mono text-xs">{s.sha256}</dd></div>
          <div><dt className="font-medium">Size</dt><dd>{fmtBytes(s.size_bytes)}</dd></div>
          <div><dt className="font-medium">Declared reference</dt><dd>{s.declared_reference ?? "none declared"}</dd></div>
          <div><dt className="font-medium">Reference verification</dt><dd>{s.reference_verification}</dd></div>
        </dl>
      </Card>
      {sum.limitations.length > 0 ? <Card title="Limitations" className="mt-6"><ul className="list-disc pl-5 text-sm">{sum.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Card> : null}
      <Card title="Actions" className="mt-6">
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/variants?sample=${encodeURIComponent(id)}`} className={btnSecondary}>Browse variants</Link>
          {demo ? null : (
            <>
              <a href={`${base}/summary?format=csv`} className={btnSecondary}>Summary CSV</a>
              <a href={`${base}/summary?format=json`} className={btnSecondary}>Summary JSON</a>
              <DeleteSample id={id} name={s.name} />
            </>
          )}
        </div>
        {demo ? <p className="mt-2 text-sm text-slate-700">Downloads and deletion are disabled in demo mode.</p> : null}
      </Card>
    </>
  );
}
