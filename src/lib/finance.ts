import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;
export class BizError extends Error {}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const dateOnly = (s: string) => new Date(`${s}T00:00:00Z`);
export const todayWIB = () =>
  dateOnly(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()));
export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Hari wajib: Senin–Jumat, di luar libur kalender sekolah. */
export function schoolDays(from: Date, to: Date, holidays: Set<string>): string[] {
  const out: string[] = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 864e5)) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5 && !holidays.has(iso(d))) out.push(iso(d));
  }
  return out;
}

async function getSetting(tx: Tx) {
  const s = await tx.setting.findUnique({ where: { id: 1 } });
  if (!s) throw new BizError("Pengaturan kas belum dibuat (jalankan seed/inisialisasi)");
  return s;
}

/** Hari jatuh tempo (<= asOf) yang belum lunas untuk seorang siswa. */
async function unpaidDays(tx: Tx, studentId: string, asOf: Date) {
  const [st, hol, paid] = await Promise.all([
    tx.student.findUniqueOrThrow({ where: { id: studentId } }),
    tx.holiday.findMany(),
    tx.allocation.findMany({ where: { studentId, voidedAt: null }, select: { dueDate: true } }),
  ]);
  const end = st.endDate && st.endDate < asOf ? st.endDate : asOf;
  const paidSet = new Set(paid.map((p) => iso(p.dueDate)));
  return schoolDays(st.startDate, end, new Set(hol.map((h) => iso(h.date)))).filter((d) => !paidSet.has(d));
}

/** Pakai saldo kredit untuk melunasi kewajiban jatuh tempo tertua. TIDAK membuat Income. */
export async function applyCredit(tx: Tx, studentId: string, asOf: Date, userId: string) {
  const { dailyFee } = await getSetting(tx);
  const st = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
  if (st.creditBalance < dailyFee) return 0;
  const unpaid = await unpaidDays(tx, studentId, asOf);
  const n = Math.min(Math.floor(st.creditBalance / dailyFee), unpaid.length);
  if (n === 0) return 0;
  for (const d of unpaid.slice(0, n)) {
    // activeKey unik: jika terjadi balapan, DB melempar error & transaksi rollback.
    await tx.allocation.create({
      data: { studentId, dueDate: dateOnly(d), amount: dailyFee, activeKey: `${studentId}:${d}` },
    });
  }
  await tx.student.update({ where: { id: studentId }, data: { creditBalance: { decrement: n * dailyFee } } });
  await tx.auditLog.create({
    data: { userId, action: "CREDIT_APPLIED", entity: "Student", entityId: studentId,
      before: { credit: st.creditBalance }, after: { credit: st.creditBalance - n * dailyFee, days: unpaid.slice(0, n) } },
  });
  return n;
}

/**
 * Catat uang diterima dari siswa (bayar hari ini, tunggakan, atau di muka).
 * Satu Income dicatat sebesar uang yang diterima; kelebihan menjadi kredit,
 * lalu kredit otomatis melunasi kewajiban jatuh tempo tertua.
 */
export async function recordStudentPayment(input: { studentId: string; amount: number; date: Date; userId: string }) {
  return prisma.$transaction(async (tx) => {
    // SQLite mengunci database saat menulis, jadi transaksi ini berjalan serial; activeKey unik jadi pengaman kedua.
    const { dailyFee } = await getSetting(tx);
    const st = await tx.student.findUnique({ where: { id: input.studentId } });
    if (!st) throw new BizError("Siswa tidak ditemukan");
    if (!st.active) throw new BizError("Siswa nonaktif");
    if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount % dailyFee !== 0)
      throw new BizError(`Nominal harus kelipatan ${rupiah(dailyFee)}`);
    if (input.date > todayWIB()) throw new BizError("Tanggal penerimaan tidak boleh di masa depan");

    const income = await tx.income.create({
      data: { type: "STUDENT_PAYMENT", amount: input.amount, date: input.date, studentId: st.id, createdById: input.userId },
    });
    await tx.student.update({ where: { id: st.id }, data: { creditBalance: { increment: input.amount } } });
    await tx.auditLog.create({
      data: { userId: input.userId, action: "CREATE", entity: "Income", entityId: income.id, after: income as unknown as Prisma.InputJsonValue },
    });
    const days = await applyCredit(tx, st.id, todayWIB(), input.userId);
    return { incomeId: income.id, daysSettled: days };
  });
}

