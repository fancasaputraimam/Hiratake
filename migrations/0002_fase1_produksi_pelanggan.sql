-- ===== FASE 1: Batch Baglog, Panen Detail, Pelanggan & Piutang, Pengaturan Web =====

-- Batch baglog (hulu produksi)
CREATE TABLE IF NOT EXISTS baglog_batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,               -- BG-2026-08-001
  tanggal DATE NOT NULL,                   -- tanggal produksi/beli
  jumlah INTEGER NOT NULL,                 -- jumlah baglog awal
  sumber TEXT NOT NULL DEFAULT 'produksi sendiri', -- 'produksi sendiri' / nama supplier
  biaya_per_baglog INTEGER NOT NULL DEFAULT 0,
  lokasi TEXT DEFAULT '',                  -- kumbung/rak
  tanggal_masuk_kumbung DATE,
  status TEXT NOT NULL DEFAULT 'inkubasi' CHECK (status IN ('inkubasi','produktif','afkir')),
  tanggal_afkir DATE,
  catatan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Kejadian pada batch: kontaminasi / rusak / afkir sebagian
CREATE TABLE IF NOT EXISTS baglog_kejadian (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('kontaminasi','rusak','afkir')),
  jumlah INTEGER NOT NULL,
  catatan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES baglog_batch(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Upgrade panen: link ke batch + grade + susut
ALTER TABLE panen ADD COLUMN batch_id INTEGER REFERENCES baglog_batch(id);
ALTER TABLE panen ADD COLUMN grade_a REAL NOT NULL DEFAULT 0;
ALTER TABLE panen ADD COLUMN grade_b REAL NOT NULL DEFAULT 0;
ALTER TABLE panen ADD COLUMN grade_c REAL NOT NULL DEFAULT 0;
ALTER TABLE panen ADD COLUMN susut_kg REAL NOT NULL DEFAULT 0;

-- Pelanggan
CREATE TABLE IF NOT EXISTS pelanggan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL DEFAULT 'eceran' CHECK (tipe IN ('eceran','warung','resto','reseller')),
  wa TEXT DEFAULT '',
  alamat TEXT DEFAULT '',
  catatan TEXT DEFAULT '',
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Upgrade penjualan: link pelanggan + status bayar (piutang)
ALTER TABLE penjualan ADD COLUMN pelanggan_id INTEGER REFERENCES pelanggan(id);
ALTER TABLE penjualan ADD COLUMN status_bayar TEXT NOT NULL DEFAULT 'lunas' CHECK (status_bayar IN ('lunas','tempo'));
ALTER TABLE penjualan ADD COLUMN jatuh_tempo DATE;
ALTER TABLE penjualan ADD COLUMN tanggal_lunas DATE;

-- Pengaturan website (satu sumber data untuk halaman depan)
CREATE TABLE IF NOT EXISTS pengaturan (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Index
CREATE INDEX IF NOT EXISTS idx_baglog_status ON baglog_batch(status);
CREATE INDEX IF NOT EXISTS idx_kejadian_batch ON baglog_kejadian(batch_id);
CREATE INDEX IF NOT EXISTS idx_panen_batch ON panen(batch_id);
CREATE INDEX IF NOT EXISTS idx_penjualan_pelanggan ON penjualan(pelanggan_id);
CREATE INDEX IF NOT EXISTS idx_penjualan_status ON penjualan(status_bayar);

-- Nilai awal pengaturan web
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('wa_nomor', '6281234567890'),
  ('alamat', 'Jl. Raya Jamur No. 88, Indonesia'),
  ('jam_operasional', 'Setiap hari, 06.00 – 18.00 WIB'),
  ('instagram', ''),
  ('facebook', ''),
  ('tiktok', '');
