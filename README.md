# Hiratake (平茸) — Website & Sistem Pengelolaan Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan + sistem pengelolaan usaha terpadu "satu sumber data, nol miss"
- **Alur data**: Batch Baglog → Kejadian (kontaminasi) → Panen (grade A/B/C + susut) → Pesanan/PO → Penjualan (pelanggan + lunas/tempo) → Piutang → Stok/Rekonsiliasi → Keuangan → Laporan Laba/Rugi + HPP
- **Responsive**: seluruh halaman (landing, login, dashboard) optimal di HP & laptop

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
- ✅ **Satu jalur pemesanan (checkout tunggal)** → klik kartu produk di landing langsung masuk `/checkout?produk=ID` dengan produk itu **sudah terpilih & disorot**; semua tombol "Pesan Sekarang" (navbar, hero, seksi Pesan) mengarah ke halaman checkout yang sama — form pesan cepat duplikat di landing sudah dihapus. Pesanan langsung tercatat sebagai PO (sumber `web`) + auto-daftar pelanggan by WA; anti-spam maks 3 pesanan/WA/hari, validasi nomor WA, harga diambil dari DB. Bila pesanan online dimatikan owner, klik produk fallback ke chat WhatsApp

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

### Fase 6 — Pengaturan Situs, Absensi & Gaji (BARU)
- ✅ **Pengaturan Situs (khusus owner)**: nama, nama Jepang, tagline, deskripsi, warna tema, jam kerja, dan tombol on/off pesanan online — semua bagian website depan (judul, navbar, hero, footer, warna) langsung mengikuti
- ✅ **Absensi jam kerja**: absen masuk/pulang sekali klik (jam WIB), status hari ini, rekap bulanan hadir/izin/sakit/alpa, riwayat + filter bulan, koreksi oleh owner/admin (izin/sakit/libur/alpa), karyawan hanya melihat data sendiri
- ✅ **Penggajian karyawan (khusus owner)**: set upah harian per orang, gaji otomatis = hari hadir × upah + bonus − potongan, bayar gaji langsung tercatat sebagai pengeluaran kategori `gaji` di laporan keuangan, anti dobel-bayar per periode, pembatalan menghapus pengeluaran terkait

### Fase 4 — Keamanan, Notifikasi & Kemudahan
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

## Fase 13 — Kas Opname, Aset Tetap & Deploy VPS 🆕

### 1. Kas Opname (hitung uang fisik)
- Tabel `kas_opname`; saldo sistem dihitung dari seluruh arus kas nyata.
- Setiap opname jadi **titik awal** perhitungan periode berikutnya → selisih yang sudah diterima tidak dihitung dua kali.
- Toleransi selisih bisa diatur (default Rp 5.000). Lewat toleransi → temuan **KRITIS** di lonceng notifikasi.
- Pengingat otomatis via WhatsApp tiap hari setelah jam 17:00 WIB bila belum opname.
- API: `GET/POST /api/admin/kas/opname`

### 2. Aset Tetap & Penyusutan
- Tabel `aset_tetap` + `aset_penyusutan`. Metode **garis lurus**: `(harga_beli − nilai_residu) / umur_bulan`.
- Dibukukan otomatis tiap awal bulan untuk bulan sebelumnya, **idempotent** (`UNIQUE(aset_id, periode)`).
- **Penyusutan TIDAK mengurangi kas** — uang tidak keluar dari kasir, jadi kas opname tetap akurat.
- Aset yang sudah punya riwayat penyusutan **tidak bisa dihapus** (jejak akuntansi terjaga).
- Menolak membukukan ke periode yang sudah **tutup buku**.
- API: `GET/POST /api/admin/aset`, `PUT /api/admin/aset/:id/status`, `DELETE /api/admin/aset/:id`

### 3. Ekspor Buku Besar (CSV)
- Gabungan penjualan + pemasukan lain + pengeluaran + pembayaran piutang, urut tanggal, dengan **saldo jalan**.
- UTF-8 BOM → langsung rapi dibuka di Excel. Riwayat ekspor dicatat di `buku_ekspor`.
- API: `GET /api/admin/buku/ekspor?periode=YYYY-MM`, `GET /api/admin/buku/ekspor/riwayat`

### 4. Lonceng Notifikasi Pembukuan
`GET /api/admin/notifikasi` kini juga melaporkan: perlu tutup buku, baglog/gaji belum dibukukan, dan status kas opname hari ini.

### 5. Tampilan Dashboard (tab Otomatisasi)
Semua fitur di atas sudah punya kartunya sendiri — tidak perlu lagi lewat API:
- **Kartu Kas Opname** — saldo sistem, rincian masuk/keluar, status hari ini (hijau cocok / merah selisih), form input, dan riwayat.
- **Kartu Aset Tetap** — ringkasan nilai buku, daftar aset dengan bar progres penyusutan, form tambah, tombol ubah status & hapus (khusus owner).
- **Kartu Ekspor Buku Besar** — pilih bulan lalu unduh CSV, plus riwayat ekspor.
- **3 kontrol baru** di form aturan: sakelar penyusutan otomatis, sakelar pengingat opname, dan input toleransi selisih kas.

### Angka Fase 13
- Migrasi: **13** file | Tugas otomatis: **14** | Pemeriksaan integritas: **18**
- Skor kesehatan sistem setelah semua fitur aktif: **100/100**

### Belum dikerjakan (butuh keputusan pemilik)
- **Jurnal double-entry penuh** (debit/kredit + neraca formal) — perombakan struktur, bukan tambalan.
- **Stok per produk** (sekarang stok masih agregat kg) — perlu ubah alur panen & penjualan.

---

## Deploy ke VPS Sendiri 🖥️

Aplikasi ini bisa jalan di VPS biasa **tanpa Cloudflare**. Hasil build yang sama dipakai; D1 diganti `node:sqlite` (built-in Node 22, **tanpa compiler / node-gyp**).

| Berkas | Fungsi |
|---|---|
| `server/index.mjs` | Entry point VPS: migrasi otomatis, seed awal, backup, shim `waitUntil`, file statis |
| `server/d1-sqlite.mjs` | Shim D1 → `node:sqlite` (`prepare/bind/first/all/run/batch/exec`) + migration runner |
| `.env.example` | Contoh konfigurasi |
| `Dockerfile` / `docker-compose.yml` | Cara termudah (disarankan) |
| `deploy/hiratake.service` | systemd, kalau tanpa Docker |
| `deploy/nginx-hiratake.conf` | Reverse proxy + TLS |