/** Tunggakan seluruh siswa aktif: kewajiban jatuh tempo belum lunas dikurangi kredit. */
export async function getArrears(asOf = todayWIB()) {
  const { dailyFee } = await prisma.setting.findUniqueOrThrow({ where: { id: 1 } });
  const students = await prisma.student.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return prisma.$transaction(async (tx) =>
    Promise.all(students.map(async (s) => {
      const unpaid = (await unpaidDays(tx, s.id, asOf)).length;
      const owed = Math.max(0, unpaid * dailyFee - s.creditBalance);
      return { studentId: s.id, name: s.name, unpaidDays: unpaid, credit: s.creditBalance, arrears: owed, lunas: owed === 0 };
    })));
}

/** Saldo kas = saldo awal + pemasukan sah − pengeluaran sah. */
export async function getBalance() {
  const [s, i, e] = await Promise.all([
    prisma.setting.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.income.aggregate({ _sum: { amount: true }, where: { voidedAt: null } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { voidedAt: null } }),
  ]);
  return s.openingBalance + (i._sum.amount ?? 0) - (e._sum.amount ?? 0);
}

/** Jalankan penutupan kewajiban otomatis dengan kredit untuk hari yang sudah jatuh tempo. */
export async function settleAllCredits(userId: string) {
  const { dailyFee } = await getSettingOutside();
  const list = await prisma.student.findMany({ where: { active: true, creditBalance: { gte: dailyFee } }, select: { id: true } });
  for (const s of list) await prisma.$transaction((tx) => applyCredit(tx, s.id, todayWIB(), userId));
}
const getSettingOutside = () => prisma.setting.findUniqueOrThrow({ where: { id: 1 } });

/** Grid Senin–Jumat: LUNAS | BELUM (sudah jatuh tempo) | BELUM_JT (belum jatuh tempo) | LIBUR | "-" */
export async function getWeekGrid(monday: Date, q?: string) {
  const days = [0, 1, 2, 3, 4].map((i) => iso(new Date(monday.getTime() + i * 864e5)));
  const friday = dateOnly(days[4]);
  const [students, hol, allocs] = await Promise.all([
    prisma.student.findMany({ where: { active: true, ...(q ? { name: { contains: q } } : {}) }, orderBy: { name: "asc" } }),
    prisma.holiday.findMany({ where: { date: { gte: monday, lte: friday } } }),
    prisma.allocation.findMany({ where: { voidedAt: null, dueDate: { gte: monday, lte: friday } } }),
  ]);
  const holSet = new Set(hol.map((h) => iso(h.date)));
  const paid = new Set(allocs.map((a) => `${a.studentId}:${iso(a.dueDate)}`));
  const today = iso(todayWIB());
  const rows = students.map((s) => ({
    id: s.id, name: s.name, credit: s.creditBalance,
    cells: days.map((d) => {
      if (holSet.has(d)) return "LIBUR";
      if (d < iso(s.startDate) || (s.endDate && d > iso(s.endDate))) return "-";
      if (paid.has(`${s.id}:${d}`)) return "LUNAS";
      return d <= today ? "BELUM" : "BELUM_JT";
    }),
  }));
  return { days, rows };
}

/** Saldo kas di dalam transaksi DB (dipakai untuk validasi pengeluaran/pembatalan). */
export async function getBalanceTx(tx: Tx) {
  const [s, i, e] = await Promise.all([
    tx.setting.findUniqueOrThrow({ where: { id: 1 } }),
    tx.income.aggregate({ _sum: { amount: true }, where: { voidedAt: null } }),
    tx.expense.aggregate({ _sum: { amount: true }, where: { voidedAt: null } }),
  ]);
  return s.openingBalance + (i._sum.amount ?? 0) - (e._sum.amount ?? 0);
}

