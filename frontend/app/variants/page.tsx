import type { Metadata } from "next";
import { VariantsExplorer } from "@/components/VariantsExplorer";
import { ErrorNotice, PageHeader } from "@/components/ui";
import { isDemo } from "@/lib/api";
import { getSamples } from "@/lib/data";

export const metadata: Metadata = { title: "Variants" };
export const dynamic = "force-dynamic";

export default async function VariantsPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const [{ sample }, s, demo] = await Promise.all([searchParams, getSamples(), isDemo()]);
  return (
    <>
      <PageHeader title="Variants">Server-side paginated variant records from imported VCF files. Records are shown as imported; no annotation or interpretation is applied.</PageHeader>
      {!s.ok ? <ErrorNotice error={s.error} /> : (
        <VariantsExplorer samples={s.data.map((x) => ({ id: x.id, name: x.name }))} initialSample={sample} demo={demo} />
      )}
    </>
  );
}
