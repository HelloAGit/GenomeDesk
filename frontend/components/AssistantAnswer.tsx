import type { AssistantResponse } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Notice } from "./ui";

export function AssistantAnswer({ a }: { a: AssistantResponse }) {
  if (a.status === "unavailable") {
    return <Notice tone="warn" title="Assistant unavailable">{a.message ?? "The AI assistant is not available."} No answer was generated.</Notice>;
  }
  if (a.status === "provider_error") {
    return <Notice tone="error" title="AI provider error">{a.message ?? "The AI provider failed."} No answer was generated.</Notice>;
  }
  return (
    <div className="space-y-3 text-sm">
      {a.status === "no_data" ? <Notice tone="info" title="No data">{a.message ?? "No data was available for the selected samples."}</Notice> : null}
      <section aria-labelledby="sec-direct" className="rounded-md border-2 border-blue-700 bg-blue-50 p-3">
        <h3 id="sec-direct" className="font-semibold text-blue-900">Direct measurements</h3>
        {a.direct_measurements.length === 0 ? <p className="mt-1">None.</p> : a.direct_measurements.map((m) => (
          <div key={m.sample_id} className="mt-2">
            <p className="font-medium">{m.name}</p>
            <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {Object.entries(m.metrics).map(([k, v]) => (
                <div key={k}><dt className="text-slate-700">{k}</dt><dd className="font-mono">{v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>
              ))}
            </dl>
          </div>
        ))}
      </section>
      <section aria-labelledby="sec-evidence" className="rounded-md border-2 border-green-700 bg-green-50 p-3">
        <h3 id="sec-evidence" className="font-semibold text-green-900">Retrieved evidence</h3>
        {a.retrieved_evidence.length === 0 ? <p className="mt-1">No external evidence was retrieved.</p> : (
          <ul className="mt-1 space-y-2">
            {a.retrieved_evidence.map((e) => (
              <li key={`${e.source}-${e.record_id}`}>
                <p>{e.summary}</p>
                <p className="text-xs text-slate-700">{e.source} {e.source_version} · {e.record_id} · retrieved {fmtDate(e.retrieved_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="sec-interp" className="rounded-md border-2 border-dashed border-purple-700 bg-purple-50 p-3">
        <h3 id="sec-interp" className="font-semibold text-purple-900">Model-generated interpretation (not a finding)</h3>
        {a.interpretation ? (
          <>
            <p className="mt-1 whitespace-pre-wrap">{a.interpretation.text}</p>
            <p className="mt-1 text-xs text-slate-700">{a.interpretation.label} · model: {a.interpretation.model}</p>
          </>
        ) : <p className="mt-1">No interpretation was generated.</p>}
      </section>
      {a.sources.length > 0 ? (
        <div><h3 className="font-semibold">Sources</h3><ul className="list-disc pl-5">{a.sources.map((s) => <li key={`${s.type}-${s.id}`}>{s.id} {s.version} ({s.type})</li>)}</ul>{a.retrieval_date ? <p className="text-xs">Retrieved {fmtDate(a.retrieval_date)}</p> : null}</div>
      ) : null}
      {a.tools_used.length > 0 ? <p className="text-xs text-slate-700">Tools used: {a.tools_used.join(", ")}</p> : null}
      {a.limitations.length > 0 ? <div><h3 className="font-semibold">Limitations</h3><ul className="list-disc pl-5">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul></div> : null}
      <p className="text-xs italic text-slate-700">{a.disclaimer}</p>
    </div>
  );
}
