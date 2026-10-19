import type { ReactNode } from "react";
import type { JobStatus } from "@/lib/types";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {children ? <p className="mt-1 text-sm text-slate-600">{children}</p> : null}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title ? <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

const TONES = {
  error: "border-red-300 bg-red-50 text-red-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
  empty: "border-dashed border-slate-300 bg-slate-50 text-slate-700",
} as const;

export function Notice({ tone, title, children }: { tone: keyof typeof TONES; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border p-4 text-sm ${TONES[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export const ErrorNotice = ({ error }: { error: string }) => (
  <Notice tone="error" title="Could not load data">{error}</Notice>
);

export function Unavailable({ title, children }: { title: string; children?: ReactNode }) {
  return <Notice tone="warn" title={`Unavailable: ${title}`}>{children}</Notice>;
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export function LoadingPage({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton /><Skeleton /><Skeleton />
      </div>
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}

const STATUS_STYLE: Record<JobStatus, string> = {
  planned: "bg-slate-200 text-slate-800",
  queued: "bg-sky-100 text-sky-900",
  running: "bg-amber-100 text-amber-900",
  completed: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-slate-200"}`}>{status}</span>;
}

export const btn =
  "inline-flex items-center justify-center rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls = "w-full rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm";

export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