export const weekStart = (d: Date) => new Date(d.getTime() + (d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay()) * 864e5);

export function periodRange(t: string, p?: string) {
  const today = todayWIB();
  if (t === "tahunan") {
    const y = /^\d{4}$/.test(p ?? "") ? Number(p) : today.getUTCFullYear();
    return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)), label: `Tahun ${y}`, p: String(y) };
  }
  if (t === "bulanan") {
    const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(p ?? "") ? (p as string) : iso(today).slice(0, 7);
    const [y, mo] = m.split("-").map(Number);
    return { from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 0)), label: `Bulan ${m}`, p: m };
  }
  const base = /^\d{4}-\d{2}-\d{2}$/.test(p ?? "") ? dateOnly(p as string) : today;
  const from = weekStart(base);
  const to = new Date(from.getTime() + 6 * 864e5);
  return { from, to, label: `Minggu ${iso(from)} s/d ${iso(to)}`, p: iso(base) };
}

export async function getReport(from: Date, to: Date) {
  const [set, inB, exB, inc, exp] = await Promise.all([
    prisma.setting.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.income.aggregate({ _sum: { amount: true }, where: { voidedAt: null, date: { lt: from } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { voidedAt: null, date: { lt: from } } }),
    prisma.income.findMany({ where: { voidedAt: null, date: { gte: from, lte: to } }, include: { student: true } }),
    prisma.expense.findMany({ where: { voidedAt: null, date: { gte: from, lte: to } } }),
  ]);
  const rows = [
    ...inc.map((i) => ({ date: iso(i.date), jenis: "Masuk", kategori: i.type === "STUDENT_PAYMENT" ? "Kas siswa" : "Uang masuk lain",
      deskripsi: i.type === "STUDENT_PAYMENT" ? (i.student?.name ?? "") : (i.description ?? ""), masuk: i.amount, keluar: 0 })),
    ...exp.map((e) => ({ date: iso(e.date), jenis: "Keluar", kategori: e.category, deskripsi: e.description, masuk: 0, keluar: e.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const totalIn = rows.reduce((a, r) => a + r.masuk, 0);
  const totalOut = rows.reduce((a, r) => a + r.keluar, 0);
  const opening = set.openingBalance + (inB._sum.amount ?? 0) - (exB._sum.amount ?? 0);
  return { rows, totalIn, totalOut, opening, closing: opening + totalIn - totalOut };
}

export async function getDashboard() {
  const mon = weekStart(todayWIB());
  const from = new Date(mon.getTime() - 7 * 7 * 864e5);
  const [saldo, inc, exp, arrears] = await Promise.all([
    getBalance(),
    prisma.income.findMany({ where: { voidedAt: null, date: { gte: from } }, select: { date: true, amount: true } }),
    prisma.expense.findMany({ where: { voidedAt: null, date: { gte: from } }, select: { date: true, amount: true } }),
    getArrears(),
  ]);
  const chart = Array.from({ length: 8 }, (_, i) => ({ minggu: iso(new Date(from.getTime() + i * 7 * 864e5)).slice(5), masuk: 0, keluar: 0 }));
  const idx = (d: Date) => Math.floor((weekStart(d).getTime() - from.getTime()) / (7 * 864e5));
  for (const i of inc) { const k = idx(i.date); if (k >= 0 && k < 8) chart[k].masuk += i.amount; }
  for (const e of exp) { const k = idx(e.date); if (k >= 0 && k < 8) chart[k].keluar += e.amount; }
  return {
    saldo, masukMinggu: chart[7].masuk, keluarMinggu: chart[7].keluar, chart,
    lunas: arrears.filter((a) => a.lunas).length, belumLunas: arrears.filter((a) => !a.lunas).length,
    tunggakan: arrears.reduce((a, b) => a + b.arrears, 0), arrears,
  };
}
