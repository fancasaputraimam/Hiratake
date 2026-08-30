-- Fase 3: Stok harian + rekonsiliasi, Pesanan/PO pelanggan

-- Berat per unit produk (kg) agar penjualan bisa direkonsiliasi dengan panen
ALTER TABLE produk ADD COLUMN berat_kg REAL NOT NULL DEFAULT 0;

-- Berat total transaksi penjualan (kg) — dihitung otomatis dari produk saat transaksi
ALTER TABLE penjualan ADD COLUMN berat_kg REAL NOT NULL DEFAULT 0;

-- Isi berat produk yang sudah ada
UPDATE produk SET berat_kg = 0.25 WHERE nama LIKE '%250g%';
UPDATE produk SET berat_kg = 0.5  WHERE nama LIKE '%500g%';
UPDATE produk SET berat_kg = 1.0  WHERE nama LIKE '%1kg%';
UPDATE produk SET berat_kg = 0    WHERE nama LIKE '%Crispy%';   -- olahan, tidak mengurangi stok segar
UPDATE produk SET berat_kg = 0    WHERE nama LIKE '%Baglog%';   -- bukan jamur segar
UPDATE produk SET berat_kg = 10.0 WHERE nama LIKE '%10kg%';

-- Isi berat_kg transaksi lama dari data produk
UPDATE penjualan SET berat_kg = jumlah * COALESCE((SELECT berat_kg FROM produk WHERE produk.id = penjualan.produk_id), 0);

-- Penyesuaian stok (rusak, bonus, sampel, konsumsi sendiri, koreksi hitung)
CREATE TABLE IF NOT EXISTS stok_penyesuaian (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('rusak','bonus','sampel','konsumsi','koreksi','lainnya')),
  arah TEXT NOT NULL CHECK (arah IN ('keluar','masuk')),
  jumlah_kg REAL NOT NULL,
  keterangan TEXT DEFAULT '',
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stok_penyesuaian_tanggal ON stok_penyesuaian(tanggal);

-- Pesanan / PO pelanggan
CREATE TABLE IF NOT EXISTS pesanan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  pelanggan_id INTEGER NOT NULL,
  tanggal_pesan DATE NOT NULL,
  tanggal_kirim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','diproses','siap','selesai','batal')),
  catatan TEXT DEFAULT '',
  penjualan_dibuat INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan(status);
CREATE INDEX IF NOT EXISTS idx_pesanan_tanggal_kirim ON pesanan(tanggal_kirim);

CREATE TABLE IF NOT EXISTS pesanan_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pesanan_id INTEGER NOT NULL,
  produk_id INTEGER NOT NULL,
  nama_produk TEXT NOT NULL,
  jumlah INTEGER NOT NULL,
  harga INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  FOREIGN KEY (pesanan_id) REFERENCES pesanan(id),
  FOREIGN KEY (produk_id) REFERENCES produk(id)
);
CREATE INDEX IF NOT EXISTS idx_pesanan_item_pesanan ON pesanan_item(pesanan_id);
