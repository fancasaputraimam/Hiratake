-- Fase 6: Absensi jam kerja, penggajian karyawan, pengaturan situs (owner)

-- Upah per user (owner atur di tab Pengguna/Gaji)
ALTER TABLE users ADD COLUMN upah_harian INTEGER NOT NULL DEFAULT 0;

-- Absensi: satu baris per user per hari
CREATE TABLE IF NOT EXISTS absensi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tanggal DATE NOT NULL,
  jam_masuk TEXT,                -- HH:MM
  jam_pulang TEXT,               -- HH:MM
  status TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','izin','sakit','libur','alpa')),
  catatan TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_user ON absensi(user_id, tanggal);

-- Penggajian: rekap per user per periode (bulan)
CREATE TABLE IF NOT EXISTS gaji (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  periode TEXT NOT NULL,               -- YYYY-MM
  hari_hadir INTEGER NOT NULL DEFAULT 0,
  upah_harian INTEGER NOT NULL DEFAULT 0,  -- snapshot upah saat dibayar
  bonus INTEGER NOT NULL DEFAULT 0,
  potongan INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  tanggal_bayar DATE,
  catatan TEXT DEFAULT '',
  pengeluaran_id INTEGER REFERENCES pengeluaran(id),  -- link ke catatan keuangan
  dibayar_oleh INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, periode)
);

-- Pengaturan identitas situs (owner) — kunci baru di tabel pengaturan
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('situs_nama', 'Hiratake'),
  ('situs_nama_jp', '平茸'),
  ('situs_tagline', 'Jamur Tiram Segar Berkualitas'),
  ('situs_deskripsi', 'Budidaya jamur tiram segar, higienis, dan berkualitas dari kumbung kami langsung ke dapur Anda.'),
  ('situs_warna', '#C73E3A'),
  ('situs_pesanan_online', '1'),
  ('jam_kerja_masuk', '07:00'),
  ('jam_kerja_pulang', '16:00');
