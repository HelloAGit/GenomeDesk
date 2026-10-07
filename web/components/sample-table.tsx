"use client";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { Sample } from "@/types/api";
import { date, number, bytes } from "@/lib/client";
export function SampleTable({ samples }: { samples: Sample[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Sample name</th>
            <th>Assembly</th>
            <th>Records</th>
            <th>Reference</th>
            <th>Imported</th>
            <th>
              <span className="sr-only">Open sample</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {samples.map((s) => (
            <tr key={s.id}>
              <td>
                <Link className="sample-name" href={`/samples/${s.id}`}>
                  <span className="file-icon">
                    <FileText size={18} />
                  </span>
                  <span>
                    {s.name}
                    <small>{bytes(s.size_bytes)} · VCF</small>
                  </span>
                </Link>
              </td>
              <td>
                <span className="tag neutral">{s.assembly}</span>
              </td>
              <td className="numeric">{number(s.summary.record_count)}</td>
              <td>
                <span
                  className={`tag ${s.reference_verification === "header-match" ? "green" : "amber"}`}
                >
                  {s.reference_verification === "header-match"
                    ? "Header match"
                    : "Unverified"}
                </span>
              </td>
              <td className="muted">{date(s.created_at)}</td>
              <td>
                <Link
                  className="icon-button"
                  href={`/samples/${s.id}`}
                  aria-label={`Explore ${s.name}`}
                >
                  <ArrowUpRight size={19} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
