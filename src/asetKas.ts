// ============================================================
// FASE 13 — Kas Opname, Aset Tetap & Penyusutan, Ekspor Buku
//
// Menjawab 3 rekomendasi audit pembukuan:
//   #1 Kas opname  — deteksi uang hilang di luar sistem
//   #3 Penyusutan  — biaya aset disebar, bukan menumpuk di 1 bulan
//   #5 Ekspor      — arsip pembukuan ke luar sistem
//
// Semua fungsi idempoten dan tidak boleh menggagalkan request.
// ============================================================

import type { OpenWAEnv } from './openwa'
import { cfgVal, klaimCfg, getWAConfig, siapKirim, kirimAman, normalWA, rupiah } from './openwa'
import { bulanWIB, tanggalHariWIB } from './pembukuan'

async function setCfg(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value).run()
}

/** Tanggal hari ini WIB (YYYY-MM-DD) */
export function hariWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

// ============================================================
//  A. KAS OPNAME
// ============================================================

/**
 * Saldo kas yang SEHARUSNYA ada menurut sistem, dihitung sejak
 * opname terakhir (atau sejak awal bila belum pernah opname).
 *
 * Kas masuk  = pembayaran berstatus 'dibayar' + penjualan lunas non-pesanan
 *              + pemasukan lain + cicilan piutang
 * Kas keluar = seluruh pengeluaran, KECUALI yang non-kas (penyusutan).
 *              Penyusutan hanya beban akuntansi, uangnya tidak keluar.
 */
export type SaldoKas = {
  sejak: string
  saldoAwal: number
  masuk: number
  keluar: number
  saldoSistem: number
}

export async function hitungSaldoKas(db: D1Database, sampai?: string): Promise<SaldoKas> {
  const hingga = sampai || hariWIB()

  // Opname terakhir sebelum tanggal ini jadi titik awal — supaya
  // selisih yang sudah diakui tidak dihitung dua kali.
  const akhir = await db.prepare(
    'SELECT tanggal, saldo_fisik FROM kas_opname WHERE tanggal < ? ORDER BY tanggal DESC LIMIT 1'
  ).bind(hingga).first<any>().catch(() => null)

  const sejak = akhir?.tanggal || '1970-01-01'
  const saldoAwal = Number(akhir?.saldo_fisik ?? 0)

  const [bayar, jualTunai, lain, cicil, keluar] = await Promise.all([
    // Uang dari pesanan online yang sudah dibayar
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pembayaran
      WHERE status='dibayar' AND date(COALESCE(dibayar_at, created_at),'+7 hours') > ?
        AND date(COALESCE(dibayar_at, created_at),'+7 hours') <= ?`)
      .bind(sejak, hingga).first<any>().catch(() => ({ v: 0 })),
    // Nota kasir yang lunas dan TIDAK berasal dari pesanan online
    // (kalau dari pesanan, uangnya sudah terhitung di `pembayaran` di atas)
    db.prepare(`SELECT COALESCE(SUM(total),0) v FROM penjualan
      WHERE status_bayar='lunas' AND pesanan_id IS NULL
        AND tanggal > ? AND tanggal <= ?`)
      .bind(sejak, hingga).first<any>().catch(() => ({ v: 0 })),
    // Pemasukan lain yang bukan hasil pesanan online
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pemasukan_lain
      WHERE tanggal > ? AND tanggal <= ? AND sumber NOT LIKE 'auto:%'`)
      .bind(sejak, hingga).first<any>().catch(() => ({ v: 0 })),
    // Cicilan piutang
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pembayaran_piutang
      WHERE tanggal > ? AND tanggal <= ?`)
      .bind(sejak, hingga).first<any>().catch(() => ({ v: 0 })),
    // Pengeluaran KAS saja — penyusutan tidak mengurangi uang fisik
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pengeluaran
      WHERE tanggal > ? AND tanggal <= ? AND kategori != 'penyusutan'`)
      .bind(sejak, hingga).first<any>().catch(() => ({ v: 0 }))
  ])

  const masuk = (bayar?.v ?? 0) + (jualTunai?.v ?? 0) + (lain?.v ?? 0) + (cicil?.v ?? 0)
  const kel = keluar?.v ?? 0

  return {
    sejak,
    saldoAwal,
    masuk,
    keluar: kel,
    saldoSistem: saldoAwal + masuk - kel
  }
}

