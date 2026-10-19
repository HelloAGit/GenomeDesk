import Link from "next/link";
import type { SampleComparison as SC } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { SimpleBarChart } from "./Charts";
import { TableWrap } from "./ui";

export function SampleComparison({ rows }: { rows: SC[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-600">No samples to compare.</p>;
  return (
    <div className="space-y-4">
      <SimpleBarChart
        label="Variant records and PASS records per sample"
        data={rows.map((r) => ({ name: r.name, Records: r.record_count, PASS: r.pass_record_count }))}
        series={[{ key: "Records", color: "#1d4ed8" }, { key: "PASS", color: "#15803d" }]}
      />
      <TableWrap label="Sample comparison">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Sample comparison</caption>
          <thead className="bg-slate-100">
            <tr>
              {["Sample", "Assembly", "Records", "PASS", "Mean QUAL", "Mean depth"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <th scope="row" className="px-3 py-2 font-medium"><Link className="text-blue-700 underline" href={`/samples/${encodeURIComponent(r.id)}`}>{r.name}</Link></th>
                <td className="px-3 py-2">{r.assembly}</td>
                <td className="px-3 py-2">{fmtNum(r.record_count)}</td>
                <td className="px-3 py-2">{fmtNum(r.pass_record_count)}</td>
                <td className="px-3 py-2">{fmtNum(r.mean_variant_quality)}</td>
                <td className="px-3 py-2">{fmtNum(r.mean_site_depth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
