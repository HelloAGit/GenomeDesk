import type { Metadata } from "next";
import { CreateJob } from "@/components/CreateJob";
import { Card, ErrorNotice, Notice, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { isDemo } from "@/lib/api";
import { getJobs, getPipelines, getSamples } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const [j, p, s, demo] = await Promise.all([getJobs(), getPipelines(), getSamples(), isDemo()]);
  return (
    <>
      <PageHeader title="Jobs" />
      <Card title="New job" className="mb-6">
        <CreateJob demo={demo} samples={s.ok ? s.data.map((x) => ({ id: x.id, name: x.name })) : []} />
      </Card>
      {!j.ok ? <ErrorNotice error={j.error} /> : j.data.length === 0 ? (
        <Notice tone="empty" title="No jobs">No jobs have been run yet.</Notice>
      ) : (
        <TableWrap label="Jobs">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Jobs</caption>
            <thead className="bg-slate-100"><tr>{["Type", "Status", "Sample", "Created", "Finished", "Error"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {j.data.map((x) => (
                <tr key={x.id} className="border-t border-slate-200">
                  <th scope="row" className="px-3 py-2 font-medium">{x.job_type}</th>
                  <td className="px-3 py-2"><StatusBadge status={x.status} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{x.sample_id ?? "—"}</td>
                  <td className="px-3 py-2">{fmtDate(x.created_at)}</td>
                  <td className="px-3 py-2">{fmtDate(x.finished_at)}</td>
                  <td className="px-3 py-2 text-red-800">{x.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Card title="FASTQ pipeline" className="mt-6">
        <Notice tone="warn" title="Planned — not operational">
          {p.ok ? p.data.note : "FASTQ processing is planned and not available."}
        </Notice>
        {!p.ok ? <div className="mt-3"><ErrorNotice error={p.error} /></div> : p.data.stages.length === 0 ? null : (
          <ol className="mt-3 space-y-2 text-sm">
            {p.data.stages.map((st) => (
              <li key={st.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-2">
                <span><span className="font-medium">{st.name}</span> — {st.tool} {st.pinned_version}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">Planned — not operational</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
