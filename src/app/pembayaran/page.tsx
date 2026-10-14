import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, hasPerm } from "@/lib/auth";
import { dateOnly, getWeekGrid, iso, rupiah, settleAllCredits, todayWIB } from "@/lib/finance";
import { payStudent } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Nav } from "@/components/nav";

const input = "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";
const LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum"];
const CELL: Record<string, [string, string]> = {
  LUNAS: ["✓ Lunas", "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"],
  BELUM: ["Belum", "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"],
  BELUM_JT: ["–", "text-neutral-400"],
  LIBUR: ["Libur", "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"],
  "-": ["", ""],
};

async function Content({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const s = await getSession();
  if (!hasPerm(s, "student:read")) redirect("/");
  const w = (await searchParams).w;
  const base = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? dateOnly(w) : todayWIB();
  const monday = new Date(base.getTime() + (base.getUTCDay() === 0 ? -6 : 1 - base.getUTCDay()) * 864e5);
  await settleAllCredits(s.uid); // kredit otomatis melunasi hari yang sudah jatuh tempo
  const { days, rows } = await getWeekGrid(monday);
  const shift = (n: number) => `?w=${iso(new Date(monday.getTime() + n * 864e5))}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link href={shift(-7)} className="rounded-lg border px-3 py-1.5 dark:border-neutral-700">← Sebelumnya</Link>
        <span className="font-medium">{days[0]} s/d {days[4]}</span>
        <Link href={shift(7)} className="rounded-lg border px-3 py-1.5 dark:border-neutral-700">Berikutnya →</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="p-2">Nama</th>
            {days.map((d, i) => <th key={d} className="p-2 text-center">{LABEL[i]}<br /><span className="text-xs">{d.slice(8)}/{d.slice(5, 7)}</span></th>)}
            <th className="p-2 text-right">Kredit</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="p-2 font-medium">{r.name}</td>
                {r.cells.map((c, i) => <td key={i} className="p-1 text-center"><span className={`inline-block rounded-md px-2 py-1 text-xs ${CELL[c][1]}`}>{CELL[c][0]}</span></td>)}
                <td className="p-2 text-right">{rupiah(r.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasPerm(s, "payment:write") && (
        <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 font-medium">Catat pembayaran</h2>
          <ActionForm action={payStudent} label="Catat" className="space-y-3">
            <select name="studentId" required defaultValue="" className={input}>
              <option value="" disabled>Pilih siswa…</option>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input name="amount" type="number" min={1000} step={1000} defaultValue={1000} required className={input} />
            <input name="date" type="date" defaultValue={iso(todayWIB())} max={iso(todayWIB())} required className={input} />
            <p className="text-xs text-neutral-500">Kelipatan Rp1.000. Kelebihan dari kewajiban jatuh tempo menjadi kredit (bayar di muka).</p>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-neutral-900 dark:text-neutral-50">
      <Nav />
      <h1 className="text-xl font-semibold">Pembayaran Mingguan</h1>
      <Suspense fallback={<div className="skeleton h-48" />}><Content searchParams={searchParams} /></Suspense>
    </main>
  );
}