/** Catat hasil hitung uang fisik. Idempoten per tanggal (UNIQUE). */
export async function simpanOpname(
  db: D1Database,
  tanggal: string,
  saldoFisik: number,
  catatan: string,
  userId: number | null
): Promise<{ saldoSistem: number; selisih: number; toleransi: number; wajar: boolean }> {
  const s = await hitungSaldoKas(db, tanggal)
  const selisih = Math.round(saldoFisik - s.saldoSistem)
  const toleransi = parseInt(await cfgVal(db, 'kas_opname_toleransi', '5000')) || 0

  await db.prepare(`
    INSERT INTO kas_opname (tanggal, saldo_sistem, saldo_fisik, selisih, catatan, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tanggal) DO UPDATE SET
      saldo_sistem = excluded.saldo_sistem,
      saldo_fisik  = excluded.saldo_fisik,
      selisih      = excluded.selisih,
      catatan      = excluded.catatan,
      user_id      = excluded.user_id
  `).bind(tanggal, s.saldoSistem, Math.round(saldoFisik), selisih, String(catatan || '').slice(0, 300), userId).run()

  return { saldoSistem: s.saldoSistem, selisih, toleransi, wajar: Math.abs(selisih) <= toleransi }
}

/**
 * Ingatkan owner via WA kalau opname hari ini belum diisi, atau
 * selisihnya melebihi toleransi. Jalan sekali sehari.
 */
export async function jalankanIngatOpname(env: OpenWAEnv): Promise<{ dijalankan: boolean; alasan?: string }> {
  const db = env.DB
  if ((await cfgVal(db, 'otomatis_opname_ingat', '1')) === '0') return { dijalankan: false, alasan: 'nonaktif' }

  const hari = hariWIB()
  const terakhir = await cfgVal(db, 'otomatis_opname_terakhir', '')
  if (terakhir === hari || terakhir === `proses:${hari}`) return { dijalankan: false, alasan: 'sudah' }

  // Hanya setelah jam tutup (default jam 17 WIB) agar tidak mengganggu pagi
  const jam = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours()
  if (jam < 17) return { dijalankan: false, alasan: 'belum waktunya' }

  const waCfg = await getWAConfig(env)
  if (!siapKirim(waCfg)) return { dijalankan: false, alasan: 'WA belum siap' }

  const kemarin = await db.prepare(
    'SELECT tanggal, selisih FROM kas_opname WHERE tanggal = ?'
  ).bind(hari).first<any>().catch(() => null)

  const toleransi = parseInt(await cfgVal(db, 'kas_opname_toleransi', '5000')) || 0
  let isi = ''
  if (!kemarin) {
    const s = await hitungSaldoKas(db, hari)
    isi = `🧾 *Kas opname belum diisi*\n\nTanggal: ${hari}\n`
      + `Menurut sistem kas seharusnya: *${rupiah(s.saldoSistem)}*\n\n`
      + `Silakan hitung uang fisik lalu catat di menu Otomatisasi → Kas Opname.`
  } else if (Math.abs(Number(kemarin.selisih)) > toleransi) {
    const sel = Number(kemarin.selisih)
    isi = `⚠️ *Selisih kas hari ini*\n\nTanggal: ${hari}\n`
      + `Selisih: *${rupiah(sel)}* (${sel < 0 ? 'uang KURANG' : 'uang LEBIH'})\n\n`
      + `Batas wajar ${rupiah(toleransi)}. Mohon diperiksa.`
  } else {
    await setCfg(db, 'otomatis_opname_terakhir', hari)
    return { dijalankan: false, alasan: 'kas wajar' }
  }

  // KLAIM ATOMIK: request paralel tidak boleh sama-sama kirim.
  if (!(await klaimCfg(db, 'otomatis_opname_terakhir', terakhir, `proses:${hari}`))) {
    return { dijalankan: false, alasan: 'sedang diproses' }
  }
  const { results: owners } = await db.prepare(
    "SELECT wa FROM users WHERE role='owner' AND wa IS NOT NULL AND wa != ''"
  ).all<any>()

  let terkirim = 0
  for (const o of owners as any[]) {
    const h = await kirimAman(env, normalWA(o.wa), isi, { jenis: 'opname', entitas: 'kas-opname', entitasId: hari })
    if ((h as any)?.ok !== false) terkirim++
  }
  if (terkirim > 0 || (owners as any[]).length === 0) {
    await setCfg(db, 'otomatis_opname_terakhir', hari)
    return { dijalankan: true }
  }
  await setCfg(db, 'otomatis_opname_terakhir', '')
  return { dijalankan: false, alasan: 'semua gagal kirim' }
}

// ============================================================
//  B. ASET TETAP & PENYUSUTAN
// ============================================================

/** Penyusutan garis lurus per bulan untuk satu aset */
export function susutPerBulan(a: { harga_beli: number; nilai_residu: number; umur_bulan: number }): number {
  const umur = Math.max(1, a.umur_bulan || 1)
  const dasar = Math.max(0, (a.harga_beli || 0) - (a.nilai_residu || 0))
  return Math.round(dasar / umur)
}

