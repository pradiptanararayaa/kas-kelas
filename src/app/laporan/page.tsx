import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, hasPerm } from "@/lib/auth";
import { getReport, periodRange, rupiah } from "@/lib/finance";
import { Tabs } from "@/components/tabs";
import { PeriodPicker } from "@/components/period-picker";
import { Nav } from "@/components/nav";

const input = "rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";
const card = "rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";
type SP = Promise<{ t?: string; p?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  if (!hasPerm(await getSession(), "report:read")) redirect("/");
  const sp = await searchParams;
  const t = ["mingguan", "bulanan", "tahunan"].includes(sp.t ?? "") ? (sp.t as string) : "bulanan";
  const r = periodRange(t, sp.p);
  const rep = await getReport(r.from, r.to);
  const qs = `t=${t}&p=${r.p}`;
  const type = t === "mingguan" ? "date" : t === "bulanan" ? "month" : "number";
  return (
    <div className="space-y-4">
      <Tabs id="lap-tab" active={t} items={[
        { key: "mingguan", label: "Mingguan", href: "?t=mingguan" },
        { key: "bulanan", label: "Bulanan", href: "?t=bulanan" },
        { key: "tahunan", label: "Tahunan", href: "?t=tahunan" }]} />
      <PeriodPicker t={t} type={type} value={r.p} />
      <p className="text-sm text-neutral-500">{r.label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className={card}><p className="text-xs text-neutral-500">Saldo awal</p><p className="font-semibold">{rupiah(rep.opening)}</p></div>
        <div className={card}><p className="text-xs text-neutral-500">Saldo akhir</p><p className="font-semibold">{rupiah(rep.closing)}</p></div>
        <div className={card}><p className="text-xs text-neutral-500">Total masuk</p><p className="font-semibold text-emerald-600">{rupiah(rep.totalIn)}</p></div>
        <div className={card}><p className="text-xs text-neutral-500">Total keluar</p><p className="font-semibold text-red-600">{rupiah(rep.totalOut)}</p></div>
      </div>
      <a href={`/api/laporan?${qs}`} className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Ekspor CSV</a>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Tanggal</th><th className="p-2">Keterangan</th><th className="p-2 text-right">Masuk</th><th className="p-2 text-right">Keluar</th></tr></thead>
          <tbody>
            {rep.rows.map((x, i) => (
              <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="p-2">{x.date}</td><td className="p-2">{x.kategori}: {x.deskripsi}</td>
                <td className="p-2 text-right text-emerald-600">{x.masuk ? rupiah(x.masuk) : ""}</td>
                <td className="p-2 text-right text-red-600">{x.keluar ? rupiah(x.keluar) : ""}</td>
              </tr>
            ))}
            {rep.rows.length === 0 && <tr><td colSpan={4} className="p-3 text-neutral-500">Tidak ada transaksi pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-neutral-900 dark:text-neutral-50">
      <Nav />
      <h1 className="text-xl font-semibold">Laporan Keuangan</h1>
      <Suspense fallback={<div className="skeleton h-48" />}><Content searchParams={searchParams} /></Suspense>
    </main>
  );
}
