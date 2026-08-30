-- ============================================================
--  Fase 8 — Checkout pelanggan + Pembayaran (Cash / QRIS)
--  + Payment gateway universal (provider bisa diganti owner)
--  + Fitur pendukung berbasis OTP WhatsApp (lacak pesanan,
--    konfirmasi terima barang)
-- ============================================================

-- ---------- 1. Kolom tambahan di tabel pesanan ----------
-- Checkout menyimpan metode bayar, alamat kirim, ongkir, dan token
-- lacak (agar pelanggan bisa memantau pesanan tanpa perlu akun).
ALTER TABLE pesanan ADD COLUMN metode_bayar TEXT DEFAULT '';
ALTER TABLE pesanan ADD COLUMN status_bayar TEXT DEFAULT 'belum';
ALTER TABLE pesanan ADD COLUMN alamat_kirim TEXT DEFAULT '';
ALTER TABLE pesanan ADD COLUMN ongkir INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pesanan ADD COLUMN biaya_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pesanan ADD COLUMN total_bayar INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pesanan ADD COLUMN token_lacak TEXT DEFAULT '';
ALTER TABLE pesanan ADD COLUMN dibayar_at DATETIME;
ALTER TABLE pesanan ADD COLUMN diterima_at DATETIME;
ALTER TABLE pesanan ADD COLUMN diterima_oleh TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pesanan_token_lacak ON pesanan(token_lacak);
CREATE INDEX IF NOT EXISTS idx_pesanan_status_bayar ON pesanan(status_bayar);

