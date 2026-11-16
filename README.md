# Pencatat Kas Kelas SMA

Aplikasi web untuk mengelola kas kelas: data siswa, pembayaran kas Rp1.000 per hari sekolah (Senin–Jumat), pembayaran di muka (saldo kredit), uang masuk lain, pengeluaran, dan laporan keuangan.

**Techstack:** Next.js (App Router), TypeScript, Tailwind CSS, Prisma 6, Supabase PostgreSQL, Recharts, Motion.

## Fitur
- Dashboard: saldo kas, pemasukan/pengeluaran minggu ini, siswa lunas, tunggakan, grafik 8 minggu
- CRUD siswa (tambah, edit, cari, nonaktifkan) dan pembuatan akun login siswa
- Tabel pembayaran Senin–Jumat dengan indikator lunas/belum/libur
- Pembayaran di muka: kelebihan uang menjadi kredit dan otomatis melunasi hari berikutnya
- Uang masuk lain, pengeluaran (kategori, deskripsi, tautan bukti), riwayat transaksi
- Pembatalan transaksi dengan alasan wajib, semua perubahan tercatat di audit log
- Laporan mingguan/bulanan/tahunan + ekspor CSV
- Peran: Bendahara (admin), Ketua kelas, Siswa; mode terang/gelap; responsif untuk HP

## Aturan keuangan
- Hari wajib Senin–Jumat, kecuali tanggal libur di tabel `Holiday`
- Uang masuk dicatat **sekali** saat benar-benar diterima; pemakaian kredit tidak menambah pemasukan
- Saldo kas = saldo awal + pemasukan sah − pengeluaran sah (transaksi batal tidak dihitung)
- Anti pembayaran ganda: transaksi database + kunci unik `siswa:tanggal`
- Seed tidak pernah membuat transaksi uang

## Setup lokal

Prasyarat: Node.js 20+.

```bash
git clone https://github.com/pradiptanararayaa/kas-kelas.git
cd kas-kelas
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi:
- `DATABASE_URL`: connection string Supabase **pooler** (port 6543, parameter `pgbouncer=true`)
- `DIRECT_URL`: connection string Supabase **direct** (port 5432), untuk migrasi Prisma
- `AUTH_SECRET`: string acak minimal 32 karakter
- `ADMIN_USERNAME` dan `ADMIN_PASSWORD`: akun bendahara awal
- `START_DATE`: tanggal mulai kas, format `YYYY-MM-DD`

Jalankan:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Deploy ke Vercel
1. Import repository ini ke Vercel dengan branch `main`.
2. Tambahkan Environment Variables untuk Production (dan Preview bila diperlukan):
   - `DATABASE_URL` — Supabase pooler connection string
   - `DIRECT_URL` — Supabase direct connection string
   - `AUTH_SECRET` — random secret minimal 32 karakter
   - `ADMIN_USERNAME` — username bendahara awal
   - `ADMIN_PASSWORD` — password bendahara awal (minimal 8 karakter)
   - `START_DATE` — tanggal mulai kas
3. Build command default `npm run build` akan menjalankan Prisma generate, migrasi database, seed akun bendahara (seed aman diulang), lalu build Next.js.
4. Setiap push ke `main` akan memicu deployment otomatis jika integrasi Git Vercel aktif.

**Penting:** jangan pernah menaruh password database, `AUTH_SECRET`, atau Supabase service-role/secret key di kode atau variabel `NEXT_PUBLIC_*`. Aplikasi mengakses database dari server melalui Prisma; tidak memerlukan Supabase key di browser.

## Struktur
```
prisma/            skema, migrasi PostgreSQL, seed
src/lib/           finance.ts (logika uang), actions.ts (server actions), auth.ts
src/app/           halaman: dashboard, siswa, pembayaran, transaksi, laporan, login, api
src/components/    navigasi, tab, chart, form
```

## Lisensi
MIT, lihat berkas `LICENSE`.
