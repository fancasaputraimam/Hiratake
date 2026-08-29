# Hiratake (平茸) — Website & Sistem Pengelolaan Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan + sistem pengelolaan usaha terpadu "satu sumber data, nol miss"
- **Alur data**: Batch Baglog → Kejadian (kontaminasi) → Panen (grade A/B/C + susut) → Pesanan/PO → Penjualan (pelanggan + lunas/tempo) → Piutang → Stok/Rekonsiliasi → Keuangan → Laporan Laba/Rugi + HPP
- **Responsive**: seluruh halaman (landing, login, dashboard) optimal di HP & laptop

## URL
- **Sandbox (Development)**: https://3000-imf9wlpmbjc80capbwebr-5185f4aa.sandbox.novita.ai
- **Login Pengelola**: /login
- **GitHub**: https://github.com/fancasaputraimam/Hiratake
- **Produksi**: Belum di-deploy (pilih: Cloudflare Pages hosted/BYOK, atau VPS via `install-vps.sh`)

## 🚀 Pasang di VPS (1 Perintah)
Untuk VPS Ubuntu/Debian (20.04+), jalankan:
```bash
curl -fsSL https://raw.githubusercontent.com/fancasaputraimam/Hiratake/main/install-vps.sh | bash
```
Skrip otomatis: pasang Node.js 20 → clone repo → install → build → migrasi database → jalankan via PM2 (auto-start saat reboot) → pasang Nginx di port 80.

Opsi (variabel lingkungan sebelum perintah):
```bash
# Contoh: pakai domain + port lain, tanpa nginx
DOMAIN=jamurku.com PORT=3000 PAKAI_NGINX=1 bash install-vps.sh
```
Setelah selesai: buka `http://IP-VPS-ANDA` → login → **segera ganti sandi** lewat ikon 🔑.
Update versi baru: `cd /opt/hiratake && git pull && npm install && npm run build && pm2 restart hiratake`

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
- ✅ **Form pesanan online publik** → langsung tercatat sebagai PO di sistem (sumber `web`) + auto-daftar pelanggan by WA + buka WhatsApp dengan kode pesanan; anti-spam maks 3 pesanan/WA/hari, validasi nomor WA, harga diambil dari DB

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

### Fase 4 — Keamanan, Notifikasi & Kemudahan (BARU)
- ✅ **Ganti kata sandi sendiri** (semua peran, modal 🔑 di header) — verifikasi sandi lama, min 6 karakter, otomatis logout dari perangkat lain
- ✅ **Rate-limit login**: maks 5 percobaan gagal per username per 5 menit (tabel `login_attempts`), sesi kedaluwarsa dibersihkan otomatis
- ✅ **Notifikasi lonceng 🔔** + badge sidebar + peringatan dashboard: piutang terlambat, piutang jatuh tempo ≤3 hari, pesanan web baru, **prediksi baglog tua** (batch produktif >100 hari)
- ✅ **Cicilan piutang**: bayar sebagian (tabel `pembayaran_piutang`), kolom terbayar/sisa, riwayat cicilan, guard anti-lebih-bayar, otomatis LUNAS saat sisa = 0
- ✅ **Filter bulan + pencarian** di tabel Panen & Penjualan (debounced)
- ✅ **Ekspor CSV** (owner/admin): panen, penjualan, keuangan — kompatibel Excel (BOM UTF-8)
- ✅ **Audit trail**: semua aksi penting (tambah/ubah/hapus/login/bayar) tercatat di `audit_log`, tab **Aktivitas** khusus owner
- ✅ **Nota cetak/PDF**: halaman print `/nota/penjualan/:id` & `/nota/pesanan/:id` (window.print → simpan PDF)
- ✅ **Target produksi bulanan**: diatur di Pengaturan, progress bar berwarna di dashboard (merah <60%, emas <100%, hijau ≥100%)
- ✅ **PWA manifest** + theme-color — bisa "Add to Home Screen" di HP
- ✅ **Template WA diperkaya**: pesan tagihan mencantumkan sisa piutang, pesan pesanan mencantumkan kode/total/status/tanggal kirim
- ✅ **Grafik tren antar-bulan** (tab Laporan): omzet vs pengeluaran vs laba + panen kg & HPP/kg, pilihan 6/12/24 bulan terakhir
- ✅ **Kalkulator harga jual** (tab Laporan): HPP/kg otomatis dari laporan + margin % (default 15%) → harga jual saran per kg dibulatkan ke Rp 500, plus tabel per produk (harga sekarang vs harga pokok vs harga saran + rekomendasi naikkan/pas)
- ✅ **Pemasangan VPS 1-file** (`install-vps.sh`): Node 20 + clone + build + migrasi + PM2 autostart + Nginx, cukup 1 perintah curl

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