### Syarat VPS
- **Node.js 22.5+** (wajib, karena `node:sqlite`) atau Docker
- RAM 512 MB sudah cukup; domain diarahkan ke IP VPS

### Cara A — Docker (disarankan)
```bash
git clone <repo-anda> hiratake && cd hiratake
docker compose up -d --build
docker compose logs -f          # lihat proses migrasi
```
Database & backup tersimpan di `./data/` (aman saat container diganti).

### Cara B — Node langsung + systemd
```bash
# 1. Siapkan
sudo useradd -r -m -d /var/www/hiratake hiratake
sudo git clone <repo-anda> /var/www/hiratake
cd /var/www/hiratake

# 2. Build
npm ci && npm run build

# 3. Konfigurasi
cp .env.example .env && nano .env       # HOST=127.0.0.1

# 4. Izin folder data
sudo mkdir -p data && sudo chown -R hiratake:hiratake /var/www/hiratake

# 5. Jalankan sebagai service
sudo cp deploy/hiratake.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now hiratake
sudo journalctl -u hiratake -f
```

### Nginx + HTTPS
```bash
sudo cp deploy/nginx-hiratake.conf /etc/nginx/sites-available/hiratake
sudo nano /etc/nginx/sites-available/hiratake     # ganti domain-anda.com
sudo ln -s /etc/nginx/sites-available/hiratake /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d domain-anda.com -d www.domain-anda.com
```

### Setelah Deploy — WAJIB
1. Buka `https://domain-anda.com/admin`, login `owner` / `owner123`
2. **GANTI PASSWORD ketiga akun default SEKARANG**
3. Isi pengaturan WhatsApp (OpenWA), QRIS, ongkir di tab Otomatisasi

### Update versi baru
```bash
cd /var/www/hiratake && git pull
npm ci && npm run build
sudo systemctl restart hiratake       # migrasi baru jalan otomatis
# Docker:  docker compose up -d --build
```

### Backup & Restore
- Otomatis: copy file `.sqlite` ke `data/backup/` tiap 24 jam, simpan 14 versi terakhir + saat shutdown.
- Manual restore: hentikan service → copy file backup jadi `data/hiratake.sqlite` → start lagi.
- Sangat disarankan menyalin `data/backup/` ke luar VPS (rsync/S3) secara berkala.

### Hasil uji kompatibilitas VPS (sudah diverifikasi)
| Uji | Hasil |
|---|---|
| 13 migrasi di database kosong | ✅ semua jalan, restart tidak mengulang |
| Seed awal | ✅ hanya saat database kosong |
| Halaman publik / admin / statis / robots / sitemap | ✅ 200 |
| Login + sesi cookie | ✅ |
| Checkout → tandai lunas → rekonsiliasi | ✅ `selisih 0, cocok true` |
| Kas opname, aset, penyusutan, ekspor CSV | ✅ semua normal |
| Penyusutan tidak mengurangi kas | ✅ `keluar: 0` |
| 18 pemeriksaan integritas | ✅ nilai 90–97 |
| Log error / unhandled rejection | ✅ bersih |

---

## Fase 12 — Pembukuan Rapi & Otomatisasi Akuntansi 🆕

Audit lanjutan difokuskan pada **pembukuan/administrasi**. Ditemukan 8 masalah akuntansi
dan semuanya sudah ditambal, plus 4 otomatisasi baru.

### Masalah pembukuan yang ditambal

| # | Masalah | Dampak sebelumnya | Solusi |
|---|---------|-------------------|--------|
| 1 | Biaya baglog tidak pernah masuk `pengeluaran` | Laba terlihat **lebih besar** dari kenyataan | Dibukukan otomatis (`auto:baglog`) |
| 2 | Tidak ada tutup buku | Input terlambat mengubah laporan bulan lalu diam-diam | Tabel `buku_tutup` + 6 penjaga tulis |
| 3 | `penjualan` tidak tertaut ke `pesanan` | Hapus nota meninggalkan kunci nyangkut | Kolom `penjualan.pesanan_id` + lepas kunci |
| 4 | Baris otomatis tak bisa dibedakan dari manual | Bisa dihapus → rekonsiliasi rusak | Kolom `sumber` / `no_bukti`, `auto:*` ditolak dihapus |
| 5 | Tidak ada rekonsiliasi kas | Uang masuk vs buku tidak pernah dicek | Endpoint rekonsiliasi + cek `kas_selisih` |
| 6 | Gaji bisa ada tanpa baris `pengeluaran` | Biaya gaji hilang dari laba/rugi | Cek `gaji_tanpa_biaya` + pembukuan ulang |
| 7 | Piutang lunas via cicilan tetap `tempo` | Piutang terlihat lebih besar | `jalankanRekonPiutang` |
| 8 | `pengeluaran`/`pemasukan_lain` tanpa jejak audit | Perubahan uang tak terlacak | `catatAudit` di POST & DELETE |

### 4 sisa temuan Fase 11 (ditambal)

1. `pesanan.status_bayar` tanpa CHECK → 2 trigger `BEFORE INSERT/UPDATE` (SQLite tak bisa `ALTER ADD CHECK`)
2. `DELETE panen` tanpa penjaga → cek stok minus + cek buku tertutup
3. `DELETE penjualan` meninggalkan `penjualan_dibuat=1` → kunci dilepas + status dikembalikan
4. Penanda "sudah kirim WA" ditulis **sebelum** kirim → kunci dua fase (`proses:<hari>` → `<hari>`)

### Otomatisasi baru (12 tugas total)

| Tugas | Kapan | Fungsi |
|-------|-------|--------|
| `baglog` | setiap denyut | Biaya batch baglog jadi baris pengeluaran |
| `rekonpiutang` | setiap denyut | Piutang yang cicilannya penuh → LUNAS |
| `tutupbuku` | tanggal 5 (bisa diatur) | Kunci buku bulan lalu |
| `rekap` | tanggal 1–3 | Kirim laba/rugi bulan lalu via WhatsApp |

