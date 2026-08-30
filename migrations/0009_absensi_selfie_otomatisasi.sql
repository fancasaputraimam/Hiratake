-- Fase 9: Absensi selfie + GPS (anti-kecurangan), foto situs bisa diganti owner, otomatisasi harian

-- Bukti absensi: lokasi, keterlambatan, perangkat
ALTER TABLE absensi ADD COLUMN lat_masuk REAL;
ALTER TABLE absensi ADD COLUMN lng_masuk REAL;
ALTER TABLE absensi ADD COLUMN jarak_masuk_m INTEGER;
ALTER TABLE absensi ADD COLUMN lat_pulang REAL;
ALTER TABLE absensi ADD COLUMN lng_pulang REAL;
ALTER TABLE absensi ADD COLUMN jarak_pulang_m INTEGER;
ALTER TABLE absensi ADD COLUMN terlambat_menit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE absensi ADD COLUMN pulang_cepat_menit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE absensi ADD COLUMN perangkat TEXT DEFAULT '';

-- Foto selfie (dengan watermark) disimpan terpisah agar query rekap tetap ringan
CREATE TABLE IF NOT EXISTS absensi_foto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  absensi_id INTEGER NOT NULL REFERENCES absensi(id),
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk','pulang')),
  foto TEXT NOT NULL,                -- data URL JPEG terkompresi + watermark terbakar di gambar
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(absensi_id, jenis)
);
CREATE INDEX IF NOT EXISTS idx_absensi_foto ON absensi_foto(absensi_id);

-- Media situs: foto landing page yang bisa diganti owner (logo, hero, tentang, galeri1..6)
CREATE TABLE IF NOT EXISTS situs_media (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'image/jpeg',
  data TEXT NOT NULL,                -- base64 murni (tanpa prefix data:)
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pengaturan absensi ketat + otomatisasi (default aktif agar langsung ketat)
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('absen_wajib_selfie', '1'),
  ('absen_wajib_lokasi', '1'),
  ('absen_lat', ''),
  ('absen_lng', ''),
  ('absen_radius_m', '150'),
  ('absen_toleransi_telat', '10'),
  ('absen_auto_alpa', '1'),
  ('openwa_notif_ringkasan', '0'),
  ('otomatis_alpa_terakhir', ''),
  ('otomatis_ringkasan_terakhir', ''),
  ('otomatis_bersih_terakhir', '');
