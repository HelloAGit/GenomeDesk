"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum { name: string; [series: string]: string | number }

export function SimpleBarChart({ data, series, label }: { data: BarDatum[]; series: { key: string; color: string }[]; label: string }) {
  if (data.length === 0) return <p className="text-sm text-slate-600">No data</p>;
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
