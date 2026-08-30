-- Tabel pengguna (owner, admin, karyawan)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'karyawan')),
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel sesi login
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabel produk
CREATE TABLE IF NOT EXISTS produk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  jp TEXT DEFAULT '',
  harga INTEGER NOT NULL,
  satuan TEXT NOT NULL,
  deskripsi TEXT DEFAULT '',
  ikon TEXT DEFAULT 'fa-seedling',
  badge TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel catatan panen harian
CREATE TABLE IF NOT EXISTS panen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  jumlah_kg REAL NOT NULL,
  catatan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabel penjualan
CREATE TABLE IF NOT EXISTS penjualan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  produk_id INTEGER,
  nama_produk TEXT NOT NULL,
  jumlah INTEGER NOT NULL,
  total INTEGER NOT NULL,
  pembeli TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produk_id) REFERENCES produk(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_panen_tanggal ON panen(tanggal);
CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal ON penjualan(tanggal);
