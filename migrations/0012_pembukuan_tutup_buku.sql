-- Fase 12: tambal sisa temuan audit + perbaikan pembukuan/administrasi
-- ============================================================

-- 1. TEMUAN SISA #1: pesanan.status_bayar tanpa CHECK constraint.
-- SQLite tidak bisa ALTER ADD CHECK, jadi ditegakkan lewat trigger.
DROP TRIGGER IF EXISTS trg_pesanan_status_bayar_ins;
CREATE TRIGGER trg_pesanan_status_bayar_ins
BEFORE INSERT ON pesanan
FOR EACH ROW WHEN NEW.status_bayar NOT IN
  ('belum','menunggu','lunas','tempo','gagal','kedaluwarsa','batal')
BEGIN
  SELECT RAISE(ABORT, 'status_bayar tidak valid');
END;

DROP TRIGGER IF EXISTS trg_pesanan_status_bayar_upd;
CREATE TRIGGER trg_pesanan_status_bayar_upd
BEFORE UPDATE OF status_bayar ON pesanan
FOR EACH ROW WHEN NEW.status_bayar NOT IN
  ('belum','menunggu','lunas','tempo','gagal','kedaluwarsa','batal')
BEGIN
  SELECT RAISE(ABORT, 'status_bayar tidak valid');
END;

-- Rapikan nilai liar yang mungkin sudah masuk sebelum trigger ada
UPDATE pesanan SET status_bayar = 'belum'
WHERE status_bayar IS NULL OR status_bayar NOT IN
  ('belum','menunggu','lunas','tempo','gagal','kedaluwarsa','batal');

-- 2. TEMUAN SISA #3: penjualan tidak tertaut ke pesanan.
-- Tanpa ini, hapus penjualan meninggalkan pesanan.penjualan_dibuat=1 (terkunci selamanya).
ALTER TABLE penjualan ADD COLUMN pesanan_id INTEGER REFERENCES pesanan(id);
CREATE INDEX IF NOT EXISTS idx_penjualan_pesanan ON penjualan(pesanan_id);

-- Backfill: cocokkan penjualan lama ke pesanan lewat pelanggan + tanggal + produk
UPDATE penjualan SET pesanan_id = (
  SELECT ps.id FROM pesanan ps
  WHERE ps.penjualan_dibuat = 1
    AND ps.pelanggan_id = penjualan.pelanggan_id
    AND ps.tanggal_pesan = penjualan.tanggal
  LIMIT 1
) WHERE pesanan_id IS NULL AND pelanggan_id IS NOT NULL;

-- 3. PEMBUKUAN: nomor bukti + kategori pemasukan lain
ALTER TABLE pengeluaran ADD COLUMN no_bukti TEXT NOT NULL DEFAULT '';
ALTER TABLE pengeluaran ADD COLUMN sumber TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE pemasukan_lain ADD COLUMN no_bukti TEXT NOT NULL DEFAULT '';
ALTER TABLE pemasukan_lain ADD COLUMN sumber TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE pemasukan_lain ADD COLUMN kategori TEXT NOT NULL DEFAULT 'lainnya';

-- Tandai baris yang dibuat otomatis oleh sistem agar tidak dianggap input manual
UPDATE pemasukan_lain SET sumber = 'auto:ongkir', kategori = 'ongkir'
WHERE keterangan LIKE 'Ongkir pesanan%';
UPDATE pemasukan_lain SET sumber = 'auto:biaya_admin', kategori = 'biaya_admin'
WHERE keterangan LIKE 'Biaya admin dibayar pelanggan%';
UPDATE pengeluaran SET sumber = 'auto:gateway'
WHERE keterangan LIKE 'Biaya payment gateway%';
UPDATE pengeluaran SET sumber = 'auto:gaji'
WHERE kategori = 'gaji' AND keterangan LIKE 'Gaji %periode%';

CREATE INDEX IF NOT EXISTS idx_pengeluaran_bulan ON pengeluaran(tanggal, kategori);
CREATE INDEX IF NOT EXISTS idx_pemasukan_bulan ON pemasukan_lain(tanggal, kategori);

-- 4. PEMBUKUAN: tutup buku bulanan (periode terkunci, laporan tidak berubah lagi)
CREATE TABLE IF NOT EXISTS buku_tutup (
  periode TEXT PRIMARY KEY,              -- YYYY-MM
  ditutup_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ditutup_oleh INTEGER REFERENCES users(id),
  otomatis INTEGER NOT NULL DEFAULT 0,
  omzet INTEGER NOT NULL DEFAULT 0,
  pemasukan_lain INTEGER NOT NULL DEFAULT 0,
  pengeluaran INTEGER NOT NULL DEFAULT 0,
  laba INTEGER NOT NULL DEFAULT 0,
  kas_masuk INTEGER NOT NULL DEFAULT 0,
  piutang_akhir INTEGER NOT NULL DEFAULT 0,
  panen_kg REAL NOT NULL DEFAULT 0,
  hpp_per_kg INTEGER NOT NULL DEFAULT 0,
  catatan TEXT DEFAULT ''
);

-- 5. Sakelar otomatisasi pembukuan
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('otomatis_tutup_buku', '1'),
  ('otomatis_tutup_tanggal', '5'),
  ('otomatis_tutup_terakhir', ''),
  ('otomatis_baglog_biaya', '1'),
  ('otomatis_rekap_bulanan', '1'),
  ('otomatis_rekap_terakhir', ''),
  ('otomatis_rekon_kas', '1');