-- ---------- 2. Transaksi pembayaran ----------
-- Satu pesanan bisa punya beberapa upaya bayar (mis. QRIS kedaluwarsa
-- lalu dibuat ulang). Baris terakhir yang berstatus 'dibayar' = sah.
CREATE TABLE IF NOT EXISTS pembayaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  pesanan_id INTEGER NOT NULL,
  metode TEXT NOT NULL CHECK (metode IN ('cash','qris','transfer')),
  provider TEXT NOT NULL DEFAULT 'manual',
  jumlah INTEGER NOT NULL,
  biaya_admin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu','dibayar','kedaluwarsa','gagal','batal')),
  ref_id TEXT DEFAULT '',
  qr_string TEXT DEFAULT '',
  qr_url TEXT DEFAULT '',
  bayar_url TEXT DEFAULT '',
  instruksi TEXT DEFAULT '',
  catatan TEXT DEFAULT '',
  expires_at DATETIME,
  dibayar_at DATETIME,
  diverifikasi_oleh INTEGER,
  respons TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pesanan_id) REFERENCES pesanan(id),
  FOREIGN KEY (diverifikasi_oleh) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pembayaran_pesanan ON pembayaran(pesanan_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_status ON pembayaran(status);
CREATE INDEX IF NOT EXISTS idx_pembayaran_ref ON pembayaran(ref_id);

-- ---------- 3. Log callback gateway ----------
-- Semua notifikasi masuk dari payment gateway dicatat mentah untuk
-- audit + idempotency (callback yang sama tidak diproses dua kali).
CREATE TABLE IF NOT EXISTS pembayaran_callback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT '',
  ref_id TEXT DEFAULT '',
  sidik TEXT UNIQUE,
  status_kirim TEXT DEFAULT '',
  tanda_tangan_sah INTEGER NOT NULL DEFAULT 0,
  diproses INTEGER NOT NULL DEFAULT 0,
  hasil TEXT DEFAULT '',
  isi TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pembayaran_callback_ref ON pembayaran_callback(ref_id);

-- ---------- 3b. Perluas tujuan OTP ----------
-- SQLite tidak bisa mengubah CHECK constraint, jadi tabel dibuat ulang
-- dengan tujuan tambahan: 'lacak' (lacak pesanan) & 'terima' (konfirmasi
-- barang diterima). Data OTP lama tidak perlu dipertahankan (berumur menit).
DROP TABLE IF EXISTS wa_otp;
CREATE TABLE wa_otp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa TEXT NOT NULL,
  kode_hash TEXT NOT NULL,
  tujuan TEXT NOT NULL CHECK (tujuan IN ('login','pesanan','lacak','terima')),
  user_id INTEGER,
  dipakai INTEGER NOT NULL DEFAULT 0,
  percobaan INTEGER NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wa_otp_wa ON wa_otp(wa, tujuan);

-- ---------- 4. Pengaturan pembayaran (diatur owner) ----------
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('bayar_aktif', '1'),
  ('bayar_cash', '1'),
  ('bayar_qris', '1'),
  ('bayar_provider', 'manual'),
  ('bayar_mode', 'sandbox'),
  ('bayar_merchant_kode', ''),
  ('bayar_channel', 'qris'),
  ('bayar_qris_gambar', ''),
  ('bayar_qris_nama', ''),
  ('bayar_kedaluwarsa_menit', '60'),
  ('bayar_biaya_mode', 'serap'),
  ('bayar_biaya_persen', '0.7'),
  ('bayar_biaya_tetap', '0'),
  ('bayar_min_qris', '10000'),
  ('bayar_maks_qris', '5000000'),
  ('bayar_ongkir', '0'),
  ('bayar_ongkir_gratis_min', '0'),
  ('bayar_notif_menunggu', '1'),
  ('bayar_notif_lunas', '1'),
  ('bayar_notif_internal', '1'),
  ('bayar_instruksi_cash', 'Bayar tunai saat barang diterima (COD) atau saat mengambil di kumbung.'),
  ('lacak_aktif', '1'),
  ('lacak_otp', '1'),
  ('terima_otp', '1');

-- ---------- 5. Template pesan WhatsApp baru ----------
INSERT OR IGNORE INTO wa_template (kode, nama, isi, aktif) VALUES
  ('bayar_menunggu', 'Menunggu Pembayaran QRIS',
'*{situs}*
Menunggu Pembayaran 💳

Pesanan: *{kode}*
Total bayar: *{total}*
Metode: QRIS

{rincian}

Silakan scan QRIS pada halaman pembayaran:
{link}

Batas waktu: {batas}
Pesanan otomatis dibatalkan bila lewat batas.', 1),

  ('bayar_lunas', 'Pembayaran Diterima',
'*{situs}*
Pembayaran Diterima ✅

Pesanan: *{kode}*
Dibayar: *{total}*
Metode: {metode}
Waktu: {waktu}

{rincian}

Terima kasih! Pesanan Anda segera kami proses. 🍄
Lacak pesanan: {link}', 1),

  ('bayar_kedaluwarsa', 'Pembayaran Kedaluwarsa',
'*{situs}*
Pembayaran Kedaluwarsa ⏰

Pesanan *{kode}* sebesar {total} belum dibayar sampai batas waktu, jadi kami batalkan otomatis.

Masih ingin pesan? Balas pesan ini atau pesan lagi di website. Terima kasih!', 1),

  ('bayar_internal', 'Kabar Pembayaran (Internal)',
'*{situs}* — Kas Masuk 💰

Pesanan: *{kode}*
Pelanggan: {nama}
Metode: {metode}
Jumlah: *{total}*
Waktu: {waktu}

Silakan cek dashboard.', 1),

  ('lacak_otp', 'Kode Lacak Pesanan',
'*{situs}*
Kode lacak pesanan Anda: *{kode_otp}*

Berlaku {menit} menit. Jangan bagikan kode ini ke siapa pun.', 1),

  ('terima_otp', 'Kode Konfirmasi Terima Barang',
'*{situs}*
Kode konfirmasi penerimaan pesanan *{kode}*: *{kode_otp}*

Berikan kode ini ke kurir kami saat barang diterima. Berlaku {menit} menit.', 1),

  ('terima_selesai', 'Barang Diterima',
'*{situs}*
Pesanan Diterima 📦

Pesanan *{kode}* sudah dikonfirmasi diterima pada {waktu}.

Terima kasih sudah berbelanja! Kalau ada keluhan, balas pesan ini ya.', 1);
