import type { Metadata } from "next";
import { Card, ErrorNotice, Notice, PageHeader, TableWrap, Unavailable } from "@/components/ui";
import { getCapabilities, getProjects } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [p, caps] = await Promise.all([getProjects(), getCapabilities()]);
  return (
    <>
      <PageHeader title="Projects" />
      <div className="mb-4">
        <Notice tone="info" title="Dev API-key compatibility mode">
          The backend is running with a single shared server-side API key
          {caps.ok ? ` (authentication: ${caps.data.authentication})` : ""}. Per-user accounts and roles are not enforced here.
        </Notice>
      </div>
      {!p.ok ? <ErrorNotice error={p.error} /> : p.data.length === 0 ? (
        <Notice tone="empty" title="No projects">The backend returned no projects.</Notice>
      ) : (
        <TableWrap label="Projects">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Projects</caption>
            <thead className="bg-slate-100"><tr>{["Name", "Description", "Role", "Samples", "Created"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {p.data.map((x) => (
                <tr key={x.id} className="border-t border-slate-200">
                  <th scope="row" className="px-3 py-2 font-medium">{x.name}</th>
                  <td className="px-3 py-2">{x.description ?? "—"}</td>
                  <td className="px-3 py-2">{x.role}</td>
                  <td className="px-3 py-2">{x.sample_count}</td>
                  <td className="px-3 py-2">{fmtDate(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Card className="mt-6">
        <Unavailable title="Project creation">
          Creating projects requires multi-user authentication, which is not available in dev API-key compatibility mode (the backend responds 403).
        </Unavailable>
        <button type="button" disabled className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm opacity-50">New project</button>
      </Card>
    </>
  );
}
