import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, hasPerm } from "@/lib/auth";
import { rupiah } from "@/lib/finance";
import { createStudent, updateStudent, toggleStudent, setStudentAccount } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { SearchBox } from "@/components/search-box";
import { Nav } from "@/components/nav";

const input = "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";

async function Content({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await getSession();
  if (!hasPerm(s, "student:read")) redirect("/");
  const canWrite = hasPerm(s, "student:write");
  const q = ((await searchParams).q ?? "").trim();
  const students = await prisma.student.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { nis: { contains: q } }] } : {},
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { user: { select: { username: true, role: true } } },
  });
  return (
    <div className="space-y-4">
      <SearchBox defaultValue={q} placeholder="Cari nama atau NIS…" />
      {canWrite && (
        <details className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-medium">+ Tambah siswa</summary>
          <ActionForm action={createStudent} label="Simpan" className="mt-3 space-y-3">
            <input name="nis" placeholder="NIS" required className={input} />
            <input name="name" placeholder="Nama lengkap" required className={input} />
            <label className="block text-xs text-neutral-500">Mulai kewajiban (kosongkan = awal tahun ajaran)
              <input name="startDate" type="date" className={input} />
            </label>
          </ActionForm>
        </details>
      )}
      <ul className="space-y-2">
        {students.map((st) => (
          <li key={st.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium"><span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">{st.name.slice(0, 1).toUpperCase()}</span>{st.name} {!st.active && <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700">nonaktif</span>}</p>
                <p className="text-sm text-neutral-500">NIS {st.nis} · Kredit {rupiah(st.creditBalance)}</p>
              </div>
              {canWrite && (
                <ActionForm action={toggleStudent} label={st.active ? "Nonaktifkan" : "Aktifkan"} variant="ghost">
                  <input type="hidden" name="id" value={st.id} />
                </ActionForm>
              )}
            </div>
            {canWrite && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-emerald-600">Edit</summary>
                <ActionForm action={updateStudent} label="Simpan" className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={st.id} />
                  <input name="nis" defaultValue={st.nis} required className={input} />
                  <input name="name" defaultValue={st.name} required className={input} />
                </ActionForm>
              </details>
            )}
            {canWrite && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-emerald-600">Akun login {st.user ? `(${st.user.username}, ${st.user.role})` : "(belum ada)"}</summary>
                <ActionForm action={setStudentAccount} label="Simpan akun" className="mt-2 space-y-2">
                  <input type="hidden" name="studentId" value={st.id} />
                  <input name="username" defaultValue={st.user?.username ?? st.nis} required className={input} />
                  <input name="password" type="password" placeholder="Password baru (min 8)" required className={input} />
                  <select name="role" defaultValue={st.user?.role ?? "SISWA"} className={input}><option value="SISWA">Siswa</option><option value="KETUA">Ketua kelas</option></select>
                </ActionForm>
              </details>
            )}
          </li>
        ))}
        {students.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">Belum ada siswa. Klik “+ Tambah siswa”.</p>}
      </ul>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 text-neutral-900 dark:text-neutral-50">
      <Nav />
      <h1 className="text-xl font-semibold">Data Siswa</h1>
      <Suspense fallback={<div className="skeleton h-48" />}><Content searchParams={searchParams} /></Suspense>
    </main>
  );
}
