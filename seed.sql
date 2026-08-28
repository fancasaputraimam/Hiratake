-- Akun default (password: owner123, admin123, karyawan123)
INSERT OR IGNORE INTO users (username, password_hash, nama, role) VALUES
  ('owner', 'hrtk1$5c86bc93b85c77877e318917a1d9dc59e3eaa619b6568e383cab9e812c1d55a2', 'Pemilik Hiratake', 'owner'),
  ('admin', 'hrtk2$0d1c6ffc0cb083778963401c5f55404686fdb2ff18c1676b7b786456617d41a9', 'Admin Hiratake', 'admin'),
  ('karyawan', 'hrtk3$ef9e10d6088663518808eaa4190bb57974211ced3bdae90205e90ebfffcdd12f', 'Karyawan Kumbung', 'karyawan');

-- Produk awal
INSERT OR IGNORE INTO produk (id, nama, jp, harga, satuan, deskripsi, ikon, badge) VALUES
  (1, 'Jamur Tiram Segar 250g', '新鮮ヒラタケ', 8000, 'pack', 'Kemasan praktis untuk masakan rumahan sehari-hari.', 'fa-seedling', 'Terlaris'),
  (2, 'Jamur Tiram Segar 500g', '新鮮ヒラタケ', 15000, 'pack', 'Ukuran keluarga, cocok untuk tumisan dan sup.', 'fa-basket-shopping', NULL),
  (3, 'Jamur Tiram Segar 1kg', '新鮮ヒラタケ', 28000, 'kg', 'Hemat untuk warung makan dan katering.', 'fa-box', 'Hemat'),
  (4, 'Jamur Crispy 100g', 'カリカリきのこ', 12000, 'pouch', 'Camilan jamur tiram goreng krispi gurih renyah.', 'fa-cookie-bite', 'Baru'),
  (5, 'Baglog Siap Panen', '菌床ブロック', 20000, 'baglog', 'Media tanam siap panen, cocok untuk edukasi & hobi.', 'fa-cubes', NULL),
  (6, 'Paket Grosir 10kg+', '卸売パック', 250000, 'paket', 'Harga khusus mitra restoran & reseller, pasokan rutin.', 'fa-handshake', 'Mitra');

-- Contoh data panen
INSERT OR IGNORE INTO panen (id, tanggal, jumlah_kg, catatan, user_id) VALUES
  (1, date('now', '-2 days'), 24.5, 'Panen pagi normal', 3),
  (2, date('now', '-1 days'), 26.0, 'Kualitas bagus', 3),
  (3, date('now'), 23.8, 'Panen pagi', 3);

-- Contoh data penjualan
INSERT OR IGNORE INTO penjualan (id, tanggal, produk_id, nama_produk, jumlah, total, pembeli, user_id) VALUES
  (1, date('now', '-1 days'), 3, 'Jamur Tiram Segar 1kg', 10, 280000, 'Warung Bu Sari', 2),
  (2, date('now', '-1 days'), 1, 'Jamur Tiram Segar 250g', 15, 120000, 'Pelanggan eceran', 2),
  (3, date('now'), 6, 'Paket Grosir 10kg+', 1, 250000, 'Resto Sakura', 2);
