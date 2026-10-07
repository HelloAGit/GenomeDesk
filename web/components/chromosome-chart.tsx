"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export function ChromosomeChart({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const data = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([chromosome, records]) => ({ chromosome, records }));
  if (!data.length)
    return <div className="chart-empty">No chromosome records yet.</div>;
  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`Records by chromosome: ${data.map((d) => `${d.chromosome}: ${d.records}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 15, right: 12, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e7eeeb"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="chromosome"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71827b", fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71827b", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "#f0f6f3" }}
              contentStyle={{
                borderRadius: 10,
                borderColor: "#dce6e0",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="records"
              name="VCF records"
              fill="#258b72"
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        One count per VCF record; multiallelic sites stay together.
      </p>
    </>
  );
}
