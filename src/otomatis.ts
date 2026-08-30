// ===== Fase 9: Otomatisasi Harian (lazy-cron) =====
// Cloudflare hosted deploy tidak mendukung cron trigger, jadi semua tugas
// harian "menempel" pada request pertama tiap hari (dipicu dari dashboard/landing).
// Setiap tugas punya kunci "terakhir dijalankan" agar tidak dobel walau paralel.
import { type OpenWAEnv, cfgVal, getWAConfig, siapKirim, kirimAman, normalWA, hariIniWIB, jamWIB, rupiah } from './openwa'
import { buatPenjualanDariPesanan } from './pesananOtomatis'
import { jalankanPembukuanOtomatis } from './pembukuan'
import { jalankanAsetKasOtomatis } from './asetKas'

async function setCfg(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value).run()
}

/** Kemarin dalam WIB (YYYY-MM-DD). */
function kemarinWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000 - 86400_000).toISOString().slice(0, 10)
}

// ============================================================
// 1. AUTO-ALPA: tandai karyawan yang tidak absen kemarin sebagai 'alpa'
//    (hari kerja saja — kalau tidak absen & tidak izin/sakit/libur = bolos)
// ============================================================
export async function jalankanAutoAlpa(env: OpenWAEnv): Promise<{ dijalankan: boolean; ditandai: number }> {
  const db = env.DB
  if ((await cfgVal(db, 'absen_auto_alpa', '1')) !== '1') return { dijalankan: false, ditandai: 0 }
  const hari = hariIniWIB()
  if ((await cfgVal(db, 'otomatis_alpa_terakhir', '')) === hari) return { dijalankan: false, ditandai: 0 }
  await setCfg(db, 'otomatis_alpa_terakhir', hari) // kunci dulu, anti dobel

  const kemarin = kemarinWIB()
  // Minggu = hari libur default (tidak ditandai alpa)
  const hariMinggu = new Date(kemarin + 'T00:00:00Z').getUTCDay() === 0
  if (hariMinggu) return { dijalankan: true, ditandai: 0 }
  // Hari libur nasional / libur usaha yang didaftarkan owner → jangan alpa.
  // (Tanpa ini karyawan dicap bolos pada hari yang memang tidak kerja.)
  const libur = await db.prepare('SELECT 1 v FROM hari_libur WHERE tanggal = ?')
    .bind(kemarin).first<any>().catch(() => null)
  if (libur) return { dijalankan: true, ditandai: 0 }

  // Karyawan aktif yang TIDAK punya baris absensi kemarin → alpa otomatis.
  // Owner tidak dianggap alpa (pemilik tidak wajib absen).
  const r = await db.prepare(`
    INSERT INTO absensi (user_id, tanggal, status, catatan)
    SELECT u.id, ?, 'alpa', 'Otomatis: tidak absen'
    FROM users u
    WHERE u.aktif = 1 AND u.role != 'owner'
      AND NOT EXISTS (SELECT 1 FROM absensi a WHERE a.user_id = u.id AND a.tanggal = ?)
  `).bind(kemarin, kemarin).run()
  const n = r.meta.changes || 0
  if (n > 0) {
    await db.prepare(
      "INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail) VALUES (NULL, 'SISTEM', 'tambah', 'absensi', '', ?)"
    ).bind(`Auto-alpa ${kemarin}: ${n} karyawan tidak absen`).run().catch(() => {})
  }
  return { dijalankan: true, ditandai: n }
}

