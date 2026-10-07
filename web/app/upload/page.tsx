"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  ArrowRight,
  Download,
  Info,
  Check,
  X,
} from "lucide-react";
import { api, bytes, number } from "@/lib/client";
import type { Capabilities, Sample } from "@/types/api";
import { PageHeading, ErrorNotice } from "@/components/ui";
export default function UploadPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [assembly, setAssembly] = useState("GRCh38");
  const [caps, setCaps] = useState<Capabilities>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    api<Capabilities>("/api/capabilities")
      .then(setCaps)
      .catch((e) => setError(e.message));
  }, []);
  function select(f?: File) {
    setError("");
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".vcf")) {
      setFile(null);
      setError(
        "Choose an uncompressed .vcf file. Compressed VCF, BCF, and FASTQ are not supported.",
      );
      return;
    }
    if (caps && f.size > caps.max_upload_bytes) {
      setFile(null);
      setError(
        `File exceeds the backend limit of ${bytes(caps.max_upload_bytes)}.`,
      );
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.vcf$/i, ""));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || busy) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("sample_name", name.trim());
    body.set("assembly", assembly);
    try {
      const s = await api<Sample>("/api/samples", { method: "POST", body });
      router.push(`/samples/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setBusy(false);
    }
  }
  async function example() {
    setError("");
    try {
      const r = await fetch("/synthetic.vcf");
      if (!r.ok) throw new Error("Example could not be loaded.");
      select(
        new File([await r.blob()], "synthetic.vcf", { type: "text/plain" }),
      );
      setName("Synthetic reference sample");
      setAssembly("GRCh38");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Example could not be loaded.");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="START WITH YOUR DATA"
        title="Import a VCF"
        text="Bring a small variant file into your workspace. We’ll keep its context intact."
      />
      {error && <ErrorNotice message={error} />}
      <div className="upload-grid">
        <form className="panel upload-form" onSubmit={submit}>
          <div className="section-heading">
            <span className="step-circle">1</span>
            <div>
              <h2>Select your file</h2>
              <p>Uncompressed Variant Call Format (.vcf)</p>
            </div>
          </div>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".vcf"
            aria-label="VCF file"
            disabled={busy}
            onChange={(e) => select(e.target.files?.[0])}
          />
          <div
            className={`dropzone ${drag ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!busy) select(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-symbol">
              <UploadCloud size={32} />
            </span>
            <h3>Drop your VCF file here</h3>
            <p>or select a file from your computer</p>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Browse files
            </button>
            <small>
              {caps
                ? `${bytes(caps.max_upload_bytes)} max · ${number(caps.max_records)} records max`
                : "Checking backend upload limits…"}
            </small>
          </div>
          {file && (
            <div className="selected-file">
              <FileText size={21} />
              <div>
                <strong>{file.name}</strong>
                <small>{bytes(file.size)} · Ready to import</small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove selected file"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  if (input.current) input.current.value = "";
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="section-heading">
            <span className="step-circle">2</span>
            <div>
              <h2>Add the context</h2>
              <p>Tell us how to label and interpret the file’s reference.</p>
            </div>
          </div>
          <label className="form-label">
            Sample name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research sample 001"
              maxLength={100}
              required
              disabled={busy}
            />
          </label>
          <label className="form-label">
            Reference assembly
            <select
              value={assembly}
              onChange={(e) => setAssembly(e.target.value)}
              disabled={busy}
            >
              <option value="GRCh38">GRCh38 · Human reference</option>
              <option value="GRCh37">GRCh37 · Human reference</option>
            </select>
          </label>
          <div className="inline-note">
            <Info size={17} />
            <p>
              A recognised assembly in the VCF header must match your selection.
              Other reference declarations are preserved as unverified
              provenance.
            </p>
          </div>
          <div className="form-actions">
            <span>No annotation or diagnosis is performed.</span>
            <button
              className="button"
              disabled={!file || !name.trim() || busy || !caps?.vcf_import}
              type="submit"
            >
              {busy ? (
                <>
                  <span className="spinner" /> Importing…
                </>
              ) : (
                <>
                  Import sample <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
        <aside>
          <section className="panel example-card">
            <span className="tag green">TRY IT FIRST</span>
            <h2>
              A small file.
              <br />A complete walkthrough.
            </h2>
            <p>
              Our synthetic fixture includes four records across two
              chromosomes, with PASS, LowQual, and unfiltered sites.
            </p>
            <ul>
              <li>
                <Check size={16} /> Synthetic data only
              </li>
              <li>
                <Check size={16} /> GRCh38 reference
              </li>
              <li>
                <Check size={16} /> No credentials to a data provider needed
              </li>
            </ul>
            <button
              className="button secondary"
              onClick={example}
              disabled={busy}
            >
              Use synthetic example <ArrowRight size={16} />
            </button>
            <a href="/synthetic.vcf" download className="text-link">
              <Download size={15} /> Download VCF
            </a>
          </section>
          <div className="side-note">
            <Info size={19} />
            <div>
              <h3>Know what’s supported</h3>
              <p>
                This prototype accepts small, uncompressed VCF files. Compressed
                VCF, BCF, FASTQ, and annotation pipelines are not available.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
