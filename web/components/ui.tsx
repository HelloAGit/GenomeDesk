"use client";
import Link from "next/link";
import { AlertCircle, ArrowRight, FileUp, RefreshCw, Dna } from "lucide-react";
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert" aria-label="Request error">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <button className="button small secondary" onClick={retry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
export function Loading({ text = "Loading workspace…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
export function Empty({
  title = "Your next discovery starts here",
  text = "Import an uncompressed VCF to explore its variants, quality metrics, and reference provenance.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Dna size={31} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="button" href="/upload">
        <FileUp size={17} /> Import your first VCF <ArrowRight size={16} />
      </Link>
      <a className="text-link" href="/synthetic.vcf" download>
        Download the synthetic example
      </a>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {label}
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
