import type { Metadata } from "next";
import { AssistantChat } from "@/components/AssistantChat";
import { ErrorNotice, PageHeader } from "@/components/ui";
import { isDemo } from "@/lib/api";
import { getAssistantStatus, getSamples } from "@/lib/data";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const [st, s, demo] = await Promise.all([getAssistantStatus(), getSamples(), isDemo()]);
  return (
    <>
      <PageHeader title="Assistant">Answers separate direct measurements, retrieved evidence, and model-generated interpretation. Nothing here is a clinical finding.</PageHeader>
      {!st.ok ? <ErrorNotice error={`Assistant status unavailable: ${st.error}`} /> : (
        <AssistantChat status={st.data} samples={s.ok ? s.data.map((x) => ({ id: x.id, name: x.name })) : []} demo={demo} />
      )}
    </>
  );
}
