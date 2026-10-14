"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { requirePerm } from "./auth";
import { BizError, dateOnly, getBalanceTx, iso, todayWIB, recordStudentPayment, rupiah } from "./finance";
import { CATEGORIES } from "./constants";

type R = { ok: boolean; msg: string };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid");
const refresh = () => { revalidatePath("/siswa"); revalidatePath("/pembayaran"); revalidatePath("/transaksi"); revalidatePath("/"); };

async function safe(fn: () => Promise<string>): Promise<R> {
  try { return { ok: true, msg: await fn() }; } catch (e) {
    if (e instanceof BizError) return { ok: false, msg: e.message };
    if (e instanceof z.ZodError) return { ok: false, msg: e.issues[0]?.message ?? "Input tidak valid" };
    if (e instanceof Error && (e.message === "FORBIDDEN" || e.message === "UNAUTHENTICATED")) return { ok: false, msg: "Anda tidak punya akses" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, msg: "Data duplikat (NIS atau username sudah dipakai)" };
    console.error(e);
    return { ok: false, msg: "Terjadi kesalahan server" };
  }
}

const studentSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi").max(20),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  startDate: date.or(z.literal("")).optional(),
});

export async function createStudent(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("student:write");
    const d = studentSchema.parse(Object.fromEntries(fd));
    const setting = await prisma.setting.findUniqueOrThrow({ where: { id: 1 } });
    const st = await prisma.student.create({ data: { nis: d.nis, name: d.name, startDate: d.startDate ? dateOnly(d.startDate) : setting.startDate } });
    await prisma.auditLog.create({ data: { userId: s.uid, action: "CREATE", entity: "Student", entityId: st.id, after: { nis: st.nis, name: st.name } } });
    refresh(); return "Siswa ditambahkan";
  });
}

export async function updateStudent(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("student:write");
    const d = studentSchema.extend({ id: z.string().min(1) }).parse(Object.fromEntries(fd));
    const before = await prisma.student.findUniqueOrThrow({ where: { id: d.id } });
    const after = await prisma.student.update({ where: { id: d.id }, data: { nis: d.nis, name: d.name } });
    await prisma.auditLog.create({ data: { userId: s.uid, action: "UPDATE", entity: "Student", entityId: d.id,
      before: { nis: before.nis, name: before.name }, after: { nis: after.nis, name: after.name } } });
    refresh(); return "Perubahan disimpan";
  });
}

/** Nonaktifkan: kewajiban berhenti di hari ini. Aktifkan lagi: kewajiban berlanjut (jeda dihitung tunggakan). */
export async function toggleStudent(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("student:write");
    const { id } = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(fd));
    const st = await prisma.student.findUniqueOrThrow({ where: { id } });
    const upd = await prisma.student.update({ where: { id }, data: st.active ? { active: false, endDate: todayWIB() } : { active: true, endDate: null } });
    await prisma.auditLog.create({ data: { userId: s.uid, action: "UPDATE", entity: "Student", entityId: id, before: { active: st.active }, after: { active: upd.active } } });
    refresh(); return upd.active ? "Siswa diaktifkan" : "Siswa dinonaktifkan";
  });
}

export async function payStudent(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("payment:write");
    const d = z.object({ studentId: z.string().min(1, "Pilih siswa"), amount: z.coerce.number().int("Nominal harus bulat").positive("Nominal harus lebih dari 0"), date })
      .parse(Object.fromEntries(fd));
    const r = await recordStudentPayment({ studentId: d.studentId, amount: d.amount, date: dateOnly(d.date), userId: s.uid });
    refresh(); return `Pembayaran ${rupiah(d.amount)} dicatat, ${r.daysSettled} hari lunas`;
  });
}

const money = z.coerce.number().int("Nominal harus bulat").positive("Nominal harus lebih dari 0").max(100_000_000, "Nominal terlalu besar");
const notFuture = (d: string) => { if (dateOnly(d) > todayWIB()) throw new BizError("Tanggal tidak boleh di masa depan"); };
const reasonSchema = z.string().trim().min(3, "Alasan minimal 3 karakter").max(200);

export async function createOtherIncome(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("income:write");
    const d = z.object({ amount: money, date, description: z.string().trim().min(3, "Deskripsi minimal 3 karakter").max(200) }).parse(Object.fromEntries(fd));
    notFuture(d.date);
    const inc = await prisma.income.create({ data: { type: "OTHER", amount: d.amount, date: dateOnly(d.date), description: d.description, createdById: s.uid } });
    await prisma.auditLog.create({ data: { userId: s.uid, action: "CREATE", entity: "Income", entityId: inc.id, after: { amount: inc.amount, description: inc.description } } });
    refresh(); return `Uang masuk ${rupiah(d.amount)} dicatat`;
  });
}

