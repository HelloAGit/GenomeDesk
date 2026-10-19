import type { Metadata } from "next";
import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";
import { Card, ErrorNotice, Notice, PageHeader, TableWrap, Unavailable } from "@/components/ui";
import { isDemo } from "@/lib/api";
import { getCapabilities, getSamples } from "@/lib/data";
import { fmtBytes, fmtDate, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Samples" };
export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  const [s, caps, demo] = await Promise.all([getSamples(), getCapabilities(), isDemo()]);
  return (
    <>
      <PageHeader title="Samples">Imported VCF samples. FASTQ upload is planned and not available.</PageHeader>
      <Card title="Upload VCF" className="mb-6">
        {!caps.ok ? <ErrorNotice error={`Capabilities unavailable: ${caps.error}`} /> : !caps.data.vcf_import ? (
          <Unavailable title="VCF import">The backend reports VCF import is disabled.</Unavailable>
        ) : (
          <UploadForm caps={caps.data} demo={demo} />
        )}
        {caps.ok && !caps.data.fastq_processing ? (
          <p className="mt-3 text-sm text-slate-700">FASTQ processing: planned — not operational.</p>
        ) : null}
      </Card>
      {!s.ok ? <ErrorNotice error={s.error} /> : s.data.length === 0 ? (
        <Notice tone="empty" title="No samples">Upload a VCF above to get started.</Notice>
      ) : (
        <TableWrap label="Samples">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Samples</caption>
            <thead className="bg-slate-100"><tr>{["Name", "Assembly", "Format", "Records", "PASS", "Size", "Created"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {s.data.map((x) => (
                <tr key={x.id} className="border-t border-slate-200">
                  <th scope="row" className="px-3 py-2 font-medium"><Link className="text-blue-700 underline" href={`/samples/${encodeURIComponent(x.id)}`}>{x.name}</Link></th>
                  <td className="px-3 py-2">{x.assembly}</td>
                  <td className="px-3 py-2">{x.source_format}</td>
                  <td className="px-3 py-2">{fmtNum(x.summary.record_count)}</td>
                  <td className="px-3 py-2">{fmtNum(x.summary.pass_record_count)}</td>
                  <td className="px-3 py-2">{fmtBytes(x.size_bytes)}</td>
                  <td className="px-3 py-2">{fmtDate(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
