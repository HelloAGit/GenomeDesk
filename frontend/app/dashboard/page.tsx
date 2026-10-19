import type { Metadata } from "next";
import { SimpleBarChart } from "@/components/Charts";
import { ExportButtons } from "@/components/ExportButtons";
import { SampleComparison } from "@/components/SampleComparison";
import { Card, ErrorNotice, Notice, PageHeader, StatCard } from "@/components/ui";
import { getDashboard } from "@/lib/data";
import { fmtDate, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const r = await getDashboard();
  if (!r.ok) {
    return (<><PageHeader title="Dashboard" /><ErrorNotice error={r.error} /></>);
  }
  const d = r.data;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Dashboard">Project: {d.project.name}</PageHeader>
        <ExportButtons dashboard={d} />
      </div>
      {d.sample_total === 0 ? (
        <Notice tone="empty" title="No samples yet">Upload a VCF on the Samples page to populate the dashboard.</Notice>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Samples" value={fmtNum(d.sample_total)} />
        <StatCard label="Variants" value={fmtNum(d.variant_total)} />
        <StatCard label="PASS variants" value={fmtNum(d.pass_variant_total)} />
        <StatCard label="Mean quality" value={fmtNum(d.mean_variant_quality)} />
        <StatCard label="Mean site depth" value={fmtNum(d.mean_site_depth)} />
      </dl>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Chromosome distribution">
          <SimpleBarChart label="Variants per chromosome" data={d.chromosome_distribution.map((c) => ({ name: c.chromosome, Variants: c.count }))} series={[{ key: "Variants", color: "#1d4ed8" }]} />
        </Card>
        <Card title="Quality histogram">
          <SimpleBarChart label="Variant quality histogram" data={d.quality_histogram.map((b) => ({ name: b.label, Variants: b.count }))} series={[{ key: "Variants", color: "#7c3aed" }]} />
        </Card>
      </div>
      <Card title="Sample comparison" className="mt-6"><SampleComparison rows={d.sample_comparison} /></Card>
      <Card title="Research history" className="mt-6">
        {d.research_history.length === 0 ? (
          <p className="text-sm text-slate-600">No research history yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {d.research_history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{h.title} <span className="text-slate-600">({h.kind})</span></span><time>{fmtDate(h.created_at)}</time></li>
            ))}
          </ul>
        )}
      </Card>
      {d.limitations.length > 0 ? (
        <Card title="Limitations" className="mt-6"><ul className="list-disc pl-5 text-sm">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Card>
      ) : null}
    </>
  );
}
