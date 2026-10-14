import { getSession, hasPerm } from "@/lib/auth";
import { getReport, periodRange } from "@/lib/finance";

// Cegah formula injection di Excel/Sheets: sel teks yang diawali = + - @ diberi tanda kutip.
const cell = (v: string | number) => {
  let t = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export async function GET(req: Request) {
  if (!hasPerm(await getSession(), "report:read")) return new Response("Forbidden", { status: 403 });
  const u = new URL(req.url);
  const t = ["mingguan", "bulanan", "tahunan"].includes(u.searchParams.get("t") ?? "") ? (u.searchParams.get("t") as string) : "bulanan";
  const r = periodRange(t, u.searchParams.get("p") ?? undefined);
  const rep = await getReport(r.from, r.to);
  const lines = [
    ["Tanggal", "Jenis", "Kategori", "Deskripsi", "Masuk", "Keluar"],
    ...rep.rows.map((x) => [x.date, x.jenis, x.kategori, x.deskripsi, x.masuk, x.keluar]),
    [], ["", "", "", "Saldo awal", rep.opening, ""], ["", "", "", "Total", rep.totalIn, rep.totalOut], ["", "", "", "Saldo akhir", rep.closing, ""],
  ].map((l) => l.map(cell).join(","));
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="laporan-${t}-${r.p}.csv"` },
  });
}
