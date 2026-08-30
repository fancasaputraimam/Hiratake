-- ============================================================
--  FASE 11: Perbaikan Hasil Audit + Otomatisasi Penuh
--
--  1. produk.urutan          → kolom hilang, dipakai query landing (BUG FATAL)
--  2. pengaturan otomatis_*  → sakelar otomatisasi baru
--  3. hari_libur             → kalender libur agar auto-alpa tidak salah
--  4. index pendukung        → kode pesanan & sapu pesanan
-- ============================================================

-- ---------- 1. BUG FATAL: kolom urutan produk ----------
-- src/index.tsx memakai "ORDER BY urutan, id" untuk JSON-LD produk,
-- tapi kolomnya tidak pernah dibuat → query gagal → daftar produk SEO kosong.
ALTER TABLE produk ADD COLUMN urutan INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_produk_urutan ON produk(aktif, urutan, id);

-- Beri urutan awal mengikuti id supaya tampilan tidak berubah.
UPDATE produk SET urutan = id WHERE urutan = 0;

-- ---------- 2. Kalender hari libur (auto-alpa) ----------
-- Tanpa ini auto-alpa menandai "alpa" pada hari libur nasional.
CREATE TABLE IF NOT EXISTS hari_libur (
  tanggal DATE PRIMARY KEY,
  keterangan TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 3. Index pendukung ----------
CREATE INDEX IF NOT EXISTS idx_pesanan_kode ON pesanan(kode);
CREATE INDEX IF NOT EXISTS idx_pesanan_sapu ON pesanan(status, status_bayar, tanggal_pesan);
CREATE INDEX IF NOT EXISTS idx_pesanan_penjualan_dibuat ON pesanan(penjualan_dibuat, status_bayar);

-- ---------- 4. Sakelar otomatisasi ----------
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  -- Buat baris penjualan otomatis begitu pembayaran online lunas
  ('otomatis_jual_lunas', '1'),
  -- Catat ongkir & biaya admin ke pemasukan lain (agar uang masuk tidak bocor)
  ('otomatis_catat_ongkir', '1'),
  -- Sapu pesanan yang mandek (batalkan bila belum dibayar melebihi batas)
  ('otomatis_sapu_pesanan', '1'),
  ('otomatis_sapu_hari', '3'),
  -- Ingatkan owner untuk pesanan yang sudah dibayar tapi belum diproses
  ('otomatis_ingat_pesanan', '1'),
  ('otomatis_ingat_jam', '6'),
  -- Kunci "sudah jalan" untuk tugas baru
  ('otomatis_sapu_terakhir', ''),
  ('otomatis_ingat_terakhir', ''),
  -- Denyut terakhir otomatisasi (untuk panel monitor di dashboard)
  ('otomatis_denyut_terakhir', ''),
  ('otomatis_denyut_sumber', '');
