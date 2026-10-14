import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, hasPerm } from "@/lib/auth";
import { iso, rupiah, todayWIB } from "@/lib/finance";
import { CATEGORIES } from "@/lib/constants";
import { createOtherIncome, createExpense, voidIncome, voidExpense } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Tabs } from "@/components/tabs";
import { Nav } from "@/components/nav";

const input = "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";
type Row = { kind: "IN" | "OUT"; id: string; date: Date; createdAt: Date; amount: number; title: string; sub: string; proof?: string | null; voidedAt: Date | null; voidReason: string | null };

async function Content({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const s = await getSession();
  if (!hasPerm(s, "student:read")) redirect("/");
  const t = (await searchParams).t;
  const [inc, exp] = await Promise.all([
    t === "keluar" ? [] : prisma.income.findMany({ include: { student: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    t === "masuk" ? [] : prisma.expense.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  const rows: Row[] = [
    ...inc.map((i): Row => ({ kind: "IN", id: i.id, date: i.date, createdAt: i.createdAt, amount: i.amount, voidedAt: i.voidedAt, voidReason: i.voidReason,
      title: i.type === "STUDENT_PAYMENT" ? `Kas: ${i.student?.name ?? "-"}` : (i.description ?? "Uang masuk"), sub: i.type === "STUDENT_PAYMENT" ? "Pembayaran siswa" : "Uang masuk lain" })),
    ...exp.map((e): Row => ({ kind: "OUT", id: e.id, date: e.date, createdAt: e.createdAt, amount: e.amount, voidedAt: e.voidedAt, voidReason: e.voidReason,
      title: e.description, sub: e.category, proof: e.proofUrl })),
  ].sort((a, b) => +b.date - +a.date || +b.createdAt - +a.createdAt);
  const admin = hasPerm(s, "void");
  const today = iso(todayWIB());
  const tab = (k: string, label: string) => (
    <a href={k ? `?t=${k}` : "?"} className={`rounded-lg px-3 py-1.5 text-sm ${(t ?? "") === k ? "bg-emerald-600 text-white" : "border border-neutral-300 dark:border-neutral-700"}`}>{label}</a>
  );
  return (
    <div className="space-y-4">
      {hasPerm(s, "income:write") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <details className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium">+ Uang masuk lain</summary>
            <ActionForm action={createOtherIncome} label="Simpan" className="mt-3 space-y-3">
              <input name="amount" type="number" min={1} placeholder="Nominal (Rp)" required className={input} />
              <input name="date" type="date" defaultValue={today} max={today} required className={input} />
              <input name="description" placeholder="Deskripsi (mis. hasil jualan)" required className={input} />
            </ActionForm>
          </details>
          <details className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium">+ Pengeluaran</summary>
            <ActionForm action={createExpense} label="Simpan" className="mt-3 space-y-3">
              <input name="amount" type="number" min={1} placeholder="Nominal (Rp)" required className={input} />
              <input name="date" type="date" defaultValue={today} max={today} required className={input} />
              <select name="category" required className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <input name="description" placeholder="Deskripsi" required className={input} />
              <input name="proofUrl" type="url" placeholder="Tautan bukti (opsional)" className={input} />
            </ActionForm>
          </details>
        </div>
      )}
      <Tabs id="trx-tab" active={t === "masuk" || t === "keluar" ? t : ""} items={[
        { key: "", label: "Semua", href: "/transaksi" },
        { key: "masuk", label: "Masuk", href: "?t=masuk" },
        { key: "keluar", label: "Keluar", href: "?t=keluar" }]} />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.kind}${r.id}`} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className={`flex justify-between gap-2 ${r.voidedAt ? "line-through opacity-50" : ""}`}>
              <div><p className="font-medium">{r.title}</p><p className="text-sm text-neutral-500">{iso(r.date)} · {r.sub}</p></div>
              <p className={`font-semibold ${r.kind === "IN" ? "text-emerald-600" : "text-red-600"}`}>{r.kind === "IN" ? "+" : "−"}{rupiah(r.amount)}</p>
            </div>
            {r.proof && <a href={r.proof} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600">Lihat bukti</a>}
            {r.voidedAt && <p className="text-sm text-red-600">Dibatalkan: {r.voidReason}</p>}
            {admin && !r.voidedAt && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-red-600">Batalkan</summary>
                <ActionForm action={r.kind === "IN" ? voidIncome : voidExpense} label="Konfirmasi batal" variant="danger" className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="reason" placeholder="Alasan pembatalan" required className={input} />
                </ActionForm>
              </details>
            )}
          </li>
        ))}
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">Belum ada transaksi.</p>}
      </ul>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 text-neutral-900 dark:text-neutral-50">
      <Nav />
      <h1 className="text-xl font-semibold">Riwayat Transaksi</h1>
      <Suspense fallback={<div className="skeleton h-48" />}><Content searchParams={searchParams} /></Suspense>
    </main>
  );
}
