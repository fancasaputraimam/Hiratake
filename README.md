# Hiratake (平茸) — Website & Sistem Pengelolaan Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan + sistem pengelolaan usaha terpadu "satu sumber data, nol miss"
- **Alur data**: Batch Baglog → Kejadian (kontaminasi) → Panen (grade A/B/C + susut) → Pesanan/PO → Penjualan (pelanggan + lunas/tempo) → Piutang → Stok/Rekonsiliasi → Keuangan → Laporan Laba/Rugi + HPP
- **Responsive**: seluruh halaman (landing, login, dashboard) optimal di HP & laptop

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
- ✅ **Keuangan** (owner/admin — karyawan tidak melihat uang): pengeluaran per kategori (bahan baku, bibit, gas sterilisasi, listrik/air, gaji, transport, kemasan, perawatan, lainnya) + pemasukan lain di luar penjualan jamur
- ✅ **Laporan** (owner/admin): pilih bulan → laba/rugi otomatis, HPP per kg, kas masuk vs omzet (akrual vs kas), susut %, kontaminasi, grafik komposisi pengeluaran (doughnut), tabel rinci, dan **insight otomatis** (margin per kg, peringatan susut >5%, piutang >30% omzet)
- ✅ **Pesanan/PO**: kode otomatis PO-YYYY-MM-XXX, multi-item, alur status baru→diproses→siap→selesai/batal, penanda terlambat kirim, kabari pelanggan via WA, **selesai otomatis tercatat sebagai penjualan** (anti-dobel & anti-miss)
- ✅ **Stok & Rekonsiliasi**: saldo stok harian (panen − terjual kg ± penyesuaian), deteksi **saldo minus = jamur "hilang"** (baris merah + peringatan), penyesuaian stok (rusak/bonus/sampel/konsumsi/koreksi), produk punya berat/unit untuk konversi ke kg

## Aturan Anti-Miss yang Ditanam di Sistem
1. Kejadian baglog tidak boleh melebihi sisa baglog batch
2. Penjualan tempo wajib pelanggan terdaftar + tanggal jatuh tempo
3. Total panen = jumlah grade otomatis (tidak bisa beda)
4. Nomor WA divalidasi format sebelum tampil di web
5. Batch afkir tidak dihitung sebagai baglog aktif
6. Semua pencatatan menyimpan siapa pencatatnya
7. Statistik web depan dihitung dari data transaksi asli (tidak bisa "dikarang")
8. Kategori pengeluaran dikunci daftar (CHECK constraint) — tidak ada kategori liar
9. Laba/rugi & HPP dihitung sistem dari transaksi asli, bukan input manual
10. Pesanan wajib pelanggan terdaftar; harga item diambil dari DB (tidak bisa dikarang); tgl kirim ≥ tgl pesan
11. Pesanan tidak bisa "selesai" tanpa lewat tombol Selesai+Jual → penjualan otomatis tercatat, tidak bisa dobel
12. Rekonsiliasi stok mendeteksi saldo minus → terjual lebih banyak dari panen tercatat = ada yang terlewat

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

## Entri Fungsional Baru (Fase 2)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/admin/pengeluaran` | GET/POST | owner, admin | Daftar / catat pengeluaran per kategori |
| `/api/admin/pengeluaran/:id` | DELETE | owner, admin | Hapus pengeluaran |
| `/api/admin/pemasukan-lain` | GET/POST | owner, admin | Daftar / catat pemasukan lain |
| `/api/admin/pemasukan-lain/:id` | DELETE | owner, admin | Hapus pemasukan lain |
| `/api/admin/laporan?bulan=YYYY-MM` | GET | owner, admin | Laporan bulanan: omzet, pengeluaran per kategori, laba/rugi, HPP/kg, kas, susut, kontaminasi |