// ============================================================
// 2. RINGKASAN HARIAN via WA ke owner (panen, omzet, absensi kemarin)
// ============================================================
export async function jalankanRingkasanHarian(env: OpenWAEnv): Promise<{ dijalankan: boolean }> {
  const db = env.DB
  if ((await cfgVal(db, 'openwa_notif_ringkasan', '0')) !== '1') return { dijalankan: false }
  const cfg = await getWAConfig(env)
  if (!siapKirim(cfg)) return { dijalankan: false }

  const hari = hariIniWIB()
  const ringkasTerakhir = await cfgVal(db, 'otomatis_ringkasan_terakhir', '')
  // Sudah selesai hari ini, atau sedang diproses request lain
  if (ringkasTerakhir === hari || ringkasTerakhir === `proses:${hari}`) return { dijalankan: false }
  const jamTarget = parseInt(await cfgVal(db, 'openwa_jam_pengingat', '8')) || 8
  if (jamWIB() < jamTarget) return { dijalankan: false }
  // Kunci sementara (bukan tanggal) supaya request paralel tidak kirim ganda,
  // TAPI kalau pengiriman gagal, kunci dilepas agar denyut berikutnya mencoba lagi.
  await setCfg(db, 'otomatis_ringkasan_terakhir', `proses:${hari}`)

  const kemarin = kemarinWIB()
  const [panen, jual, keluar, hadir, telat, alpa, poBaru, piutang] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE tanggal=?').bind(kemarin).first<any>(),
    db.prepare('SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM penjualan WHERE tanggal=?').bind(kemarin).first<any>(),
    db.prepare('SELECT COALESCE(SUM(jumlah),0) v FROM pengeluaran WHERE tanggal=?').bind(kemarin).first<any>(),
    db.prepare("SELECT COUNT(*) n FROM absensi WHERE tanggal=? AND status='hadir'").bind(kemarin).first<any>(),
    db.prepare("SELECT COUNT(*) n FROM absensi WHERE tanggal=? AND terlambat_menit > 0").bind(kemarin).first<any>(),
    db.prepare("SELECT COUNT(*) n FROM absensi WHERE tanggal=? AND status='alpa'").bind(kemarin).first<any>(),
    db.prepare("SELECT COUNT(*) n FROM pesanan WHERE status='baru'").first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM penjualan WHERE status_bayar='tempo' AND jatuh_tempo < date('now','+7 hours')").first<any>()
  ])

  const nama = await cfgVal(db, 'situs_nama', 'Hiratake')
  const isi = [
    `🍄 *${nama} — Ringkasan ${kemarin}*`,
    ``,
    `🌾 Panen: *${panen?.v ?? 0} kg*`,
    `💰 Omzet: *${rupiah(jual?.v ?? 0)}* (${jual?.n ?? 0} nota)`,
    `💸 Pengeluaran: ${rupiah(keluar?.v ?? 0)}`,
    `👥 Hadir: ${hadir?.n ?? 0} orang${(telat?.n ?? 0) > 0 ? ` (⏰ telat: ${telat.n})` : ''}${(alpa?.n ?? 0) > 0 ? ` (🚫 alpa: ${alpa.n})` : ''}`,
    (poBaru?.n ?? 0) > 0 ? `📋 Pesanan menunggu diproses: *${poBaru.n}*` : '',
    (piutang?.n ?? 0) > 0 ? `⚠️ Piutang telat: ${piutang.n} nota (${rupiah(piutang.v)})` : '',
    ``,
    `_Pesan otomatis setiap pagi. Atur di Dashboard → WhatsApp._`
  ].filter((x) => x !== '').join('\n')

  // Kirim ke semua owner yang punya nomor WA terdaftar
  const { results: owners } = await db.prepare(
    "SELECT wa FROM users WHERE role='owner' AND aktif=1 AND wa IS NOT NULL AND wa != ''"
  ).all<any>()
  let terkirim = 0
  for (const o of owners as any[]) {
    const h = await kirimAman(env, normalWA(o.wa), isi, { jenis: 'ringkasan', entitas: 'otomatis', entitasId: kemarin })
    if ((h as any)?.ok !== false) terkirim++
  }

  if (terkirim > 0 || (owners as any[]).length === 0) {
    // Sukses (atau memang tidak ada tujuan) → tandai selesai untuk hari ini
    await setCfg(db, 'otomatis_ringkasan_terakhir', hari)
    return { dijalankan: true }
  }
  // Semua pengiriman gagal → lepas kunci supaya dicoba lagi pada denyut berikutnya
  await setCfg(db, 'otomatis_ringkasan_terakhir', '')
  return { dijalankan: false }
}

// ============================================================
// 3. HOUSEKEEPING: bersihkan data usang (sesi, OTP, foto absen lama)
// ============================================================
export async function jalankanBersihBersih(env: OpenWAEnv): Promise<{ dijalankan: boolean }> {
  const db = env.DB
  const hari = hariIniWIB()
  if ((await cfgVal(db, 'otomatis_bersih_terakhir', '')) === hari) return { dijalankan: false }
  await setCfg(db, 'otomatis_bersih_terakhir', hari)

  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    db.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now','-2 days')"),
    db.prepare("DELETE FROM wa_otp WHERE created_at < datetime('now','-1 day')"),
    // Foto selfie disimpan 90 hari (cukup untuk audit gaji), lalu dihapus agar DB ramping
    db.prepare("DELETE FROM absensi_foto WHERE created_at < datetime('now','-90 days')"),
    // Log pesan WA & audit sangat lama dipangkas (tetap simpan 1 tahun)
    db.prepare("DELETE FROM wa_pesan WHERE created_at < datetime('now','-365 days')"),
    db.prepare("DELETE FROM audit_log WHERE created_at < datetime('now','-365 days')")
  ]).catch(() => {})
  return { dijalankan: true }
}

