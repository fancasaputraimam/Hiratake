-- ============================================================
--  FASE 13 — Kas Opname, Aset Tetap & Penyusutan, Ekspor Buku
--  Menjawab rekomendasi audit pembukuan #1, #3, #5.
-- ============================================================

-- ------------------------------------------------------------
--  1. KAS OPNAME HARIAN
--  Masalah: rekonsiliasi kas hanya bisa membandingkan angka DI DALAM
--  sistem. Kalau uang tunai diterima karyawan lalu tidak dicatat,
--  sistem tidak punya cara tahu. Opname = hitung uang fisik, lalu
--  bandingkan dengan saldo yang seharusnya menurut sistem.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kas_opname (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL UNIQUE,
  saldo_sistem INTEGER NOT NULL DEFAULT 0,   -- dihitung sistem (kas masuk - kas keluar)
  saldo_fisik INTEGER NOT NULL DEFAULT 0,    -- hasil hitung uang sungguhan
  selisih INTEGER NOT NULL DEFAULT 0,        -- fisik - sistem (minus = uang kurang)
  catatan TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_opname_tanggal ON kas_opname(tanggal DESC);

-- ------------------------------------------------------------
--  2. ASET TETAP + PENYUSUTAN
--  Masalah: beli rak/mesin/kumbung masuk pengeluaran sekaligus,
--  jadi bulan pembelian terlihat rugi besar padahal barangnya
--  dipakai bertahun-tahun. Sekarang dicatat sebagai aset lalu
--  disusutkan tiap bulan (garis lurus).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aset_tetap (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'peralatan'
    CHECK (kategori IN ('bangunan','peralatan','mesin','kendaraan','lainnya')),
  tanggal_beli DATE NOT NULL,
  harga_beli INTEGER NOT NULL DEFAULT 0,
  nilai_residu INTEGER NOT NULL DEFAULT 0,      -- perkiraan nilai jual di akhir umur
  umur_bulan INTEGER NOT NULL DEFAULT 60,       -- 60 bulan = 5 tahun
  status TEXT NOT NULL DEFAULT 'aktif'
    CHECK (status IN ('aktif','lunas_susut','dijual','rusak')),
  catatan TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aset_status ON aset_tetap(status);

-- Riwayat penyusutan per bulan; UNIQUE mencegah dobel hitung
CREATE TABLE IF NOT EXISTS aset_penyusutan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aset_id INTEGER NOT NULL REFERENCES aset_tetap(id) ON DELETE CASCADE,
  periode TEXT NOT NULL,                        -- YYYY-MM
  jumlah INTEGER NOT NULL DEFAULT 0,
  pengeluaran_id INTEGER REFERENCES pengeluaran(id),
  otomatis INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(aset_id, periode)
);
CREATE INDEX IF NOT EXISTS idx_susut_periode ON aset_penyusutan(periode);

-- Kategori pengeluaran baru: 'penyusutan'.
-- SQLite tidak bisa mengubah CHECK, jadi tabel dibuat ulang.
CREATE TABLE IF NOT EXISTS pengeluaran_baru (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN (
    'bahan_baku','bibit','gas_sterilisasi','listrik_air','gaji','transport',
    'kemasan','perawatan','penyusutan','lainnya'
  )),
  jumlah INTEGER NOT NULL,
  keterangan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  no_bukti TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL DEFAULT 'manual',
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO pengeluaran_baru (id, tanggal, kategori, jumlah, keterangan, user_id, created_at, no_bukti, sumber)
  SELECT id, tanggal, kategori, jumlah, keterangan, user_id, created_at, no_bukti, sumber FROM pengeluaran;
DROP TABLE pengeluaran;
ALTER TABLE pengeluaran_baru RENAME TO pengeluaran;
CREATE INDEX IF NOT EXISTS idx_pengeluaran_tanggal ON pengeluaran(tanggal);
CREATE INDEX IF NOT EXISTS idx_pengeluaran_sumber ON pengeluaran(sumber, no_bukti);

-- ------------------------------------------------------------
--  3. RIWAYAT EKSPOR PEMBUKUAN
--  Bukti bahwa pembukuan sudah pernah diarsipkan ke luar sistem.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buku_ekspor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv',
  baris INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  otomatis INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ekspor_periode ON buku_ekspor(periode);

-- ------------------------------------------------------------
--  4. SAKELAR BARU
-- ------------------------------------------------------------
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('otomatis_penyusutan', '1'),
  ('otomatis_penyusutan_terakhir', ''),
  ('otomatis_opname_ingat', '1'),
  ('otomatis_opname_terakhir', ''),
  ('kas_opname_toleransi', '5000');
