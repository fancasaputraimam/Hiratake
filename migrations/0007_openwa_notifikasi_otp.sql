-- ============================================================
-- Fase 7: Integrasi OpenWA (WhatsApp API Gateway)
-- Fitur: OTP login WA, notifikasi otomatis, template pesan,
--        log pengiriman, webhook masuk, auto-reply
-- OpenWA: https://github.com/rmyndharis/OpenWA
-- ============================================================

-- Nomor WhatsApp pengguna (untuk OTP login & notifikasi internal)
ALTER TABLE users ADD COLUMN wa TEXT DEFAULT '';

-- ---------- Log semua pesan WA keluar (audit + retry) ----------
CREATE TABLE IF NOT EXISTS wa_pesan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tujuan TEXT NOT NULL,                 -- nomor tujuan (62xxx)
  jenis TEXT NOT NULL,                  -- otp | pesanan_baru | pesanan_status | nota | piutang | cicilan | gaji | absensi | manual | broadcast | autoreply | uji
  isi TEXT NOT NULL,                    -- teks pesan yang dikirim
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','terkirim','gagal')),
  message_id TEXT DEFAULT '',           -- id pesan dari OpenWA
  error TEXT DEFAULT '',                -- pesan error bila gagal
  entitas TEXT DEFAULT '',              -- pesanan / penjualan / gaji / auth
  entitas_id TEXT DEFAULT '',
  percobaan INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER,                      -- pemicu (null = otomatis/sistem)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  terkirim_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wa_pesan_tujuan ON wa_pesan(tujuan);
CREATE INDEX IF NOT EXISTS idx_wa_pesan_status ON wa_pesan(status);
CREATE INDEX IF NOT EXISTS idx_wa_pesan_created ON wa_pesan(created_at);
CREATE INDEX IF NOT EXISTS idx_wa_pesan_jenis ON wa_pesan(jenis);

-- ---------- OTP (login pengelola & verifikasi nomor pemesan) ----------
CREATE TABLE IF NOT EXISTS wa_otp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa TEXT NOT NULL,
  kode_hash TEXT NOT NULL,              -- SHA-256(wa:kode) — kode tidak disimpan polos
  tujuan TEXT NOT NULL CHECK (tujuan IN ('login','pesanan')),
  user_id INTEGER,                      -- untuk tujuan login
  dipakai INTEGER NOT NULL DEFAULT 0,
  percobaan INTEGER NOT NULL DEFAULT 0, -- salah-input, maks 5
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wa_otp_wa ON wa_otp(wa, tujuan);
CREATE INDEX IF NOT EXISTS idx_wa_otp_exp ON wa_otp(expires_at);

