"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { proxy } from "@/lib/client";
import type { Job } from "@/lib/types";
import { btn, inputCls } from "./ui";

export function CreateJob({ samples, demo }: { samples: { id: string; name: string }[]; demo: boolean }) {
  const router = useRouter();
  const [sample, setSample] = useState(samples[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (demo) return <p className="text-sm text-slate-700">Job creation is disabled in demo mode.</p>;
  if (samples.length === 0) return <p className="text-sm text-slate-700">Upload a sample to create a variant summary job.</p>;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await proxy<Job>("api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_type: "variant_summary", sample_id: sample }) });
    setBusy(false);
    setMsg(r.ok ? `Job ${r.data.id} created (${r.data.status}).` : r.error);
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="job-sample" className="mb-1 block text-sm font-medium">Sample</label>
        <select id="job-sample" className={inputCls} value={sample} onChange={(e) => setSample(e.target.value)}>
          {samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button type="submit" className={btn} disabled={busy}>{busy ? "Creating…" : "Run variant summary"}</button>
      <div role="status" aria-live="polite" className="w-full text-sm">{msg}</div>
    </form>
  );
}
