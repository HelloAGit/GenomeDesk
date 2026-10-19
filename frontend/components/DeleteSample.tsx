"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { proxy } from "@/lib/client";

export function DeleteSample({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!window.confirm(`Delete sample "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const r = await proxy(`api/samples/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.push("/samples");
    router.refresh();
  }
  return (
    <div>
      <button type="button" onClick={del} disabled={busy} className="rounded-md border border-red-400 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50">
        {busy ? "Deleting…" : "Delete sample"}
      </button>
      <div role="status" aria-live="polite">{err ? <p className="mt-2 text-sm text-red-800">{err}</p> : null}</div>
    </div>
  );
}
