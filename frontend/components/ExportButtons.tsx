"use client";
import { dashboardToCsv, download } from "@/lib/export";
import type { Dashboard } from "@/lib/types";
import { btnSecondary } from "./ui";

export function ExportButtons({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Export dashboard">
      <button type="button" className={btnSecondary} onClick={() => download("genomedesk-dashboard.csv", "text/csv;charset=utf-8", dashboardToCsv(dashboard))}>
        Export CSV
      </button>
      <button type="button" className={btnSecondary} onClick={() => download("genomedesk-dashboard.json", "application/json", JSON.stringify(dashboard, null, 2))}>
        Export JSON
      </button>
    </div>
  );
}