/**
 * Bukukan penyusutan bulan lalu untuk semua aset aktif.
 * - Tidak menyentuh periode yang sudah tutup buku.
 * - UNIQUE(aset_id, periode) mencegah dobel.
 * - Aset yang sudah habis disusutkan ditandai 'lunas_susut'.
 */
export async function jalankanPenyusutan(
  env: OpenWAEnv
): Promise<{ dijalankan: boolean; dibukukan: number; total: number; alasan?: string }> {
  const db = env.DB
  if ((await cfgVal(db, 'otomatis_penyusutan', '1')) === '0') {
    return { dijalankan: false, dibukukan: 0, total: 0, alasan: 'nonaktif' }
  }

  // Susutkan bulan yang SUDAH selesai saja
  const periode = bulanWIB(1)

  // Jangan tulis ke periode yang sudah dikunci
  const tutup = await db.prepare('SELECT periode FROM buku_tutup WHERE periode = ?')
    .bind(periode).first<any>().catch(() => null)
  if (tutup) return { dijalankan: false, dibukukan: 0, total: 0, alasan: 'buku sudah ditutup' }

  const { results } = await db.prepare(`
    SELECT a.id, a.nama, a.harga_beli, a.nilai_residu, a.umur_bulan, a.tanggal_beli,
      (SELECT COUNT(*) FROM aset_penyusutan s WHERE s.aset_id = a.id) AS sudah
    FROM aset_tetap a
    WHERE a.status = 'aktif'
      AND strftime('%Y-%m', a.tanggal_beli) <= ?
      AND NOT EXISTS (SELECT 1 FROM aset_penyusutan s WHERE s.aset_id = a.id AND s.periode = ?)
    LIMIT 50
  `).bind(periode, periode).all<any>().catch(() => ({ results: [] as any[] }))

  if (!(results as any[]).length) return { dijalankan: false, dibukukan: 0, total: 0, alasan: 'tidak ada' }

  // Tanggal buku = hari terakhir periode tersebut
  const akhirBulan = new Date(Date.UTC(
    parseInt(periode.slice(0, 4)), parseInt(periode.slice(5, 7)), 0
  )).toISOString().slice(0, 10)

  let dibukukan = 0
  let total = 0
  for (const a of results as any[]) {
    const nilai = susutPerBulan(a)
    if (nilai <= 0) continue

    // Sudah habis umurnya → tandai selesai, jangan susutkan lagi
    if ((a.sudah ?? 0) >= (a.umur_bulan || 1)) {
      await db.prepare("UPDATE aset_tetap SET status='lunas_susut' WHERE id = ?").bind(a.id).run()
      continue
    }

    const noBukti = `SUSUT-${periode}-${a.id}`
    // INSERT OR IGNORE jadi kunci atomik: kalau baris ini sudah pernah dibuat
    // (run paralel / retry setelah crash), meta.changes = 0 dan kita lewati
    // SEMUA efek samping (aset_penyusutan, lunas_susut) — tidak dobel.
    const r = await db.prepare(`
      INSERT OR IGNORE INTO pengeluaran (tanggal, kategori, jumlah, keterangan, no_bukti, sumber)
      VALUES (?, 'penyusutan', ?, ?, ?, 'auto:penyusutan')
    `).bind(akhirBulan, nilai, `Penyusutan ${a.nama} (${periode})`, noBukti).run()
    if (!r.meta.changes) continue

    await db.prepare(`
      INSERT OR IGNORE INTO aset_penyusutan (aset_id, periode, jumlah, pengeluaran_id, otomatis)
      VALUES (?, ?, ?, ?, 1)
    `).bind(a.id, periode, nilai, r.meta.last_row_id).run()

    // Kalau ini penyusutan terakhir, tutup asetnya
    if ((a.sudah ?? 0) + 1 >= (a.umur_bulan || 1)) {
      await db.prepare("UPDATE aset_tetap SET status='lunas_susut' WHERE id = ?").bind(a.id).run()
    }

    dibukukan++
    total += nilai
  }

  if (dibukukan > 0) await setCfg(db, 'otomatis_penyusutan_terakhir', periode)
  return { dijalankan: dibukukan > 0, dibukukan, total }
}

