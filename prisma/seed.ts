import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const username = process.env.ADMIN_USERNAME ?? "bendahara";
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error("ADMIN_PASSWORD wajib diisi (min 8 karakter)");

  // Data dasar (aman untuk produksi): pengaturan + akun bendahara pertama.
  await prisma.setting.upsert({
    where: { id: 1 }, update: {},
    create: { id: 1, openingBalance: 0, dailyFee: 1000, startDate: new Date(process.env.START_DATE ?? "2026-07-13T00:00:00Z") },
  });
  await prisma.user.upsert({
    where: { username }, update: {},
    create: { username, name: "Bendahara", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });

  if (isProd) return console.log("Produksi: hanya pengaturan & admin dibuat. Tidak ada data contoh.");

  // Khusus development: siswa & akun contoh. TIDAK ada transaksi uang.
  const start = new Date("2026-07-13T00:00:00Z");
  const names = ["Andi Pratama", "Bunga Lestari", "Citra Dewi", "Dimas Saputra", "Eka Wulandari"];
  for (const [i, name] of names.entries()) {
    await prisma.student.upsert({
      where: { nis: `DEV${1000 + i}` }, update: {},
      create: { nis: `DEV${1000 + i}`, name, startDate: start },
    });
  }
  const ketua = await prisma.student.findUniqueOrThrow({ where: { nis: "DEV1000" } });
  await prisma.user.upsert({
    where: { username: "ketua" }, update: {},
    create: { username: "ketua", name: ketua.name, role: "KETUA", studentId: ketua.id, passwordHash: await bcrypt.hash("ketua12345", 12) },
  });
  const siswa = await prisma.student.findUniqueOrThrow({ where: { nis: "DEV1001" } });
  await prisma.user.upsert({
    where: { username: "siswa" }, update: {},
    create: { username: "siswa", name: siswa.name, role: "SISWA", studentId: siswa.id, passwordHash: await bcrypt.hash("siswa12345", 12) },
  });
  await prisma.holiday.upsert({
    where: { date: new Date("2026-08-17T00:00:00Z") }, update: {}, create: { date: new Date("2026-08-17T00:00:00Z"), name: "HUT RI (dev)" },
  });
  console.log("Seed development selesai.");
}
main().finally(() => prisma.$disconnect());
