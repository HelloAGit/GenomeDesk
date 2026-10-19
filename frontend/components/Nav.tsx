"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/projects", "Projects"],
  ["/samples", "Samples"],
  ["/variants", "Variants"],
  ["/assistant", "Assistant"],
  ["/jobs", "Jobs"],
] as const;

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <nav aria-label="Main">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
        aria-expanded={open}
        aria-controls="main-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <ul id="main-menu" className={`${open ? "mt-2 flex" : "hidden"} flex-col gap-1 md:mt-0 md:flex md:flex-row`}>
        {LINKS.map(([href, label]) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-blue-700 text-white" : "text-slate-800 hover:bg-slate-100"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
