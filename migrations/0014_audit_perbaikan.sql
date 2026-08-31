-- ============================================================
-- Fase 14 — Perbaikan hasil audit menyeluruh
--  1. Dedup baris keuangan otomatis (ongkir/biaya/penyusutan/baglog)
--     supaya proses ulang / callback dobel tidak menggandakan angka.
--  2. IP pada login_attempts → rate-limit login per-IP (bukan per-username),
--     mencegah penyerang mengunci akun orang lain.
-- ============================================================

-- 1a. Buang duplikat yang mungkin sudah terlanjur tercatat (sisakan id terkecil).
DELETE FROM pengeluaran
WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != ''
  AND id NOT IN (
    SELECT MIN(id) FROM pengeluaran
    WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != ''
    GROUP BY sumber, no_bukti
  );

DELETE FROM pemasukan_lain
WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != ''
  AND id NOT IN (
    SELECT MIN(id) FROM pemasukan_lain
    WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != ''
    GROUP BY sumber, no_bukti
  );

-- 1b. Satu 'no_bukti' per 'sumber' otomatis hanya boleh ada sekali.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_pengeluaran_auto
  ON pengeluaran(sumber, no_bukti)
  WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != '';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_pemasukan_lain_auto
  ON pemasukan_lain(sumber, no_bukti)
  WHERE sumber LIKE 'auto:%' AND COALESCE(no_bukti,'') != '';

-- 2. Rate-limit login per-IP.
ALTER TABLE login_attempts ADD COLUMN ip TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at);
