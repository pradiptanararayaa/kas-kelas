"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
export function WeeklyChart({ data }: { data: { minggu: string; masuk: number; keluar: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ left: -8, right: 4 }}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--panel)" /><rect width="2.5" height="6" fill="var(--ink)" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="minggu" fontSize={12} tickLine={false} axisLine={false} stroke="var(--line)" tick={{ fill: "var(--kmuted)" }} />
          <YAxis fontSize={12} width={44} tickLine={false} axisLine={false} stroke="var(--line)" tick={{ fill: "var(--kmuted)" }} tickFormatter={(v) => `${v / 1000}rb`} />
          <Tooltip cursor={false} formatter={(v) => fmt(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)" }} labelStyle={{ color: "var(--text)", fontWeight: 600 }} itemStyle={{ color: "var(--text)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "var(--kmuted)" }}>{v}</span>} />
          <Bar dataKey="masuk" name="Masuk" animationDuration={900} animationEasing="ease-out" fill="var(--ink)" radius={[6, 6, 0, 0]} activeBar={{ fill: "url(#hatch)", stroke: "var(--ink)" }} />
          <Bar dataKey="keluar" name="Keluar" animationBegin={150} animationDuration={900} animationEasing="ease-out" fill="var(--kbar2)" radius={[6, 6, 0, 0]} activeBar={{ fill: "var(--kmuted)" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