## Entri Fungsional Baru (Fase 3)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/admin/stok?bulan=YYYY-MM` | GET | semua | Rekonsiliasi stok harian + saldo |
| `/api/admin/stok/penyesuaian` | GET/POST | semua | Riwayat / catat penyesuaian stok |
| `/api/admin/stok/penyesuaian/:id` | DELETE | owner, admin | Hapus penyesuaian |
| `/api/admin/pesanan` | GET/POST | semua | Daftar (filter ?status=) / buat PO multi-item |
| `/api/admin/pesanan/:id/item` | GET | semua | Item pesanan |
| `/api/admin/pesanan/:id/status` | PUT | semua | baru/diproses/siap/batal |
| `/api/admin/pesanan/:id/selesai` | POST | semua | Selesai + auto-catat penjualan (lunas/tempo) |

### Rumus Laporan
- **Omzet** = total penjualan bulan itu (basis akrual, termasuk tempo)
- **Kas masuk** = penjualan lunas + tempo yang dilunasi bulan itu (basis kas)
- **Laba/Rugi** = (omzet + pemasukan lain) − total pengeluaran
- **HPP per kg** = (total pengeluaran + investasi baglog baru) ÷ kg panen bulan itu

## Arsitektur Data
- **Penyimpanan**: Cloudflare D1 (SQLite)
- **Tabel**: `users`, `sessions`, `produk` (+berat_kg), `panen` (+grade/susut/batch), `penjualan` (+pelanggan/status_bayar/jatuh_tempo/berat_kg), `baglog_batch`, `baglog_kejadian`, `pelanggan`, `pengaturan`, `pengeluaran`, `pemasukan_lain`, `stok_penyesuaian`, `pesanan`, `pesanan_item`
- **Migrasi**: `migrations/0001_initial_schema.sql` … `migrations/0004_fase3_stok_pesanan.sql`

## Belum Diimplementasikan (Fase Berikutnya)
- ❌ Fase 4: kondisi kumbung, absensi & kasbon, aset
- ❌ Deploy produksi ke Cloudflare Pages

## Panduan Alur Harian
1. **Ada baglog baru** → Admin buat batch di tab Baglog
2. **Karyawan lihat baglog rusak/kontaminasi** → lapor di tab Baglog (form Lapor Kejadian)
3. **Panen pagi** → catat di tab Panen: pilih batch, isi kg per grade + susut
4. **Ada penjualan** → tab Penjualan: pilih produk & pelanggan, pilih lunas/tempo
5. **Ada pesanan masuk (PO)** → tab Pesanan: pilih pelanggan + item → proses → siap → tombol Selesai (penjualan otomatis tercatat)
6. **Jamur keluar bukan penjualan** (bonus/rusak/konsumsi) → tab Stok → Penyesuaian
7. **Cek stok tiap sore** → tab Stok: kalau saldo merah/minus berarti ada yang lupa dicatat
8. **Cek piutang** → tab Piutang: tagih yang mendekati/lewat jatuh tempo via tombol WA
9. **Setiap ada pengeluaran** (beli serbuk, bibit, gas, gaji, dll) → tab Keuangan → catat dengan kategori
10. **Akhir bulan** → tab Laporan → pilih bulan → lihat laba/rugi, HPP/kg, dan insight otomatis
11. **Ganti info web** (WA/alamat/jam) → tab Web → simpan → langsung aktif

## Deployment
- **Platform**: Cloudflare Pages + D1 (dev: wrangler --local + PM2)
- **Status**: ✅ Aktif (sandbox development)
- **Tech Stack**: Hono + TypeScript + D1 + TailwindCSS (CDN) + Chart.js
- **Responsive**: mobile-first, sidebar drawer di HP, tabel scroll horizontal, input anti-zoom iOS
- **UI Form**: semua form tambah/edit berupa modal popup (bottom-sheet di HP, tutup via ✕ / klik luar / Esc)
- **Data**: 100% asli dari input pengguna — seed hanya berisi akun default & katalog produk, tanpa data transaksi contoh; statistik landing selalu sinkron dengan database
- **Terakhir Diperbarui**: 2026-08-28 (Modal + pembersihan data mock)