Pemeriksa integritas naik **10 → 15 cek**; `/perbaiki` kini juga membukukan baglog,
membukukan gaji tertinggal, melunaskan piutang, dan melepas kunci nyangkut.

### API baru

| Method | Endpoint | Akses | Fungsi |
|--------|----------|-------|--------|
| GET | `/api/admin/buku` | owner/admin | Daftar periode tertutup + rekap berjalan & bulan lalu |
| POST | `/api/admin/buku/tutup` | owner | Tutup periode (`{periode:"YYYY-MM"}`) — bulan berjalan ditolak |
| DELETE | `/api/admin/buku/:periode` | owner | Buka kembali untuk koreksi |
| GET | `/api/admin/buku/rekonsiliasi?periode=YYYY-MM` | owner/admin | Uang diterima vs terbukukan |

### UI baru (tab Otomatis)

- Kartu **Tutup Buku** — rekap bulan berjalan, peringatan bulan lalu belum ditutup, daftar periode terkunci, tombol tutup/buka
- Kartu **Rekonsiliasi Kas** — pilih bulan, tampilkan selisih + rincian pesanan yang tidak cocok
- 4 sakelar baru + input "Tutup buku tanggal" di kartu Aturan Otomatisasi

### Hasil uji

- Build ✅ `dist/_worker.js 398.78 kB │ gzip 98.79 kB`
- Migrasi `0012` ✅ 22 perintah
- Alur uang ujung-ke-ujung ✅ checkout → lunas → penjualan tertaut (`pesanan_id=9`) → ongkir `auto:ongkir` dibukukan → rekonsiliasi `cocok: true`, `selisih: 0`
- Penjaga periode tertutup ✅ 400 pada pengeluaran/pemasukan-lain/panen/penjualan di bulan terkunci
- HPP tidak dobel hitung ✅ (`pengeluaran` 2.500.000, `investasiBaglog` 0)
- Simpan 5 aturan baru ✅ round-trip

**Catatan migrasi:** produksi masih di `0009`. Sebelum deploy jalankan
`npx wrangler d1 migrations apply webapp-production` (memasang 0010, 0011, **0012**).

## Fase 11 — Audit Sistem & Web Serba Otomatis 🆕

Hasil audit menyeluruh atas alur bisnis (pesanan → bayar → penjualan → laporan), integritas data, dan otomatisasi. Semua temuan sudah ditambal, plus mesin otomatisasi diperluas supaya web berjalan tanpa perlu ditekan manual.

### 🐞 Bug yang ditemukan & diperbaiki

| Tingkat | Masalah | Perbaikan |
|---|---|---|
| **FATAL** | Kolom `produk.urutan` **tidak ada** padahal dipakai `ORDER BY urutan, id` di JSON-LD landing → query gagal & di-`catch` diam-diam, daftar produk SEO **kosong** | Migrasi `0011` menambah kolom + index. Terbukti: JSON-LD Product **0 → 6** |
| **KRITIS** | Otomatisasi hanya punya **1 pemicu** (`GET /api/admin/ringkasan`). Kalau owner tidak buka dashboard, auto-alpa, ringkasan pagi, tagih piutang, sapu invoice **semua terlewat** | `middlewareDenyut()` global — setiap GET wajar (termasuk landing publik) memicu otomatisasi, dengan throttle 5 menit |
| **KRITIS** | Pesanan web yang **sudah dibayar** tidak pernah jadi baris `penjualan` sampai admin klik "Selesai" → omzet, stok & laporan **buta terhadap uang masuk** | `tandaiLunas` langsung mencatat penjualan + jaring pengaman `jalankanSusulPenjualan` + tombol perbaiki manual |
| **KRITIS** | **Ongkir & biaya admin ditagih tapi tidak dibukukan** → `pembayaran.jumlah` tak pernah cocok dengan omzet tercatat | Ongkir & biaya admin masuk `pemasukan_lain`, fee gateway masuk `pengeluaran`. Terbukti rekonsiliasi **presisi**: 32.000 + 6.000 + 700 = 38.700 |
| **KRITIS** | Kode PO dibuat dari `COUNT(*)` → **bentrok** saat checkout bersamaan / setelah data dihapus → checkout pelanggan error 500 | Kode dari `MAX(kode)` + retry 6×. Terbukti: **6 checkout paralel → 6 kode unik, 0 duplikat** |
| **KRITIS** | `catch` callback gateway melaporkan **semua** error sebagai `{ok:true, duplikat:true}` → gateway berhenti retry, pembayaran bisa **hilang** | Hanya pelanggaran UNIQUE = duplikat; error lain balas 500 agar gateway retry |
| **PERINGATAN** | Penjualan bisa **dobel** kalau bayar-otomatis dan klik "Selesai" bertabrakan | Klaim atomik `penjualan_dibuat` — hanya satu pemanggil lolos, kunci dilepas kalau batch gagal |
| **PERINGATAN** | Auto-alpa hanya melewati hari **Minggu** → hari libur nasional karyawan salah ditandai **alpa** | Tabel `hari_libur` + pembatalan alpa **retroaktif** saat tanggal didaftarkan |
| **INFO** | Urutan produk beda antara landing (`urutan, id`) dan `/api/produk` (`id`) | Diseragamkan |

### 🤖 Otomatisasi baru (tanpa cron, aman untuk hosted deploy)
- ✅ **Denyut global** — otomatisasi dibonceng request masuk (`waitUntil`), throttle 5 menit, jejak `otomatis_denyut_terakhir` + `otomatis_denyut_sumber` tampil di dashboard
- ✅ **Catat penjualan saat lunas** — pesanan dibayar langsung jadi omzet + potong stok
- ✅ **Susul penjualan tertinggal** — maksimal 10 pesanan lunas-tanpa-penjualan dibereskan tiap denyut
- ✅ **Sapu pesanan mangkrak** — pesanan web `baru` yang tidak dibayar > N hari (default 3) dibatalkan otomatis + catatan + audit log
- ✅ **Ingatkan pesanan lunas belum diproses** — digest WA ke owner bila pesanan lunas menganggur ≥ N jam (default 6)
- ✅ **Kalender hari libur** — auto-alpa melewati tanggal libur, alpa salah dibatalkan retroaktif
- ✅ **Pemeriksa mandiri (self-audit) 10 titik** dengan skor kesehatan `100 − kritis×25 − peringatan×10 − info×3`: `lunas_tanpa_jual`, `po_tanpa_item`, `kode_kembar`, `piutang_minus`, `stok_minus`, `bayar_ngambang`, `mandek`, `callback_gagal`, `wa_gagal`, `absen_gantung`
- ✅ **Perbaiki sekali klik** — temuan bertanda `autoPerbaiki` (penjualan tertinggal, pembayaran ngambang) dibereskan dari satu tombol