export async function createExpense(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("expense:write");
    const d = z.object({
      amount: money, date, category: z.enum(CATEGORIES, "Kategori tidak valid"),
      description: z.string().trim().min(3, "Deskripsi minimal 3 karakter").max(200),
      proofUrl: z.string().trim().url("Tautan bukti tidak valid").or(z.literal("")).optional(),
    }).parse(Object.fromEntries(fd));
    notFuture(d.date);
    await prisma.$transaction(async (tx) => {
      if ((await getBalanceTx(tx)) < d.amount) throw new BizError("Saldo kas tidak cukup");
      const ex = await tx.expense.create({ data: { amount: d.amount, date: dateOnly(d.date), category: d.category, description: d.description, proofUrl: d.proofUrl || null, createdById: s.uid } });
      await tx.auditLog.create({ data: { userId: s.uid, action: "CREATE", entity: "Expense", entityId: ex.id, after: { amount: ex.amount, category: ex.category, description: ex.description } } });
    });
    refresh(); return `Pengeluaran ${rupiah(d.amount)} dicatat`;
  });
}

export async function voidExpense(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("void");
    const d = z.object({ id: z.string().min(1), reason: reasonSchema }).parse(Object.fromEntries(fd));
    await prisma.$transaction(async (tx) => {
      const ex = await tx.expense.findUniqueOrThrow({ where: { id: d.id } });
      if (ex.voidedAt) throw new BizError("Transaksi sudah dibatalkan");
      await tx.expense.update({ where: { id: d.id }, data: { voidedAt: new Date(), voidReason: d.reason } });
      await tx.auditLog.create({ data: { userId: s.uid, action: "VOID", entity: "Expense", entityId: d.id, before: { amount: ex.amount, category: ex.category }, after: { reason: d.reason } } });
    });
    refresh(); return "Pengeluaran dibatalkan";
  });
}

/** Batalkan pemasukan. Untuk pembayaran siswa: kredit dikurangi, dan bila kurang, hari lunas terbaru dibatalkan. */
export async function voidIncome(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("void");
    const d = z.object({ id: z.string().min(1), reason: reasonSchema }).parse(Object.fromEntries(fd));
    const reopened: string[] = [];
    await prisma.$transaction(async (tx) => {
      const inc = await tx.income.findUniqueOrThrow({ where: { id: d.id } });
      if (inc.voidedAt) throw new BizError("Transaksi sudah dibatalkan");
      if ((await getBalanceTx(tx)) - inc.amount < 0) throw new BizError("Pembatalan membuat saldo kas negatif (sudah terpakai pengeluaran)");
      await tx.income.update({ where: { id: d.id }, data: { voidedAt: new Date(), voidReason: d.reason } });
      if (inc.type === "STUDENT_PAYMENT" && inc.studentId) {
        const { dailyFee } = await tx.setting.findUniqueOrThrow({ where: { id: 1 } });
        const st = await tx.student.findUniqueOrThrow({ where: { id: inc.studentId } });
        let credit = st.creditBalance - inc.amount;
        if (credit < 0) {
          const latest = await tx.allocation.findMany({ where: { studentId: st.id, voidedAt: null }, orderBy: { dueDate: "desc" }, take: Math.ceil(-credit / dailyFee) });
          for (const a of latest) {
            await tx.allocation.update({ where: { id: a.id }, data: { voidedAt: new Date(), activeKey: null } });
            reopened.push(iso(a.dueDate)); credit += a.amount;
          }
        }
        if (credit < 0) throw new BizError("Data kredit siswa tidak konsisten");
        await tx.student.update({ where: { id: st.id }, data: { creditBalance: credit } });
      }
      await tx.auditLog.create({ data: { userId: s.uid, action: "VOID", entity: "Income", entityId: d.id, before: { amount: inc.amount, type: inc.type }, after: { reason: d.reason, reopenedDays: reopened } } });
    });
    refresh(); return reopened.length ? `Dibatalkan; ${reopened.length} hari kembali belum lunas` : "Pemasukan dibatalkan";
  });
}

/** Admin membuat/mengubah akun login untuk siswa (SISWA atau KETUA). */
export async function setStudentAccount(_: R, fd: FormData) {
  return safe(async () => {
    const s = await requirePerm("student:write");
    const d = z.object({
      studentId: z.string().min(1),
      username: z.string().trim().min(3, "Username minimal 3 karakter").max(30).regex(/^[a-zA-Z0-9._-]+$/, "Username hanya huruf, angka, titik, strip"),
      password: z.string().min(8, "Password minimal 8 karakter").max(100),
      role: z.enum(["SISWA", "KETUA"]),
    }).parse(Object.fromEntries(fd));
    const st = await prisma.student.findUniqueOrThrow({ where: { id: d.studentId } });
    const passwordHash = await bcrypt.hash(d.password, 12);
    const ex = await prisma.user.findUnique({ where: { studentId: d.studentId } });
    const u = ex
      ? await prisma.user.update({ where: { id: ex.id }, data: { username: d.username, passwordHash, role: d.role, active: true } })
      : await prisma.user.create({ data: { username: d.username, passwordHash, name: st.name, role: d.role, studentId: st.id } });
    await prisma.auditLog.create({ data: { userId: s.uid, action: ex ? "UPDATE" : "CREATE", entity: "User", entityId: u.id, after: { username: u.username, role: u.role } } });
    refresh(); return "Akun login disimpan";
  });
}