// ============================================================
// 4. SUSUL PENJUALAN: pesanan yang SUDAH LUNAS tapi belum jadi penjualan
//    → dicatat otomatis. Ini jaring pengaman kalau callback gateway
//      sempat gagal atau admin lupa menekan tombol.
// ============================================================
export async function jalankanSusulPenjualan(env: OpenWAEnv): Promise<{ dicatat: number }> {
  const db = env.DB
  if ((await cfgVal(db, 'otomatis_jual_lunas', '1')) !== '1') return { dicatat: 0 }

  // Batasi 10 per denyut agar tidak melewati batas CPU Cloudflare.
  const { results } = await db.prepare(`
    SELECT id FROM pesanan
    WHERE status_bayar = 'lunas'
      AND COALESCE(penjualan_dibuat,0) = 0
      AND status != 'batal'
    ORDER BY id LIMIT 10
  `).all<any>().catch(() => ({ results: [] as any[] }))

  let n = 0
  for (const r of results as any[]) {
    const h = await buatPenjualanDariPesanan(env, r.id, {
      bayar: 'lunas', userId: null, sumber: 'otomatis-susul'
    }).catch(() => null)
    if (h?.ok) n++
  }
  return { dicatat: n }
}

// ============================================================
// 5. SAPU PESANAN MANDEK: pesanan lama yang belum dibayar dibatalkan
//    otomatis agar daftar pesanan & stok tidak "kotor" selamanya.
// ============================================================
export async function jalankanSapuPesanan(env: OpenWAEnv): Promise<{ dibatalkan: number }> {
  const db = env.DB
  if ((await cfgVal(db, 'otomatis_sapu_pesanan', '1')) !== '1') return { dibatalkan: 0 }
  const hari = hariIniWIB()
  if ((await cfgVal(db, 'otomatis_sapu_terakhir', '')) === hari) return { dibatalkan: 0 }
  await setCfg(db, 'otomatis_sapu_terakhir', hari)

  const batas = Math.min(30, Math.max(1, parseInt(await cfgVal(db, 'otomatis_sapu_hari', '3')) || 3))

  // Hanya pesanan web yang benar-benar belum dibayar & belum diproses.
  // Pesanan tunai / pesanan admin TIDAK disapu (bisa jadi masih ditagih).
  const r = await db.prepare(`
    UPDATE pesanan
    SET status = 'batal',
        catatan = catatan || ?
    WHERE status = 'baru'
      AND sumber = 'web'
      AND status_bayar IN ('belum','menunggu','gagal','kedaluwarsa')
      AND COALESCE(penjualan_dibuat,0) = 0
      AND date(tanggal_pesan) < date('now','+7 hours', ?)
  `).bind(` [Dibatalkan otomatis: tidak dibayar >${batas} hari]`, `-${batas} days`).run()
    .catch(() => ({ meta: { changes: 0 } } as any))

  const n = r.meta?.changes || 0
  if (n > 0) {
    await db.prepare(
      "INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail) VALUES (NULL, 'SISTEM', 'ubah', 'pesanan', '', ?)"
    ).bind(`Sapu otomatis: ${n} pesanan tidak dibayar >${batas} hari dibatalkan`).run().catch(() => {})
  }
  return { dibatalkan: n }
}

