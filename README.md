# Hiratake (平茸) — Website & Sistem Pengelolaan Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan + sistem pengelolaan usaha dengan login multi-peran
- **Fitur Utama**: Katalog produk, pemesanan WhatsApp, dashboard pengelolaan (panen, penjualan, produk, pengguna)

## URL
- **Sandbox (Development)**: https://3000-imf9wlpmbjc80capbwebr-5185f4aa.sandbox.novita.ai
- **Login Pengelola**: https://3000-imf9wlpmbjc80capbwebr-5185f4aa.sandbox.novita.ai/login
- **Produksi**: Belum di-deploy (siap deploy ke Cloudflare Pages)

## Akun Default (GANTI PASSWORD SETELAH DEPLOY!)
| Username | Password | Peran | Hak Akses |
|----------|----------|-------|-----------|
| `owner` | `owner123` | Owner | Semua: ringkasan, panen, penjualan, produk, kelola pengguna |
| `admin` | `admin123` | Admin | Ringkasan, panen, penjualan, kelola produk |
| `karyawan` | `karyawan123` | Karyawan | Ringkasan, catat panen & penjualan (tidak bisa hapus) |

## Fitur yang Sudah Selesai
- ✅ Landing page tema Jepang + logo Hiratake (enso + katakana)
- ✅ Katalog produk dinamis dari database D1
- ✅ Pemesanan via WhatsApp (form + tombol per produk)
- ✅ **Sistem login** dengan sesi cookie HttpOnly (7 hari), password di-hash (salt + SHA-256)
- ✅ **3 peran**: owner / admin / karyawan dengan pembatasan akses per API & tab
- ✅ **Dashboard ringkasan**: statistik panen & penjualan hari ini/bulan ini + grafik 7 hari (Chart.js)
- ✅ **Catat panen** harian (kg + catatan, semua peran)
- ✅ **Catat penjualan** (pilih produk, total otomatis, semua peran; hapus hanya owner/admin)
- ✅ **Kelola produk**: tambah/ubah/nonaktifkan/aktifkan (owner & admin) — langsung tersinkron ke halaman depan
- ✅ **Kelola pengguna** (owner): tambah akun, ubah peran, reset sandi, nonaktifkan akun

## Entri Fungsional (URI)
### Publik
| Path | Metode | Deskripsi |
|------|--------|-----------|
| `/` | GET | Halaman utama |
| `/login` | GET | Halaman login pengelola |
| `/api/produk` | GET | Daftar produk aktif |
| `/api/auth/login` | POST | Login `{username, password}` → set cookie sesi |

### Wajib Login (cookie `hiratake_session`)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/admin` | GET | semua | Dashboard (redirect ke /login jika belum masuk) |
| `/api/auth/me` | GET | semua | Info user login |
| `/api/auth/logout` | POST | semua | Keluar |
| `/api/admin/ringkasan` | GET | semua | Statistik + data grafik |
| `/api/admin/panen` | GET/POST | semua | Riwayat / catat panen |
| `/api/admin/panen/:id` | DELETE | owner, admin | Hapus catatan panen |
| `/api/admin/penjualan` | GET/POST | semua | Riwayat / catat penjualan |
| `/api/admin/penjualan/:id` | DELETE | owner, admin | Hapus catatan penjualan |
| `/api/admin/produk` | GET/POST | owner, admin | Daftar / tambah produk |
| `/api/admin/produk/:id` | PUT/DELETE | owner, admin | Ubah / nonaktifkan produk |
| `/api/admin/users` | GET/POST | owner | Daftar / tambah pengguna |
| `/api/admin/users/:id/status` | PUT | owner | Aktif/nonaktifkan pengguna |
| `/api/admin/users/:id/password` | PUT | owner | Reset kata sandi |

## Arsitektur Data
- **Penyimpanan**: Cloudflare D1 (SQLite) — lokal via `--local`, produksi perlu `wrangler d1 create`
- **Tabel**: `users` (akun + peran), `sessions` (token sesi), `produk`, `panen`, `penjualan`
- **Keamanan**: password hash salt+SHA-256 (Web Crypto), cookie HttpOnly+Secure, validasi peran di server

## Perintah Database
```bash
npx wrangler d1 migrations apply webapp-production --local   # migrasi lokal
npx wrangler d1 execute webapp-production --local --file=./seed.sql  # seed data
```

## Fitur yang Belum Diimplementasikan
- ❌ Deploy produksi ke Cloudflare Pages (+ buat D1 produksi & isi database_id asli di wrangler.jsonc)
- ❌ Nomor WhatsApp asli (placeholder `6281234567890`)
- ❌ Laporan bulanan yang bisa diunduh (Excel/PDF)
- ❌ Manajemen stok baglog & pengingat masa panen

## Rekomendasi Langkah Selanjutnya
1. **Ganti semua password default** lewat tab Pengguna (login sebagai owner)
2. Deploy ke Cloudflare Pages + buat D1 produksi
3. Ganti nomor WhatsApp asli
4. Tambah laporan bulanan & ekspor data

## Deployment
- **Platform**: Cloudflare Pages + D1 (sandbox dev via wrangler --local + PM2)
- **Status**: ✅ Aktif (sandbox development)
- **Tech Stack**: Hono + TypeScript + D1 (SQLite) + TailwindCSS (CDN) + Chart.js + Vite
- **Terakhir Diperbarui**: 2026-08-28
