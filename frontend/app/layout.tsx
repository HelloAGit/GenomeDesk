import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isDemo } from "@/lib/api";
import { DEMO_BANNER } from "@/lib/demo";
import { DemoToggle } from "@/components/DemoToggle";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GenomeDesk", template: "%s · GenomeDesk" },
  description: "Research-use genomics workspace",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const demo = await isDemo();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to main content
        </a>
        {demo ? (
          <div role="status" className="sticky top-0 z-40 bg-amber-400 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-black">
            {DEMO_BANNER}
          </div>
        ) : null}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-lg font-bold">GenomeDesk</span>
            <Nav />
            <DemoToggle demo={demo} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-6xl px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-700">
          Research and development use only; not a validated clinical diagnostic device.
        </footer>
      </body>
    </html>
  );
}