## Entri Fungsional Baru (Fase 4)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/pesan-online` | POST | publik | Pesanan online dari landing (anti-spam, auto-daftar pelanggan) |
| `/api/auth/password` | PUT | semua (login) | Ganti kata sandi sendiri |
| `/api/admin/notifikasi` | GET | semua | Piutang telat/dekat, pesanan web baru, batch tua |
| `/api/admin/penjualan/:id/pembayaran` | GET | semua | Riwayat cicilan piutang |
| `/api/admin/penjualan/:id/pembayaran` | POST | owner, admin | Catat cicilan (auto-lunas saat sisa 0) |
| `/api/admin/panen?bulan=` `/api/admin/penjualan?bulan=` | GET | semua | Filter per bulan |
| `/api/admin/ekspor/:jenis` | GET | owner, admin | CSV: panen / penjualan / keuangan |
| `/api/admin/audit` | GET | owner | 200 aktivitas terakhir |
| `/api/admin/nota/:jenis/:id` | GET | semua | Data nota (penjualan/pesanan) |
| `/nota/:jenis/:id` | GET | semua (login) | Halaman nota siap cetak/PDF |
| `/api/admin/tren?n=6\|12\|24` | GET | owner, admin | Tren bulanan: omzet, pengeluaran, laba, panen kg, HPP/kg |

### Rumus Laporan
- **Omzet** = total penjualan bulan itu (basis akrual, termasuk tempo)
- **Kas masuk** = penjualan lunas + tempo yang dilunasi bulan itu (basis kas)
- **Laba/Rugi** = (omzet + pemasukan lain) − total pengeluaran
- **HPP per kg** = (total pengeluaran + investasi baglog baru) ÷ kg panen bulan itu

## Arsitektur Data
- **Penyimpanan**: Cloudflare D1 (SQLite)
- **Tabel**: `users`, `sessions`, `produk` (+berat_kg), `panen` (+grade/susut/batch), `penjualan` (+pelanggan/status_bayar/jatuh_tempo/berat_kg), `baglog_batch`, `baglog_kejadian`, `pelanggan`, `pengaturan`, `pengeluaran`, `pemasukan_lain`, `stok_penyesuaian`, `pesanan` (+sumber web/admin), `pesanan_item`, `pembayaran_piutang`, `login_attempts`, `audit_log`
- **Migrasi**: `migrations/0001_initial_schema.sql` … `migrations/0005_fitur_lanjutan.sql`

## Belum Diimplementasikan (Fase Berikutnya)
- ❌ Deploy produksi ke Cloudflare Pages (menunggu pilihan: hosted Genspark vs akun Cloudflare sendiri) — alternatif VPS sudah tersedia via `install-vps.sh`
- ❌ Pagination tabel (saat ini limit + filter bulan sudah memadai untuk volume kecil)
- ❌ Tailwind build lokal (masih CDN)
- ❌ Galeri foto kumbung asli (butuh foto dari pemilik)
- ❌ Backup data otomatis terjadwal
- ❌ Modul lanjutan: kondisi kumbung, absensi & kasbon, aset

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
11. **Ganti info web** (WA/alamat/jam) & **target produksi bulanan** → tab Web → simpan → langsung aktif
12. **Pesanan online masuk dari website** → muncul badge di sidebar Pesanan + notifikasi 🔔 → proses seperti PO biasa
13. **Pelanggan bayar cicilan** → tab Piutang → tombol Cicil → catat jumlah → otomatis LUNAS saat sisa nol
14. **Butuh nota** → tombol 🖨 Nota di baris penjualan/pesanan → cetak atau simpan PDF
15. **Akhir bulan arsip** → tombol Ekspor CSV di tab Panen/Penjualan/Laporan
16. **Owner cek aktivitas tim** → tab Aktivitas (siapa mencatat/mengubah/menghapus apa & kapan)
17. **Ganti kata sandi** → ikon 🔑 di header (wajib segera setelah pertama kali login!)

## Deployment
- **Platform**: Cloudflare Pages + D1 (dev: wrangler --local + PM2)
- **Status**: ✅ Aktif (sandbox development)
- **Tech Stack**: Hono + TypeScript + D1 + TailwindCSS (CDN) + Chart.js
- **Responsive**: mobile-first, sidebar drawer di HP, tabel scroll horizontal, input anti-zoom iOS
- **UI Form**: semua form tambah/edit berupa modal popup (bottom-sheet di HP, tutup via ✕ / klik luar / Esc)
- **Data**: 100% asli dari input pengguna — seed hanya berisi akun default & katalog produk, tanpa data transaksi contoh; statistik landing selalu sinkron dengan database
- **Keamanan**: password hash (salt+SHA-256), sesi 7 hari + pembersihan otomatis, rate-limit login, audit trail, role-gating semua endpoint, PWA-ready
- **Terakhir Diperbarui**: 2026-08-29 (Tren antar-bulan + kalkulator harga jual + skrip pasang VPS 1-file + GitHub)
