"use client";
import { useRef, useState } from "react";
import { proxy } from "@/lib/client";
import { demoAssistantAnswer } from "@/lib/demo";
import type { AssistantResponse, AssistantStatus } from "@/lib/types";
import { AssistantAnswer } from "./AssistantAnswer";
import { btn, btnSecondary, inputCls, Notice } from "./ui";

interface Turn { question: string; answer: AssistantResponse }

export function AssistantChat({ samples, status, demo }: { samples: { id: string; name: string }[]; status: AssistantStatus; demo: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function run(question: string, path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    let answer: AssistantResponse | null = null;
    if (demo) answer = demoAssistantAnswer(selected, conversationId);
    else {
      const r = await proxy<AssistantResponse>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) answer = r.data;
      else setError(r.error);
    }
    setBusy(false);
    if (answer) {
      setConversationId(answer.conversation_id);
      setTurns((t) => [...t, { question, answer: answer as AssistantResponse }]);
      setTimeout(() => endRef.current?.scrollIntoView({ block: "nearest" }), 0);
    }
  }

  const ids = selected.length ? { sample_ids: selected } : {};
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = message.trim();
    if (!m) return;
    setMessage("");
    await run(m, "api/assistant/chat", { message: m, ...ids, ...(conversationId ? { conversation_id: conversationId } : {}) });
  };

  return (
    <div className="space-y-4">
      {!status.available ? (
        <Notice tone="warn" title="AI assistant unavailable">{status.reason ?? "The AI assistant is not configured on the backend."} Chat is disabled; no output will be generated.</Notice>
      ) : (
        <p className="text-sm text-slate-700">Model: {status.model ?? "unspecified"}. Variant-level data sharing with the provider: {status.variant_level_sharing ? "enabled" : "disabled"}.</p>
      )}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium">Samples to include (none selected = all)</legend>
        {samples.length === 0 ? <p className="text-sm text-slate-600">No samples available.</p> : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {samples.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-4" aria-live="polite" aria-relevant="additions">
        {turns.length === 0 ? <Notice tone="empty" title="No messages yet">Ask a question about the selected samples, or generate a research summary.</Notice> : null}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="rounded-md bg-slate-200 p-2 text-sm"><span className="font-semibold">You: </span>{t.question}</p>
            <AssistantAnswer a={t.answer} />
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div role="status" aria-live="polite">{busy ? <p className="text-sm">Working…</p> : null}{error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}</div>

      <form onSubmit={send} className="space-y-2">
        <label htmlFor="msg" className="block text-sm font-medium">Message (max 2000 characters)</label>
        <textarea id="msg" className={inputCls} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={!status.available || busy} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btn} disabled={!status.available || busy || !message.trim()}>Send</button>
          <button type="button" className={btnSecondary} disabled={!status.available || busy} onClick={() => run("Generate research summary", "api/assistant/summary", ids)}>Generate research summary</button>
          {conversationId ? <button type="button" className={btnSecondary} onClick={() => { setTurns([]); setConversationId(undefined); }}>New conversation</button> : null}
        </div>
      </form>
    </div>
  );
}