-- ---------- Template pesan yang bisa diedit owner/admin ----------
CREATE TABLE IF NOT EXISTS wa_template (
  kode TEXT PRIMARY KEY,                -- pesanan_baru | pesanan_status | ...
  nama TEXT NOT NULL,
  isi TEXT NOT NULL,                    -- pakai placeholder {nama}, {kode}, {total}, dst
  aktif INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Pesan masuk dari webhook OpenWA ----------
CREATE TABLE IF NOT EXISTS wa_masuk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE,               -- anti-dobel (idempotency)
  pengirim TEXT NOT NULL,
  nama_pengirim TEXT DEFAULT '',
  isi TEXT DEFAULT '',
  tipe TEXT DEFAULT 'chat',
  dibalas INTEGER NOT NULL DEFAULT 0,
  balasan TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wa_masuk_pengirim ON wa_masuk(pengirim);
CREATE INDEX IF NOT EXISTS idx_wa_masuk_created ON wa_masuk(created_at);

-- ---------- Pengaturan default OpenWA ----------
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('openwa_url', ''),                        -- contoh: http://127.0.0.1:2785
  ('openwa_session', ''),                    -- sessionId di OpenWA
  ('openwa_aktif', '0'),                     -- 1 = notifikasi WA hidup
  ('openwa_otp_login', '0'),                 -- 1 = login pengelola via OTP WA
  ('openwa_otp_pesanan', '0'),               -- 1 = pesanan online wajib verifikasi OTP
  ('openwa_autoreply', '1'),                 -- 1 = auto-balas cek pesanan via WA
  ('openwa_notif_pesanan', '1'),             -- kabari pelanggan saat pesanan masuk
  ('openwa_notif_status', '1'),              -- kabari pelanggan saat status pesanan berubah
  ('openwa_notif_nota', '1'),                -- kirim nota saat pesanan selesai
  ('openwa_notif_piutang', '1'),             -- pengingat piutang jatuh tempo
  ('openwa_notif_gaji', '1'),                -- slip gaji ke karyawan
  ('openwa_notif_internal', '1'),            -- kabari owner/admin saat ada PO web baru
  ('openwa_pengingat_terakhir', ''),         -- tanggal pengingat harian terakhir (lazy-cron)
  ('openwa_jam_pengingat', '8');             -- jam WIB pengingat harian dikirim

-- ---------- Template bawaan (placeholder {xxx} diisi otomatis oleh aplikasi) ----------
INSERT OR IGNORE INTO wa_template (kode, nama, isi) VALUES
  ('otp_login', 'OTP Login Pengelola', '*{situs}* — Kode Masuk

Kode OTP Anda: *{kode}*
Berlaku {menit} menit.

Jangan bagikan kode ini ke siapa pun.'),
  ('otp_pesanan', 'OTP Verifikasi Pemesan', '*{situs}*

Kode verifikasi pesanan Anda: *{kode}*
Berlaku {menit} menit.

Masukkan kode ini di halaman pemesanan untuk melanjutkan.'),
  ('pesanan_baru', 'Pesanan Diterima', 'Terima kasih *{nama}*! 🍄

Pesanan Anda sudah kami terima:
*{kode}*
{rincian}

Total: *{total}*
Rencana kirim: {tanggal_kirim}

Kami akan mengabari saat pesanan diproses.
_{situs}_'),
  ('pesanan_status', 'Perubahan Status Pesanan', 'Halo *{nama}*,

Pesanan *{kode}* kini berstatus: *{status}*
{catatan_status}

Total: {total}
_{situs}_'),
  ('nota', 'Nota Pesanan Selesai', '*NOTA {kode}*
{situs}

Pelanggan: {nama}
Tanggal: {tanggal}
{rincian}

*TOTAL: {total}*
Pembayaran: {status_bayar}{info_tempo}

Terima kasih sudah berbelanja! 🙏'),
  ('piutang', 'Pengingat Piutang', 'Halo *{nama}*, 🙏

Pengingat pembayaran:
Tagihan: {total}
Sudah dibayar: {terbayar}
*Sisa: {sisa}*
Jatuh tempo: {jatuh_tempo} ({keterangan_tempo})

Mohon konfirmasi bila sudah ditransfer. Terima kasih!
_{situs}_'),
  ('cicilan', 'Konfirmasi Pembayaran Cicilan', 'Terima kasih *{nama}* 🙏

Pembayaran diterima: *{jumlah}*
Sisa piutang: *{sisa}*
{lunas_info}

_{situs}_'),
  ('gaji', 'Slip Gaji Karyawan', '*SLIP GAJI {periode}*
{situs}

Nama: {nama}
Hari hadir: {hari_hadir} hari
Upah harian: {upah_harian}
Gaji pokok: {pokok}
Bonus: {bonus}
Potongan: {potongan}

*DITERIMA: {total}*

Terima kasih atas kerja kerasnya! 💪'),
  ('internal_po', 'Notifikasi Internal PO Web', '🔔 *PESANAN WEB BARU*

{kode} — {nama} ({wa})
{rincian}
Total: *{total}*
Catatan: {catatan}

Buka dashboard untuk memproses.'),
  ('autoreply', 'Balasan Otomatis', 'Halo! 🍄 Terima kasih sudah menghubungi *{situs}*.

Balas dengan:
• *CEK <kode pesanan>* — cek status pesanan (contoh: CEK PO-2026-01-001)
• *HARGA* — daftar harga produk
• *JAM* — jam operasional

Atau tunggu balasan dari tim kami. 🙏');
