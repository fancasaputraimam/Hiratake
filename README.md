# Hiratake (平茸) — Website & Sistem Pengelolaan Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan + sistem pengelolaan usaha terpadu "satu sumber data, nol miss"
- **Alur data**: Batch Baglog → Kejadian (kontaminasi) → Panen (grade A/B/C + susut) → Penjualan (pelanggan + lunas/tempo) → Piutang

## URL
- **Sandbox (Development)**: https://3000-imf9wlpmbjc80capbwebr-5185f4aa.sandbox.novita.ai
- **Login Pengelola**: /login
- **Produksi**: Belum di-deploy

## Akun Default (GANTI PASSWORD!)
| Username | Password | Peran |
|----------|----------|-------|
| `owner` | `owner123` | Owner — semua akses |
| `admin` | `admin123` | Admin — operasional + produk + pengaturan web |
| `karyawan` | `karyawan123` | Karyawan — catat panen/penjualan/kejadian, lihat data |

## Fitur Selesai
### Website Depan (otomatis sinkron dengan database)
- ✅ Statistik hero (baglog aktif, rata-rata kg/hari 30 hari, pelanggan aktif) **dihitung real-time dari data asli**
- ✅ Nomor WA, alamat, jam operasional **diatur dari dashboard tab "Web"** — semua tombol pesan otomatis ikut berubah
- ✅ Katalog produk dari D1, pemesanan via WhatsApp

### Dashboard Pengelolaan
- ✅ **Ringkasan**: 8 kartu metrik (panen, penjualan, baglog aktif, % kontaminasi, produktivitas kg/baglog, piutang) + grafik 7 hari
- ✅ **Baglog**: batch dengan kode otomatis (BG-YYYY-MM-XXX), sumber & biaya/baglog, status inkubasi→produktif→afkir, lapor kejadian (kontaminasi/rusak/afkir) dengan **validasi sisa baglog** (anti-miss), riwayat kejadian per batch, produktivitas kg/baglog per batch
- ✅ **Panen**: per grade A/B/C + susut/BS, total otomatis, link ke batch (batch inkubasi otomatis jadi produktif saat dipanen)
- ✅ **Penjualan**: pilih pelanggan terdaftar / pembeli bebas, status lunas/tempo, tempo **wajib pelanggan terdaftar + jatuh tempo** (anti-miss), tandai lunas
- ✅ **Piutang**: daftar piutang berjalan diurutkan jatuh tempo, penanda TERLAMBAT otomatis, tombol tagih via WA dengan pesan otomatis
- ✅ **Pelanggan**: tipe (eceran/warung/resto/reseller), WA, total belanja & piutang per pelanggan
- ✅ **Produk** (owner/admin), **Pengguna** (owner), **Pengaturan Web** (owner/admin)

## Aturan Anti-Miss yang Ditanam di Sistem
1. Kejadian baglog tidak boleh melebihi sisa baglog batch
2. Penjualan tempo wajib pelanggan terdaftar + tanggal jatuh tempo
3. Total panen = jumlah grade otomatis (tidak bisa beda)
4. Nomor WA divalidasi format sebelum tampil di web
5. Batch afkir tidak dihitung sebagai baglog aktif
6. Semua pencatatan menyimpan siapa pencatatnya
7. Statistik web depan dihitung dari data transaksi asli (tidak bisa "dikarang")

## Entri Fungsional Baru (Fase 1)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/admin/baglog` | GET | semua | Daftar batch + agregat |
| `/api/admin/baglog` | POST | owner, admin | Batch baru (kode otomatis) |
| `/api/admin/baglog/:id/status` | PUT | owner, admin | inkubasi/produktif/afkir |
| `/api/admin/baglog/:id/kejadian` | GET/POST | semua | Riwayat / lapor kejadian |
| `/api/admin/penjualan/:id/lunas` | PUT | owner, admin | Tandai piutang lunas |
| `/api/admin/piutang` | GET | semua | Piutang berjalan |
| `/api/admin/pelanggan` | GET/POST | semua | Daftar / tambah pelanggan |
| `/api/admin/pelanggan/:id` | PUT | owner, admin | Ubah pelanggan |
| `/api/admin/pengaturan` | GET/PUT | owner, admin | Pengaturan website |

(Endpoint lama: lihat riwayat git — auth, panen, penjualan, produk, users tetap berlaku dengan field tambahan)

## Arsitektur Data
- **Penyimpanan**: Cloudflare D1 (SQLite)
- **Tabel**: `users`, `sessions`, `produk`, `panen` (+grade/susut/batch), `penjualan` (+pelanggan/status_bayar/jatuh_tempo), `baglog_batch`, `baglog_kejadian`, `pelanggan`, `pengaturan`
- **Migrasi**: `migrations/0001_initial_schema.sql`, `migrations/0002_fase1_produksi_pelanggan.sql`

## Belum Diimplementasikan (Fase Berikutnya)
- ❌ Fase 2: pengeluaran + kas + laba/rugi + HPP per kg
- ❌ Fase 3: stok harian + rekonsiliasi panen vs penjualan, pesanan/PO
- ❌ Fase 4: kondisi kumbung, absensi & kasbon, aset
- ❌ Deploy produksi ke Cloudflare Pages

## Panduan Alur Harian
1. **Ada baglog baru** → Admin buat batch di tab Baglog
2. **Karyawan lihat baglog rusak/kontaminasi** → lapor di tab Baglog (form Lapor Kejadian)
3. **Panen pagi** → catat di tab Panen: pilih batch, isi kg per grade + susut
4. **Ada penjualan** → tab Penjualan: pilih produk & pelanggan, pilih lunas/tempo
5. **Cek piutang** → tab Piutang: tagih yang mendekati/lewat jatuh tempo via tombol WA
6. **Ganti info web** (WA/alamat/jam) → tab Web → simpan → langsung aktif

## Deployment
- **Platform**: Cloudflare Pages + D1 (dev: wrangler --local + PM2)
- **Status**: ✅ Aktif (sandbox development)
- **Tech Stack**: Hono + TypeScript + D1 + TailwindCSS (CDN) + Chart.js
- **Terakhir Diperbarui**: 2026-08-28