// ============================================================
// 6. INGATKAN OWNER: pesanan sudah dibayar tapi belum digarap
//    (uang sudah masuk, barang belum jalan = paling berbahaya)
// ============================================================
export async function jalankanIngatPesanan(env: OpenWAEnv): Promise<{ dikirim: number }> {
  const db = env.DB
  if ((await cfgVal(db, 'otomatis_ingat_pesanan', '1')) !== '1') return { dikirim: 0 }
  const cfg = await getWAConfig(env)
  if (!siapKirim(cfg)) return { dikirim: 0 }
  const hari = hariIniWIB()
  if ((await cfgVal(db, 'otomatis_ingat_terakhir', '')) === hari) return { dikirim: 0 }

  const jamTarget = parseInt(await cfgVal(db, 'openwa_jam_pengingat', '8')) || 8
  if (jamWIB() < jamTarget) return { dikirim: 0 }

  const jamDiam = Math.min(72, Math.max(1, parseInt(await cfgVal(db, 'otomatis_ingat_jam', '6')) || 6))

  const { results } = await db.prepare(`
    SELECT kode, total_bayar,
      CAST((julianday('now') - julianday(dibayar_at)) * 24 AS INTEGER) AS jam_diam
    FROM pesanan
    WHERE status_bayar = 'lunas'
      AND status IN ('baru','diproses')
      AND dibayar_at IS NOT NULL
      AND (julianday('now') - julianday(dibayar_at)) * 24 >= ?
    ORDER BY dibayar_at LIMIT 10
  `).bind(jamDiam).all<any>().catch(() => ({ results: [] as any[] }))

  if (!results.length) return { dikirim: 0 }
  await setCfg(db, 'otomatis_ingat_terakhir', hari)

  const nama = await cfgVal(db, 'situs_nama', 'Hiratake')
  const baris = (results as any[]).map(
    (p) => `• ${p.kode} — ${rupiah(p.total_bayar || 0)} (diam ${p.jam_diam} jam)`
  ).join('\n')
  const isi = [
    `⚠️ *${nama} — Pesanan Sudah Dibayar Belum Digarap*`,
    ``,
    `Ada *${results.length}* pesanan yang uangnya sudah masuk tapi belum diproses:`,
    baris,
    ``,
    `Segera proses agar pelanggan tidak menunggu.`,
    `_Pesan otomatis. Atur di Dashboard → Pengaturan._`
  ].join('\n')

  const { results: owners } = await db.prepare(
    "SELECT wa FROM users WHERE role='owner' AND aktif=1 AND wa IS NOT NULL AND wa != ''"
  ).all<any>()
  let n = 0
  for (const o of owners as any[]) {
    const ok = await kirimAman(env, normalWA(o.wa), isi, {
      jenis: 'ingat-pesanan', entitas: 'otomatis', entitasId: hari
    })
    if (ok) n++
  }
  return { dikirim: n }
}

/**
 * Jalankan semua otomatisasi sekaligus.
 *
 * Dipanggil lewat `waitUntil` dari BANYAK titik masuk (landing, checkout,
 * produk, dashboard, notifikasi) — hasil audit menemukan sebelumnya hanya
 * dashboard yang memicunya, sehingga bila sehari tidak ada yang login maka
 * TIDAK ADA otomatisasi yang jalan sama sekali.
 *
 * Semua tugas punya kunci "sudah jalan hari ini", jadi aman dipanggil
 * ratusan kali per hari: yang kedua dan seterusnya langsung keluar.
 */
export async function jalankanOtomatisasi(env: OpenWAEnv, sumber = 'request'): Promise<void> {
  const db = env.DB

  // Rem: cukup 1 kali per JEDA_MENIT walau ada ribuan kunjungan.
  // Tanpa rem ini, halaman depan yang ramai akan menembak DB terus-menerus.
  const JEDA_MENIT = 5
  const denyut = await cfgVal(db, 'otomatis_denyut_terakhir', '')
  if (denyut) {
    const lalu = Date.parse(denyut)
    if (!isNaN(lalu) && Date.now() - lalu < JEDA_MENIT * 60_000) return
  }
  // Kunci dulu supaya request paralel tidak ikut masuk
  await setCfg(db, 'otomatis_denyut_terakhir', new Date().toISOString())
  await setCfg(db, 'otomatis_denyut_sumber', sumber)

  await Promise.allSettled([
    jalankanAutoAlpa(env),
    jalankanRingkasanHarian(env),
    jalankanBersihBersih(env),
    jalankanSusulPenjualan(env),
    jalankanSapuPesanan(env),
    jalankanIngatPesanan(env),
    // Fase 12 — pembukuan otomatis (biaya baglog, rekon piutang,
    // tutup buku bulanan, rekap WA awal bulan)
    jalankanPembukuanOtomatis(env),
    jalankanAsetKasOtomatis(env)
  ])
}
