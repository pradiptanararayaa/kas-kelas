# Pencatat Kas Kelas SMA

Aplikasi web untuk mengelola kas kelas: data siswa, pembayaran kas Rp1.000 per hari sekolah (Senin–Jumat),
pembayaran di muka (saldo kredit), uang masuk lain, pengeluaran, dan laporan keuangan.

**Techstack:** Next.js (App Router), TypeScript, Tailwind CSS, Prisma, SQLite, Recharts, Motion.

## Fitur
- Dashboard: saldo kas, pemasukan/pengeluaran minggu ini, siswa lunas, tunggakan, grafik 8 minggu
- CRUD siswa (tambah, edit, cari, nonaktifkan) dan pembuatan akun login siswa
- Tabel pembayaran Senin–Jumat dengan indikator lunas/belum/libur
- Pembayaran di muka: kelebihan uang menjadi kredit dan otomatis melunasi hari berikutnya
- Uang masuk lain, pengeluaran (kategori, deskripsi, tautan bukti), riwayat transaksi
- Pembatalan transaksi dengan alasan wajib, semua perubahan tercatat di audit log
- Laporan mingguan/bulanan/tahunan + ekspor CSV
- Peran: Bendahara (admin), Ketua kelas, Siswa; mode terang/gelap; responsif untuk HP

## Rules
- Hari wajib Senin–Jumat, kecuali tanggal libur di tabel `Holiday`
- Uang masuk dicatat **sekali** saat benar-benar diterima; pemakaian kredit tidak menambah pemasukan
- Saldo kas = saldo awal + pemasukan sah − pengeluaran sah (transaksi batal tidak dihitung)
- Anti pembayaran ganda: transaksi database + kunci unik `siswa:tanggal`
- Seed tidak pernah membuat transaksi uang

## Instalasi
Prasyarat: Node.js 20+ dan Git.

```bash
git clone https://github.com/USERNAME/kas-kelas.git
cd kas-kelas
npm install
```

Salin file lingkungan, lalu isi nilainya:

```bash
cp .env.example .env        # Windows CMD: copy .env.example .env
```

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | `file:./kas.db` (SQLite, otomatis dibuat di `prisma/`) |
| `AUTH_SECRET` | String acak min. 32 karakter: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Akun bendahara pertama (password min. 8 karakter) |
| `START_DATE` | Tanggal mulai kewajiban kas, format `YYYY-MM-DD` |

```bash
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Buka http://localhost:3000 lalu login sebagai bendahara.

Pada mode development, seed juga membuat siswa contoh (NIS `DEV...`) dan akun `ketua` / `siswa`.
**Akun contoh ini hanya untuk development; jangan dipakai di server sungguhan.**

## Produksi / berbagi
- SQLite menyimpan semua data di satu file `prisma/kas.db`. **Backup rutin** dengan menyalin file itu.
- Jalankan di laptop/PC/VPS sendiri. Hosting serverless (mis. Vercel) tidak cocok untuk SQLite.
  Untuk online, ganti `provider` Prisma ke PostgreSQL.
- Produksi: `npm run build`, `NODE_ENV=production npx prisma migrate deploy && npx prisma db seed`,
  lalu `npm start`. Seed produksi hanya membuat pengaturan dan akun bendahara.

## Struktur
```
prisma/            skema, migrasi, seed
src/lib/           finance.ts (logika uang), actions.ts (server actions), auth.ts
src/app/           halaman: dashboard, siswa, pembayaran, transaksi, laporan, login, api
src/components/    navigasi, tab, chart, form
```

## Lisensi
MIT, lihat berkas `LICENSE`.
