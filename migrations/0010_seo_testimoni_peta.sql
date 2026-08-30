-- Fase 10: SEO, share preview (Open Graph), testimoni pelanggan, peta lokasi

-- Testimoni pelanggan (bukti sosial di landing page, dikelola dari dashboard)
CREATE TABLE IF NOT EXISTS testimoni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  asal TEXT DEFAULT '',                      -- mis. "Warung Bu Sri, Sleman"
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  isi TEXT NOT NULL,
  tampil INTEGER NOT NULL DEFAULT 1,         -- 1 = tampil di landing
  urutan INTEGER NOT NULL DEFAULT 0,
  pelanggan_id INTEGER REFERENCES pelanggan(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_testimoni_tampil ON testimoni(tampil, urutan);

-- Pengaturan baru: peta lokasi kumbung + versi gambar share
INSERT OR IGNORE INTO pengaturan (key, value) VALUES
  ('peta_lat', ''),          -- latitude kumbung (kosong = peta tidak ditampilkan)
  ('peta_lng', ''),          -- longitude kumbung
  ('peta_zoom', '16'),       -- tingkat zoom peta (3-20)
  ('og_versi', '1');         -- dinaikkan tiap gambar share diganti (paksa refresh cache WhatsApp)
