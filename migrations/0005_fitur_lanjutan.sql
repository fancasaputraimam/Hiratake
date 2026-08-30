-- ===== Fase 4: Fitur Lanjutan =====

-- 1. Pembayaran piutang bertahap (cicilan)
CREATE TABLE IF NOT EXISTS pembayaran_piutang (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  penjualan_id INTEGER NOT NULL,
  tanggal DATE NOT NULL,
  jumlah INTEGER NOT NULL,
  catatan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penjualan_id) REFERENCES penjualan(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bayar_penjualan ON pembayaran_piutang(penjualan_id);

-- 2. Catatan percobaan login (rate limit anti brute-force)
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  sukses INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(username, created_at);

-- 3. Log aktivitas (audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  nama TEXT,
  aksi TEXT NOT NULL,          -- tambah / ubah / hapus / login / bayar
  entitas TEXT NOT NULL,       -- panen / penjualan / produk / dll
  entitas_id TEXT,
  detail TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON audit_log(created_at);

-- 4. Pesanan dari web publik (form landing)
ALTER TABLE pesanan ADD COLUMN sumber TEXT NOT NULL DEFAULT 'admin';

-- 5. Target produksi bulanan (progress di dashboard)
INSERT OR IGNORE INTO pengaturan (key, value) VALUES ('target_kg_bulanan', '0');