### 🖥️ Tab **Otomatisasi** (owner/admin)
Empat kartu: **Kesehatan Sistem** (skor + daftar temuan + tombol Periksa/Perbaiki), **Tugas Otomatis** (denyut terakhir + status tiap tugas), **Aturan Otomatisasi** (jam ringkasan, hari sapu, jam ingat, 7 sakelar), **Hari Libur** (tambah/hapus tanggal). Badge sidebar `#badge-otomatis` menampilkan jumlah temuan kritis.

### 🔌 API Baru (Fase 11)
| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/admin/otomatis` | owner/admin | Status denyut + daftar tugas + nilai aturan |
| PUT | `/api/admin/otomatis` | owner/admin | Ubah aturan (whitelist 10 kunci, angka di-clamp) |
| POST | `/api/admin/otomatis/jalankan` | owner/admin | Paksa jalankan semua tugas sekarang |
| GET | `/api/admin/otomatis/periksa` | owner/admin | Jalankan 10 pemeriksaan integritas, balas skor + temuan |
| POST | `/api/admin/otomatis/perbaiki` | owner/admin | Perbaiki otomatis temuan yang bisa diperbaiki |
| GET | `/api/admin/libur` | owner/admin | Daftar hari libur |
| POST | `/api/admin/libur` | owner/admin | Tambah hari libur (+ batalkan alpa salah) |
| DELETE | `/api/admin/libur/:tanggal` | owner/admin | Hapus hari libur |

### 🧪 Hasil uji Fase 11
JSON-LD Product 0 → **6** · denyut aktif dari `auto:/` (landing publik) · skor integritas **100 / sehat** (10 pemeriksaan) · rekonsiliasi uang **presisi** · idempoten (pemicu ganda tetap 1 penjualan) · **6 checkout paralel → 0 kode duplikat** · self-repair 65 → 90 → 100 · 3 endpoint baru **200 ter-auth / 401 tanpa auth** · console browser **0 error**

### 📦 Migrasi
`migrations/0011_audit_otomatisasi.sql` — kolom `produk.urutan`, tabel `hari_libur`, 3 index (`pesanan.kode`, sapu, `penjualan_dibuat`), 10 kunci pengaturan otomatisasi.

---

## Fase 10 — Share Preview, SEO, Backup & Performa

### 🖼️ Open Graph & Share Preview WhatsApp (masalah #3 — SELESAI)
- ✅ Link yang dibagikan di **WhatsApp / Facebook / Telegram / X** sekarang memunculkan **gambar besar + judul + deskripsi**
- ✅ Meta lengkap: `og:title`, `og:description`, `og:image` (URL **absolut**, syarat WhatsApp), `og:image:width/height`, `og:type`, `og:site_name`, `og:locale`, plus **Twitter Card** `summary_large_image` dan `<link rel="canonical">`
- ✅ Banner share bawaan **1200×630** (`/static/og-hiratake.jpg`, 98 KB) — bergaya Hiratake: latar sumi gelap + pola seigaiha + jamur tiram
- ✅ **Gambar share bisa diganti owner** dari tab Situs → Foto Website (kunci `share`)
- ✅ Anti-cache: setiap gambar share diganti, `og_versi` naik otomatis → preview WhatsApp/Facebook ikut segar (tidak menampilkan gambar lama)

### ⚠️ Halaman 404 Bergaya Hiratake (masalah #4 — SELESAI)
- ✅ Ganti teks polos "Not Found" → halaman bermerek: angka **404** dalam cincin *enso*, kanji 迷子 (tersesat), pesan ramah "jamur yang Anda cari belum tumbuh di sini 🍄"
- ✅ Tombol **Kembali ke Beranda** & **Lihat Produk**, plus 3 kartu bantuan: Pesan Jamur / Lacak Pesanan / Tanya via WhatsApp
- ✅ Rute `/api/*` yang salah tetap balas **JSON** (bukan HTML) agar frontend mudah menanganinya
- ✅ Tahan galat: bila database bermasalah, 404 tetap tampil dengan identitas default

### 🗺️ sitemap.xml + robots.txt (masalah #5 — SELESAI)
- ✅ `/sitemap.xml` — halaman `/`, `/checkout`, `/lacak` dengan `lastmod` **otomatis** dari tanggal panen terakhir
- ✅ `/robots.txt` disempurnakan: `Disallow` area privat (`/admin`, `/login`, `/api/`, `/nota/`), `Crawl-delay` untuk perayap agresif (hemat kuota), dan penunjuk `Sitemap:`
- ✅ Halaman dashboard & publik fungsional diberi `noindex`

### 💾 Backup Database Lengkap (masalah #6 — SELESAI)
- ✅ Tombol **"Ekspor Backup Lengkap"** di tab Situs (khusus owner) — **23 tabel** sekaligus
- ✅ Dua format: **`.sql`** (pemulihan penuh, `INSERT` batch + `DELETE` per tabel + `PRAGMA defer_foreign_keys`) dan **`.json`** (arsip/olah data)
- ✅ Urutan tabel mengikuti ketergantungan *foreign key* → file bisa dipulihkan berurutan tanpa galat
- ✅ Opsi **Sertakan Foto** (logo, galeri, selfie absensi) — terpisah karena file jauh lebih besar
- ✅ **Pengingat mingguan otomatis**: ringkasan menampilkan jumlah tabel/baris + "backup terakhir N hari lalu"; muncul peringatan merah bila ≥7 hari atau belum pernah
- ✅ Nama file otomatis: `backup-hiratake-2026-08-30_1530.sql` (waktu WIB)
- ✅ Setiap unduhan tercatat di **audit trail**
- ✅ Petunjuk pemulihan langsung di dashboard (perintah `wrangler d1 execute`)

### ⚡ Tailwind CSS Statis — CDN Dihapus (masalah #8 — SELESAI)
- ✅ `https://cdn.tailwindcss.com` (**±300 KB JS yang memblokir render** + peringatan produksi) **dihapus dari SEMUA halaman** (landing, checkout/bayar/lacak, login, dashboard, 404)
- ✅ Diganti **CSS statis hasil build**: `public/static/tailwind.css` — **31 KB (6 KB gzip)**, sekitar **10× lebih kecil** dan tidak memblokir render
- ✅ Warna tema **tetap bisa diganti owner** tanpa build ulang — Tailwind memakai `rgb(var(--vermillion-rgb) / <alpha-value>)`, jadi `bg-vermillion/10` dsb. tetap bekerja
- ✅ `safelist` untuk kelas yang dibentuk dinamis dari data DB (badge status, baris merah, dll.) agar tidak terpangkas
- ✅ Build otomatis: `npm run build` menjalankan `build:css` lalu `vite build` (juga tersedia `npm run watch:css`)

### ⭐ Testimoni Pelanggan (nilai tambah #9 — SELESAI)
- ✅ Seksi **"Kata Pelanggan Kami"** di landing (setelah Galeri) — kartu dengan bintang, kutipan, avatar inisial
- ✅ CRUD penuh dari dashboard: tambah/ubah/hapus + tombol **mata** untuk tampil/sembunyikan cepat + urutan tampil
- ✅ Seksi **otomatis tersembunyi** bila belum ada testimoni (halaman tidak terlihat kosong)
- ✅ Validasi: nama 2–60 karakter, isi 10–400 karakter, rating 1–5, maksimal 50 testimoni

### 🗺️ Peta Lokasi Kumbung (nilai tambah #10 — SELESAI)
- ✅ Embed **Google Maps tanpa API key** di seksi Kontak + tombol **Petunjuk Arah** & **Buka Maps**
- ✅ Diatur owner di tab Situs (latitude/longitude/zoom), dengan tombol **"Pakai lokasi saya"** dan **"Samakan dengan titik absen"**
- ✅ `loading="lazy"` agar tidak memperlambat halaman; peta **tidak tampil** bila koordinat kosong

### 📊 Structured Data JSON-LD (nilai tambah #11 — SELESAI)
- ✅ `LocalBusiness` + `Farm`: nama, deskripsi, logo, telepon, `contactPoint`, alamat, `openingHours` (diurai dari teks jam operasional), `geo` + `hasMap`, `priceRange`, `paymentAccepted`
- ✅ `Product` + `Offer` per produk aktif (harga, IDR, `InStock`) — berpotensi tampil **dengan harga** di hasil Google
- ✅ `AggregateRating` + `Review` dari testimoni → berpotensi tampil **bintang** di hasil Google
- ✅ Produk & testimoni di-*render server-side* (mesin pencari tidak menunggu JavaScript)
- ✅ Aman XSS: `<` dan `>` di-escape di dalam `<script type="application/ld+json">`

### 🔔 Notifikasi WA & QRIS (catatan #12)
Fiturnya **sudah selesai sejak Fase 7–8** dan aktif otomatis begitu secret dipasang — tidak perlu ubah kode:
```bash
npx wrangler pages secret put OPENWA_API_KEY --project-name webapp     # notifikasi & OTP WhatsApp
npx wrangler pages secret put BAYAR_SERVER_KEY --project-name webapp   # QRIS / payment gateway
npx wrangler pages secret put BAYAR_CLIENT_KEY --project-name webapp
npx wrangler pages secret put BAYAR_CALLBACK_SECRET --project-name webapp
```

## URL Publik Baru (Fase 10)
| Rute | Keterangan |
|------|-----------|
| `/robots.txt` | Aturan perayap + penunjuk sitemap |
| `/sitemap.xml` | Peta situs, `lastmod` otomatis |
| `/static/og-hiratake.jpg` | Banner share 1200×630 |
| `/static/tailwind.css` | CSS statis (pengganti CDN) |
| `/media/situs/share` | Gambar share versi owner (bila diunggah) |
| *(rute tidak dikenal)* | Halaman 404 bergaya Hiratake |

## API Baru (Fase 10)
| Metode | Endpoint | Peran |
|--------|----------|-------|
| GET | `/api/admin/backup/ringkasan` | owner |
| GET | `/api/admin/backup/unduh?format=sql\|json&media=1` | owner |
| GET | `/api/admin/testimoni` | owner, admin |
| POST | `/api/admin/testimoni` | owner, admin |
| PUT | `/api/admin/testimoni/:id` | owner, admin |
| PATCH | `/api/admin/testimoni/:id/tampil` | owner, admin |
| DELETE | `/api/admin/testimoni/:id` | owner, admin |

## Fase 7 — Integrasi OpenWA (WhatsApp API Gateway) 🆕

Terintegrasi dengan **[OpenWA](https://github.com/rmyndharis/OpenWA)** — gateway WhatsApp open-source (MIT).

### ⚠️ Arsitektur (WAJIB dipahami)
OpenWA adalah aplikasi **NestJS + Chromium/Baileys** yang **tidak bisa jalan di Cloudflare Workers**. Pola integrasinya:

```
Hiratake (Cloudflare Pages)  --REST + X-API-Key-->  OpenWA (VPS Anda)  -->  WhatsApp
Hiratake (Cloudflare Pages)  <--webhook + HMAC----  OpenWA (VPS Anda)
```

Jadi OpenWA **harus dipasang di VPS sendiri** (bukan di Cloudflare). Hiratake hanya memanggilnya via API.

### Fitur yang sudah jalan
- ✅ **OTP login pengelola tanpa kata sandi** — kode 6 angka ke WhatsApp; sekali pakai, kedaluwarsa 5 menit, maks 5 salah-input, maks 3 permintaan/10 menit, rate-limit login tetap berlaku, balasan seragam agar username tidak bocor
- ✅ **OTP verifikasi pemesan** — pesanan online wajib verifikasi nomor (anti pesanan palsu), batas 10 kode/nomor/hari
- ✅ **Notifikasi otomatis** (semua bisa dinyalakan/dimatikan per jenis):
  | Kejadian | Penerima |
  |---|---|
  | Pesanan masuk (web & dashboard) | Pelanggan |
  | Pesanan web baru | Owner & admin (internal) |
  | Status pesanan berubah | Pelanggan |
  | Pesanan selesai → nota | Pelanggan |
  | Piutang jatuh tempo / terlambat | Pelanggan |
  | Pembayaran cicilan diterima | Pelanggan |
  | Gaji dibayar → slip gaji | Karyawan |
- ✅ **Pengingat piutang harian otomatis** — pola *lazy-cron* (Cloudflare hosted deploy tidak mendukung cron trigger): dicek pada request masuk, sekali per hari setelah jam yang diatur, anti-dobel per piutang per hari, jeda 1,2 detik/pesan
- ✅ **Balasan otomatis (webhook)** — `CEK <kode>` (status pesanan, **hanya untuk nomor pemesan** — proteksi privasi), `HARGA` (daftar harga dari DB), `JAM` (jam & alamat), menu bantuan dibatasi 1×/6 jam per nomor
- ✅ **Template pesan bisa diedit** — 10 template dengan placeholder `{nama}`, `{kode}`, `{total}`, `{rincian}`, dll + pratinjau data contoh
- ✅ **Log pengiriman lengkap** — status terkirim/gagal + alasan error, filter jenis/status/pencarian, tombol kirim ulang (OTP dikecualikan demi keamanan)
- ✅ **Broadcast** ke kelompok pelanggan (semua / aktif 30 hari / punya piutang / per tipe) — dibatasi **50 nomor** per kirim + jeda otomatis untuk menekan risiko blokir WhatsApp
- ✅ **Kelola sesi dari dashboard** — status koneksi, mulai sesi, tampilkan QR, uji kirim
- ✅ **Keamanan**: webhook diverifikasi **HMAC-SHA256** atas raw body (`X-OpenWA-Signature`) dengan perbandingan *constant-time*; idempotency anti-dobel; API key & secret **tidak pernah** dikirim ke browser

### Cara memasang OpenWA
```bash
# Opsi A — sekalian saat instalasi Hiratake di VPS
PASANG_OPENWA=1 bash install-vps.sh

# Opsi B — manual
git clone https://github.com/rmyndharis/OpenWA.git /opt/openwa
cd /opt/openwa && docker compose -f docker-compose.dev.yml up -d
```

Lalu:
1. Buka dashboard OpenWA (`http://IP-VPS:2785`) → buat **API Key** (hanya tampil sekali)
2. Buat sesi (mis. `hiratake`) → Start → **scan QR**
3. Simpan kredensial ke server Hiratake:
   ```bash
   # Produksi (Cloudflare)
   npx wrangler pages secret put OPENWA_API_KEY
   npx wrangler pages secret put OPENWA_WEBHOOK_SECRET
   # Lokal / VPS: isi berkas .dev.vars
   ```
4. Dashboard Hiratake → tab **WhatsApp** → **Konfigurasi**: isi URL gateway + nama sesi, centang *Aktifkan integrasi*, Simpan, lalu **Uji Kirim**
5. Daftarkan webhook di OpenWA (perintah `curl` siap-tempel tersedia di tab tersebut) dengan `secret` = nilai `OPENWA_WEBHOOK_SECRET`

### 🚨 Peringatan penting
OpenWA memakai klien WhatsApp **tidak resmi** (bukan Cloud API Meta):
- **Gunakan nomor khusus**, jangan nomor pribadi/utama — selalu ada risiko nomor dibatasi/diblokir
- **Jangan blast** ke nomor yang belum pernah menghubungi Anda — ini penyebab blokir paling umum
- Untuk hal kritis (login), **sediakan jalur cadangan** — login kata sandi tetap tersedia dan tidak dihapus
- Tidak cocok untuk lingkungan yang wajib patuh regulasi (gunakan WhatsApp Cloud API resmi)

### Endpoint baru
| Metode | Path | Akses |
|---|---|---|
| GET/PUT | `/api/admin/wa/pengaturan` | owner, admin |
| GET | `/api/admin/wa/status` · `/qr` | owner, admin |
| POST | `/api/admin/wa/mulai-sesi` · `/uji` · `/kirim` · `/broadcast` · `/pengingat` | owner, admin |
| GET | `/api/admin/wa/log` · `/masuk` · `/broadcast/hitung` | owner, admin |
| POST | `/api/admin/wa/log/:id/kirim-ulang` · `/tagih/:id` | owner, admin |
| GET/PUT | `/api/admin/wa/template` · `/template/:kode` | owner, admin |
| PUT | `/api/admin/users/:id/wa` | owner |
| PUT | `/api/auth/wa` | semua (login) |
| GET/POST | `/api/auth/otp/tersedia` · `/minta` · `/verifikasi` | publik |
| GET/POST | `/api/pesan-online/otp-wajib` · `/otp` | publik |
| POST | `/api/webhook/openwa` | OpenWA (HMAC) |

### Tabel baru
`wa_pesan` (log kirim) · `wa_otp` (kode ter-hash) · `wa_template` (template) · `wa_masuk` (pesan masuk) · kolom `users.wa`

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

## Entri Fungsional Baru (Fase 5)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/admin/tren?bulan=N` | GET | owner, admin | Tren N bulan terakhir: omzet, pengeluaran, laba, panen kg, HPP/kg |
| `/api/admin/kalkulator-harga?margin=15` | GET | owner, admin | HPP/kg rata 3 bulan berpanen + rekomendasi harga jual per produk |
| `/api/admin/produk/:id/harga` | PUT | owner, admin | Terapkan harga rekomendasi (tercatat di audit) |

### Rumus Laporan
- **Omzet** = total penjualan bulan itu (basis akrual, termasuk tempo)
- **Kas masuk** = penjualan lunas + tempo yang dilunasi bulan itu (basis kas)
- **Laba/Rugi** = (omzet + pemasukan lain) − total pengeluaran
- **HPP per kg** = (total pengeluaran + investasi baglog baru) ÷ kg panen bulan itu

### Kalkulator Harga Jual (tab Laporan)
- HPP/kg dihitung dari **rata-rata 3 bulan terakhir yang ada panen** (lebih stabil dari 1 bulan)
- Modal per unit = HPP/kg × berat produk (kg) — produk olahan/baglog dihitung manual
- Harga rekomendasi = modal × (1 + margin%) dibulatkan **ke atas per Rp500**
- Margin bisa diubah (default 15%), tombol **Terapkan** langsung mengubah harga produk di katalog & website

## Entri Fungsional Baru (Fase 6)
| Path | Metode | Peran | Deskripsi |
|------|--------|-------|-----------|
| `/api/admin/pengaturan-situs` | PUT | owner | Ubah identitas website: nama, nama Jepang, tagline, deskripsi, warna tema, on/off pesanan online, jam kerja |
| `/api/admin/absensi/masuk` | POST | semua | Absen masuk (jam WIB otomatis, anti-dobel) |
| `/api/admin/absensi/pulang` | POST | semua | Absen pulang |
| `/api/admin/absensi/saya` | GET | semua | Status absensi hari ini |
| `/api/admin/absensi?bulan=` | GET | semua | Riwayat + rekap bulanan (karyawan hanya lihat miliknya) |
| `/api/admin/absensi/koreksi` | PUT | owner, admin | Koreksi absensi: hadir/izin/sakit/libur/alpa |
| `/api/admin/users/:id/upah` | PUT | owner | Set upah harian karyawan |
| `/api/admin/gaji?periode=` | GET | owner | Rekap gaji per periode (hari hadir × upah harian) |
| `/api/admin/gaji/bayar` | POST | owner | Bayar gaji (+bonus −potongan) → otomatis tercatat sebagai pengeluaran kategori 'gaji', anti dobel-bayar |
| `/api/admin/gaji/:id` | DELETE | owner | Batalkan pembayaran gaji (pengeluaran terkait ikut terhapus) |

### Pengaturan Situs (tab khusus Owner)
- Nama, nama Jepang, tagline, deskripsi, dan **warna tema** website depan bisa diganti tanpa sentuh kode
- **Pesanan online bisa dimatikan** — form di website hilang dan API menolak (403)
- Jam kerja masuk/pulang dipakai sebagai info di tab Absensi

### Absensi & Gaji
- Karyawan absen masuk/pulang sendiri (jam WIB tercatat), owner/admin bisa koreksi status
- Rekap bulanan otomatis: hadir/izin/sakit/alpa per orang
- Gaji = hari hadir × upah harian + bonus − potongan; upah saat bayar disimpan sebagai snapshot
- Pembayaran gaji langsung masuk laporan keuangan sebagai pengeluaran kategori `gaji`

## Arsitektur Data
- **Penyimpanan**: Cloudflare D1 (SQLite)
- **Tabel**: `users` (+upah_harian), `sessions`, `produk` (+berat_kg), `panen` (+grade/susut/batch), `penjualan` (+pelanggan/status_bayar/jatuh_tempo/berat_kg), `baglog_batch`, `baglog_kejadian`, `pelanggan`, `pengaturan` (+kunci situs_* & jam_kerja_*), `pengeluaran`, `pemasukan_lain`, `stok_penyesuaian`, `pesanan` (+sumber web/admin), `pesanan_item`, `pembayaran_piutang`, `login_attempts`, `audit_log`, `absensi`, `gaji`
- **Migrasi**: `migrations/0001_initial_schema.sql` … `migrations/0006_absensi_gaji_situs.sql`

## Instalasi VPS Satu File
File `install-vps.sh` memasang semuanya otomatis di VPS Ubuntu/Debian:
```bash
# dari dalam folder repo:
sudo bash install-vps.sh
# atau langsung dari GitHub (ganti URL repo):
curl -fsSL https://raw.githubusercontent.com/USER/REPO/main/install-vps.sh | sudo REPO_URL=https://github.com/USER/REPO.git bash
# dengan domain + HTTPS otomatis:
sudo DOMAIN=jamur.contoh.com EMAIL_SSL=email@kamu.com bash install-vps.sh
```
Yang dipasang otomatis: Node.js 20, PM2 (auto-start saat reboot), build aplikasi, migrasi database SQLite, seed akun default, dan opsional Nginx + sertifikat HTTPS gratis (Let's Encrypt). Jalankan ulang file yang sama untuk update versi.


## Fase 8 — Checkout Pelanggan, Payment Gateway Universal & Fitur OTP WhatsApp

### Halaman Publik Baru
| URL | Fungsi |
|---|---|
| `/checkout` | Form checkout lengkap: pilih banyak produk + jumlah, data pengiriman, pilih metode **Tunai/COD** atau **QRIS**, verifikasi OTP WA (bila diwajibkan owner), ringkasan biaya real-time |
| `/bayar?kode=BYR-...` | Halaman pembayaran QRIS: QR render otomatis, hitung-balik kedaluwarsa, polling status tiap 6 detik, unduh QR, tombol kirim bukti via WhatsApp (untuk QRIS statis) |
| `/lacak` atau `/lacak?token=...` | Lacak pesanan mandiri: lewat link token (tanpa OTP) atau lewat nomor WA + kode OTP |

### Payment Gateway Universal (dipilih owner di Setting)
Satu adapter provider-agnostik — owner cukup memilih provider di **Dashboard → Pembayaran → Gateway & Metode**, tanpa mengubah kode:

| Provider | Kredensial (`BAYAR_SERVER_KEY`) | Tanda tangan callback |
|---|---|---|
| **QRIS Statis** (gratis, tanpa gateway) | — (cukup URL gambar QRIS) | verifikasi manual oleh admin |
| **Midtrans** (Core API QRIS/GoPay) | Server Key | SHA-512 `order_id+status_code+gross_amount+server_key` |
| **Xendit** (QR Code) | Secret API Key | header `x-callback-token` |
| **Duitku** | API Key | MD5 `merchantCode+amount+merchantOrderId+apiKey` |
| **Tripay** | Private Key | HMAC-SHA256 atas raw body (`x-callback-signature`) |

**Kredensial disimpan sebagai secret server, tidak pernah masuk database maupun dikirim ke browser.** Endpoint konfigurasi hanya mengembalikan status boolean (`terpasang` / `belum ada`).

```bash
# Produksi (Cloudflare)
npx wrangler pages secret put BAYAR_SERVER_KEY
npx wrangler pages secret put BAYAR_CLIENT_KEY
npx wrangler pages secret put BAYAR_CALLBACK_SECRET
# Lokal → isi berkas .dev.vars
```

### Fitur Pendukung Usaha Berbasis OTP WhatsApp
1. **Lacak pesanan mandiri** — pelanggan pantau status sendiri lewat link token permanen, atau masuk pakai nomor WA + kode OTP bila link hilang (batas 10 permintaan/hari/nomor). Mengurangi chat "pesanan saya sudah jalan belum?".
2. **Bukti serah terima anti-sengketa** — kurir minta kode dikirim ke WA pelanggan, pelanggan menyebutkan kodenya, kurir memasukkan di dashboard. Jadi bukti digital bahwa barang benar diterima (`diterima_at`, `diterima_oleh`).
3. **Notifikasi pembayaran otomatis** — link bayar + batas waktu ke pelanggan (menaikkan tingkat pembayaran), bukti lunas + link lacak, kabar ke owner/admin setiap ada uang masuk.
4. **Tagihan kedaluwarsa otomatis** — tanpa cron (tidak didukung hosted deploy): dijalankan *lazy* saat ada request masuk lewat `waitUntil`.

Semua notifikasi **fail-safe**: bila gateway WhatsApp mati, transaksi tetap berhasil — pesan hanya dilewati.

### Pengamanan Pembayaran (sudah diuji)
| Serangan / kasus | Perlindungan | Hasil uji |
|---|---|---|
| Manipulasi harga dari sisi klien | harga **selalu** dibaca ulang dari tabel `produk` | ✅ |
| Callback dengan tanda tangan palsu | verifikasi per provider, dicatat tapi tidak diproses | ✅ HTTP 401 |
| Replay / callback ganda | `pembayaran_callback.sidik` UNIQUE = `provider:sha256(rawBody)` | ✅ `{duplikat:true}` |
| Bayar kurang / lebih (fraud) | nominal callback dicocokkan dengan tagihan (toleransi 1 rupiah) | ✅ HTTP 409 |
| Verifikasi lunas dobel | `UPDATE ... WHERE status='menunggu'` + cek `meta.changes` | ✅ ditolak |
| QRIS diaktifkan tanpa kredensial | guard di endpoint simpan pengaturan | ✅ ditolak dengan instruksi |
| Spam pesanan | maksimal 3 pesanan/nomor/hari | ✅ HTTP 429 |

### Endpoint Baru
```
GET  /api/checkout/info                       daftar produk + metode + biaya aktif
POST /api/checkout                            buat pesanan (cash / qris)
GET  /api/bayar/:kode                         detail tagihan (publik)
GET  /api/bayar/:kode/status                  polling status pembayaran
POST /api/callback/pembayaran[?provider=]     webhook gateway (semua provider)
GET  /api/lacak/token/:token                  lacak via link token
POST /api/lacak/otp                           minta kode lacak via WA
POST /api/lacak/verifikasi                    verifikasi kode → daftar pesanan
POST /api/admin/pesanan/:id/terima/kirim-kode kirim OTP serah terima  (auth)
POST /api/admin/pesanan/:id/terima            konfirmasi barang diterima (auth)
GET  /api/admin/bayar/pengaturan              baca konfigurasi   (owner/admin)
PUT  /api/admin/bayar/pengaturan              simpan konfigurasi (owner)
GET  /api/admin/bayar/transaksi               daftar + statistik  (owner/admin)
POST /api/admin/bayar/:id/lunas               verifikasi manual   (owner/admin)
POST /api/admin/bayar/:id/batal               batalkan transaksi  (owner/admin)
POST /api/admin/bayar/uji                     uji koneksi gateway (owner)
```

### Tab Dashboard Baru: Pembayaran
Sub-panel: **Transaksi** (filter status/metode/cari, tandai lunas, batal, konfirmasi terima) · **Gateway & Metode** (pilih provider, mode sandbox/produksi, QRIS statis + pratinjau, URL callback siap-salin, status kredensial) · **Biaya & Ongkir** (biaya gateway serap/bebankan, ongkir + gratis ongkir, simulasi hitung otomatis) · **Fitur OTP & Notifikasi** (saklar lacak, serah terima, notifikasi) · **Panduan** (langkah pemasangan per provider).

### Struktur Data Baru (migrasi 0008)
- `pesanan` + 11 kolom: `metode_bayar`, `status_bayar`, `alamat_kirim`, `ongkir`, `biaya_admin`, `total_bayar`, `token_lacak`, `dibayar_at`, `diterima_at`, `diterima_oleh`
- `pembayaran` — kode, metode, provider, jumlah, status, `ref_id`, `qr_string`/`qr_url`/`bayar_url`, `expires_at`, verifikator
- `pembayaran_callback` — jejak audit semua webhook + `sidik` UNIQUE anti-replay
- `wa_otp` — tujuan diperluas: `login`, `pesanan`, `lacak`, `terima`
- 24 baris `pengaturan` (`bayar_*`, `lacak_*`, `terima_*`) + 7 template WhatsApp baru

## Belum Diimplementasikan (Fase Berikutnya)
- ❌ Deploy produksi ke Cloudflare Pages (menunggu pilihan: hosted Genspark vs akun Cloudflare sendiri)
- ❌ Pagination tabel (saat ini limit + filter bulan sudah memadai untuk volume kecil)
- ❌ Tailwind build lokal (masih CDN)
- ❌ Galeri foto kumbung asli (butuh foto dari pemilik)
- ❌ Backup data otomatis terjadwal
- ❌ Modul lanjutan: kondisi kumbung, kasbon karyawan, aset
- ❌ Slip gaji cetak/PDF per karyawan
- ❌ Uji gateway berbayar sungguhan (Midtrans/Xendit/Duitku/Tripay) — butuh kredensial sandbox dari pemilik usaha; kode & tanda tangan sudah siap
- ❌ Unggah gambar QRIS langsung dari dashboard (saat ini tempel URL)

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
- **Terakhir Diperbarui**: 2026-08-29 (Fase 8: checkout pelanggan tunai/QRIS, payment gateway universal 5 provider, lacak pesanan & serah terima berbasis OTP WhatsApp)
