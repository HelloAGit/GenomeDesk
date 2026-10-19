"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { proxy } from "@/lib/client";
import { fmtBytes } from "@/lib/format";
import type { Capabilities, Sample } from "@/lib/types";
import { btn, inputCls } from "./ui";

export function UploadForm({ caps, demo }: { caps: Capabilities; demo: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setMsg({ kind: "err", text: "Choose a VCF file." });
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".vcf") || (lower.endsWith(".vcf.gz") && caps.vcf_gz_import))) {
      return setMsg({ kind: "err", text: caps.vcf_gz_import ? "File must end in .vcf or .vcf.gz." : "File must end in .vcf." });
    }
    if (file.size > caps.max_upload_bytes) {
      return setMsg({ kind: "err", text: `File is ${fmtBytes(file.size)}; the limit is ${fmtBytes(caps.max_upload_bytes)}.` });
    }
    setBusy(true);
    setMsg(null);
    const r = await proxy<Sample>("api/samples", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: "err", text: r.error });
    setMsg({ kind: "ok", text: `Imported ${r.data.name}.` });
    form.reset();
    router.refresh();
  }

  if (demo) return <p className="text-sm text-slate-700">Uploads are disabled in demo mode.</p>;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" aria-busy={busy}>
      <div>
        <label htmlFor="sample_name" className="mb-1 block text-sm font-medium">Sample name</label>
        <input id="sample_name" name="sample_name" required maxLength={200} className={inputCls} />
      </div>
      <div>
        <label htmlFor="assembly" className="mb-1 block text-sm font-medium">Reference assembly</label>
        <select id="assembly" name="assembly" className={inputCls} defaultValue="GRCh38">
          <option>GRCh37</option>
          <option>GRCh38</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="file" className="mb-1 block text-sm font-medium">VCF file ({caps.vcf_gz_import ? ".vcf or .vcf.gz" : ".vcf"}, max {fmtBytes(caps.max_upload_bytes)})</label>
        <input id="file" name="file" type="file" required accept={caps.vcf_gz_import ? ".vcf,.vcf.gz" : ".vcf"} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className={btn} disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </div>
      <div className="sm:col-span-2" role="status" aria-live="polite">
        {msg ? <p className={msg.kind === "ok" ? "text-sm text-green-800" : "text-sm text-red-800"}>{msg.text}</p> : null}
      </div>
    </form>
  );
}
