-- ===== FASE 2: Keuangan (Pengeluaran, Pemasukan Lain, Kas, Laba/Rugi, HPP) =====

-- Pengeluaran per kategori
CREATE TABLE IF NOT EXISTS pengeluaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN (
    'bahan_baku','bibit','gas_sterilisasi','listrik_air','gaji','transport','kemasan','perawatan','lainnya'
  )),
  jumlah INTEGER NOT NULL,
  keterangan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Pemasukan di luar penjualan produk (mis. jual baglog afkir untuk pupuk)
CREATE TABLE IF NOT EXISTS pemasukan_lain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  jumlah INTEGER NOT NULL,
  keterangan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pengeluaran_tanggal ON pengeluaran(tanggal);
CREATE INDEX IF NOT EXISTS idx_pengeluaran_kategori ON pengeluaran(kategori);
CREATE INDEX IF NOT EXISTS idx_pemasukan_lain_tanggal ON pemasukan_lain(tanggal);