/** Ringkasan nilai aset & akumulasi penyusutan */
export async function ringkasanAset(db: D1Database): Promise<any> {
  const { results } = await db.prepare(`
    SELECT a.*,
      (SELECT COALESCE(SUM(s.jumlah),0) FROM aset_penyusutan s WHERE s.aset_id = a.id) AS akumulasi,
      (SELECT COUNT(*) FROM aset_penyusutan s WHERE s.aset_id = a.id) AS bulan_disusut
    FROM aset_tetap a ORDER BY a.status, a.tanggal_beli DESC
  `).all<any>().catch(() => ({ results: [] as any[] }))

  const aset = (results as any[]).map((a) => {
    const perBulan = susutPerBulan(a)
    const nilaiBuku = Math.max(a.nilai_residu || 0, (a.harga_beli || 0) - (a.akumulasi || 0))
    return {
      ...a,
      susutPerBulan: perBulan,
      nilaiBuku,
      sisaBulan: Math.max(0, (a.umur_bulan || 0) - (a.bulan_disusut || 0))
    }
  })

  return {
    aset,
    total: {
      hargaBeli: aset.reduce((t, a) => t + (a.harga_beli || 0), 0),
      akumulasi: aset.reduce((t, a) => t + (a.akumulasi || 0), 0),
      nilaiBuku: aset.reduce((t, a) => t + a.nilaiBuku, 0),
      susutBulanan: aset.filter((a) => a.status === 'aktif').reduce((t, a) => t + a.susutPerBulan, 0)
    }
  }
}

// ============================================================
//  C. EKSPOR PEMBUKUAN (CSV)
// ============================================================

function csvAman(v: any): string {
  let s = String(v ?? '')
  // Anti formula/DDE injection: sel yang diawali = + - @ TAB CR diberi awalan '
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Buku besar sederhana satu periode: semua transaksi uang dalam
 * satu daftar berurutan, siap dibuka di Excel.
 */
export async function eksporBukuCSV(db: D1Database, periode: string): Promise<{ csv: string; baris: number }> {
  const [jual, lain, keluar, cicil] = await Promise.all([
    db.prepare(`SELECT j.tanggal, 'Penjualan' jenis,
        COALESCE(NULLIF(p.nama,''), NULLIF(j.pembeli,''), '-') pihak,
        COALESCE(j.nama_produk,'') ket, j.total masuk, 0 kel, j.status_bayar, '' bukti
      FROM penjualan j LEFT JOIN pelanggan p ON p.id = j.pelanggan_id
      WHERE strftime('%Y-%m', j.tanggal) = ?`).bind(periode).all<any>().catch(() => ({ results: [] })),
    db.prepare(`SELECT tanggal, 'Pemasukan lain' jenis, '' pihak, keterangan ket,
        jumlah masuk, 0 kel, kategori status_bayar, no_bukti bukti
      FROM pemasukan_lain WHERE strftime('%Y-%m', tanggal) = ?`).bind(periode).all<any>().catch(() => ({ results: [] })),
    db.prepare(`SELECT tanggal, 'Pengeluaran' jenis, '' pihak, keterangan ket,
        0 masuk, jumlah kel, kategori status_bayar, no_bukti bukti
      FROM pengeluaran WHERE strftime('%Y-%m', tanggal) = ?`).bind(periode).all<any>().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.tanggal, 'Cicilan piutang' jenis, COALESCE(p.nama,'-') pihak,
        '' ket, b.jumlah masuk, 0 kel, 'cicilan' status_bayar, '' bukti
      FROM pembayaran_piutang b
      LEFT JOIN penjualan j ON j.id = b.penjualan_id
      LEFT JOIN pelanggan p ON p.id = j.pelanggan_id
      WHERE strftime('%Y-%m', b.tanggal) = ?`).bind(periode).all<any>().catch(() => ({ results: [] }))
  ])

  const semua = [
    ...(jual.results as any[]), ...(lain.results as any[]),
    ...(keluar.results as any[]), ...(cicil.results as any[])
  ].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))

  const head = ['Tanggal', 'Jenis', 'Pihak', 'Keterangan', 'Masuk', 'Keluar', 'Status/Kategori', 'No Bukti', 'Saldo Jalan']
  let saldo = 0
  const baris = semua.map((r) => {
    saldo += (r.masuk || 0) - (r.kel || 0)
    return [r.tanggal, r.jenis, r.pihak, r.ket, r.masuk || 0, r.kel || 0, r.status_bayar, r.bukti, saldo]
      .map(csvAman).join(',')
  })

  const totalMasuk = semua.reduce((t, r) => t + (r.masuk || 0), 0)
  const totalKeluar = semua.reduce((t, r) => t + (r.kel || 0), 0)

  const csv = '\uFEFF' + [
    `Buku Besar Periode ${periode}`,
    '',
    head.join(','),
    ...baris,
    '',
    ['', '', '', 'TOTAL', totalMasuk, totalKeluar, '', '', saldo].map(csvAman).join(',')
  ].join('\n')

  return { csv, baris: semua.length }
}

// ============================================================
//  AGREGATOR untuk denyut
// ============================================================
export async function jalankanAsetKasOtomatis(env: OpenWAEnv): Promise<void> {
  await Promise.allSettled([
    jalankanPenyusutan(env),
    jalankanIngatOpname(env)
  ])
}
