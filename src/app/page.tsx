import { Suspense } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getDashboard, iso, rupiah, settleAllCredits } from "@/lib/finance";
import { CountUp } from "@/components/count-up";
import { WeeklyChart } from "@/components/chart";
import { Nav } from "@/components/nav";

const card = "rounded-2xl p-5";
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

function Pill({ v, invert = false }: { v: number | null; invert?: boolean }) {
  if (v === null) return null;
  const good = invert ? v <= 0 : v >= 0;
  const I = v >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`pill ${good ? "up" : "down"}`}><I size={12} />{v > 0 ? "+" : ""}{v}%</span>;
}
const Stat = ({ label, value, num, delta, invert, tone = "" }: { label: string; value?: string; num?: number; delta?: number | null; invert?: boolean; tone?: string }) => (
  <div className={card}>
    <p className="text-sm text-neutral-500">{label}</p>
    <div className="mt-2 flex items-end justify-between gap-2">
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{num !== undefined ? <CountUp n={num} /> : value}</p>
      {delta !== undefined && <Pill v={delta} invert={invert} />}
    </div>
  </div>
);

async function Content() {
  const s = await getSession();
  await settleAllCredits(s?.uid ?? "system");
  const d = await getDashboard();
  if (s?.role === "SISWA") {
    const me = d.arrears.find((a) => a.studentId === s.studentId);
    const pays = s.studentId ? await prisma.income.findMany({ where: { studentId: s.studentId, voidedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }) : [];
    if (!me) return <p className="text-sm text-neutral-500">Akun Anda belum terhubung ke data siswa aktif. Hubungi bendahara.</p>;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Status" value={me.lunas ? "Lunas" : "Belum lunas"} tone={me.lunas ? "text-emerald-600" : "text-red-600"} />
          <Stat label="Tunggakan" num={me.arrears} tone={me.arrears ? "text-red-600" : ""} />
          <Stat label="Saldo kredit" num={me.credit} />
          <Stat label="Hari belum lunas" value={String(me.unpaidDays)} />
        </div>
        <h2>Riwayat pembayaran Anda</h2>
        <ul className="space-y-2">
          {pays.map((p) => <li key={p.id} className="rounded-2xl flex justify-between p-4 text-sm"><span>{iso(p.date)}</span><span className="font-semibold text-emerald-600">{rupiah(p.amount)}</span></li>)}
          {pays.length === 0 && <p className="text-sm text-neutral-500">Belum ada pembayaran.</p>}
        </ul>
      </div>
    );
  }
  const total = d.lunas + d.belumLunas;
  const ratio = Math.round((d.lunas / Math.max(1, total)) * 100);
  const sum8 = d.chart.reduce((a, c) => a + c.masuk, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Saldo kas" num={d.saldo} />
        <Stat label="Pemasukan minggu ini" num={d.masukMinggu} delta={pct(d.masukMinggu, d.chart[6].masuk)} />
        <Stat label="Pengeluaran minggu ini" num={d.keluarMinggu} delta={pct(d.keluarMinggu, d.chart[6].keluar)} invert />
        <Stat label="Siswa lunas" value={`${d.lunas} / ${total}`} />
        <Stat label="Siswa menunggak" value={String(d.belumLunas)} tone={d.belumLunas ? "text-red-600" : ""} />
        <Stat label="Total tunggakan" num={d.tunggakan} tone={d.tunggakan ? "text-red-600" : ""} />
      </div>
      <section className={card}>
        <p className="text-sm text-neutral-500">Pemasukan 8 minggu terakhir</p>
        <div className="mb-3 mt-1 flex items-center gap-3">
          <p className="text-2xl font-bold tracking-tight"><CountUp n={sum8} /></p>
          <Pill v={pct(d.masukMinggu, d.chart[6].masuk)} />
        </div>
        <WeeklyChart data={d.chart} />
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className={card}>
          <div className="mb-3 flex justify-between text-sm"><span className="font-semibold">Kelunasan kelas</span><span className="text-neutral-500">{ratio}%</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${ratio}%` }} /></div>
          <p className="mt-3 text-sm text-neutral-500">{d.lunas} dari {total} siswa sudah lunas.</p>
        </section>
        <section className={card}>
          <h2 className="mb-2">Daftar tunggakan</h2>
          {d.belumLunas === 0 ? <p className="text-sm text-neutral-500">Tidak ada tunggakan.</p> : (
            <ul className="divide-y divide-neutral-200 text-sm">
              {d.arrears.filter((a) => !a.lunas).slice(0, 8).map((a) => (
                <li key={a.studentId} className="flex justify-between py-2"><span>{a.name} <span className="text-neutral-500">({a.unpaidDays} hari)</span></span><span className="font-medium text-red-600">{rupiah(a.arrears)}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <Nav />
      <h1 className="mb-4">Dashboard</h1>
      <Suspense fallback={<div className="skeleton h-48" />}><Content /></Suspense>
    </main>
  );
}
