"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dna,
  LayoutDashboard,
  Layers3,
  Upload,
  BookOpen,
  ArrowUpRight,
  CircleHelp,
  Menu,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/samples", label: "Sample library", icon: Layers3 },
  { href: "/upload", label: "Import VCF", icon: Upload },
  { href: "/reference", label: "Integration guide", icon: BookOpen },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [online, setOnline] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () =>
      api<{ status: string }>("/api/health")
        .then((r) => {
          if (live) setOnline(r.status === "ok");
        })
        .catch(() => {
          if (live) setOnline(false);
        });
    check();
    const timer = setInterval(check, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <Dna size={25} />
          </span>
          <span>
            Genome<span className="brand-light">Desk</span>
            <small>RESEARCH WORKSPACE</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" /> Local workspace{" "}
          <span className="badge">DEMO</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-link ${(href === "/" ? path === "/" : path.startsWith(href)) ? "active" : ""}`}
            >
              <Icon size={19} />
              {label}
              {href === "/upload" && <span className="nav-plus">+</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-guide">
          <CircleHelp size={21} />
          <h3>A clear view of your variants.</h3>
          <p>
            Explore small VCF files, understand their metrics, and connect your
            next frontend.
          </p>
          <Link href="/reference" onClick={() => setOpen(false)}>
            Explore the API <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <span className={`status-dot ${online === false ? "offline" : ""}`} />
          <div>
            {online === null
              ? "Connecting to backend"
              : online
                ? "Backend connected"
                : "Backend unavailable"}
            <small>FastAPI · SQLite</small>
          </div>
          <span className="version">v0.1</span>
        </div>
      </aside>
      {open && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {path === "/"
                ? "Overview"
                : path === "/upload"
                  ? "Import VCF"
                  : path === "/reference"
                    ? "Integration guide"
                    : path === "/samples"
                      ? "Sample library"
                      : "Sample details"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="research-pill">
              <span /> Research use only
            </span>
            <span className="avatar">GD</span>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <span>GenomeDesk · Local reference application</span>
          <span>Explore with context. Interpret with care.</span>
        </footer>
      </div>
    </div>
  );
}
