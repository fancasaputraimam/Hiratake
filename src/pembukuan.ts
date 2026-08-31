// ============================================================
// PEMBUKUAN OTOMATIS — Fase 12
// Semua fungsi di sini dipanggil oleh denyut (lazy-cron), aman dijalankan
// berulang kali (idempoten), dan tidak boleh menggagalkan request.
// ============================================================

import type { OpenWAEnv } from './openwa'
import {
  cfgVal, setCfgVal as setCfg, klaimCfg, getWAConfig, siapKirim, kirimAman, normalWA, rupiah
} from './openwa'

/** Bulan berjalan WIB, format YYYY-MM */
export function bulanWIB(mundur = 0): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  // Nol-kan tanggal dulu supaya mundur bulan tidak "overflow" saat tanggal 29-31
  // menuju bulan yang lebih pendek (mis. 31 Mar - 1 bulan -> 3 Mar, bukan Feb).
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - mundur)
  return d.toISOString().slice(0, 7)
}

/** Tanggal hari ini (1-31) menurut WIB */
export function tanggalHariWIB(): number {
  return new Date(Date.now() + 7 * 3600 * 1000).getUTCDate()
}

// ------------------------------------------------------------
// HITUNG REKAP SATU PERIODE (dipakai tutup buku & laporan)
// ------------------------------------------------------------
export type RekapPeriode = {
  periode: string
  omzet: number
  jumlahNota: number
  pemasukanLain: number
  pengeluaran: number
  laba: number
  kasMasuk: number
  piutangAkhir: number
  panenKg: number
  hppPerKg: number
  investasiBaglog: number
}

export async function hitungRekap(db: D1Database, periode: string): Promise<RekapPeriode> {
  const [omzet, lunas, lain, keluar, panen, baglog, piutang] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM penjualan WHERE strftime('%Y-%m',tanggal)=?`).bind(periode).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE status_bayar='lunas' AND strftime('%Y-%m',tanggal_lunas)=?`).bind(periode).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pemasukan_lain WHERE strftime('%Y-%m',tanggal)=?`).bind(periode).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pengeluaran WHERE strftime('%Y-%m',tanggal)=?`).bind(periode).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal)=?`).bind(periode).first<any>(),
    // PENTING: hanya batch yang biayanya BELUM masuk pengeluaran.
    // Kalau sudah dibukukan otomatis, menambahkannya lagi = hitung dua kali.
    db.prepare(`
      SELECT COALESCE(SUM(b.jumlah*b.biaya_per_baglog),0) v FROM baglog_batch b
      WHERE strftime('%Y-%m',b.tanggal)=?
        AND NOT EXISTS (SELECT 1 FROM pengeluaran p WHERE p.sumber='auto:baglog' AND p.no_bukti=b.kode)
    `).bind(periode).first<any>().catch(() => ({ v: 0 })),
    // Piutang yang masih menggantung dari nota bulan itu (total − cicilan terbayar)
    db.prepare(`
      SELECT COALESCE(SUM(j.total - COALESCE(
        (SELECT SUM(b.jumlah) FROM pembayaran_piutang b WHERE b.penjualan_id = j.id), 0)),0) v
      FROM penjualan j
      WHERE j.status_bayar='tempo' AND strftime('%Y-%m',j.tanggal)=?`).bind(periode).first<any>()
  ])

  const o = omzet?.v ?? 0
  const l = lain?.v ?? 0
  const k = keluar?.v ?? 0
  const kg = panen?.v ?? 0
  const inv = baglog?.v ?? 0

  return {
    periode,
    omzet: o,
    jumlahNota: omzet?.n ?? 0,
    pemasukanLain: l,
    // Pengeluaran akrual = yang sudah dibukukan + investasi baglog bulan itu
    // yang BELUM sempat dibukukan lazy-cron (inv). Tanpa `inv`, laba terlihat
    // lebih besar sampai cron membukukannya — angka jadi tergantung timing.
    pengeluaran: k + inv,
    laba: o + l - k - inv,
    kasMasuk: (lunas?.v ?? 0) + l,
    piutangAkhir: piutang?.v ?? 0,
    panenKg: Math.round(kg * 100) / 100,
    hppPerKg: kg > 0 ? Math.round((k + inv) / kg) : 0,
    investasiBaglog: inv
  }
}

// ------------------------------------------------------------
// 1. TUTUP BUKU OTOMATIS
// Setiap tanggal N (default 5), periode bulan lalu dikunci: angkanya
// disnapshot supaya laporan historis tidak berubah kalau ada input mundur.
// ------------------------------------------------------------
export async function jalankanTutupBuku(
  env: OpenWAEnv
): Promise<{ dijalankan: boolean; periode?: string; alasan?: string }> {
  const db = env.DB
  try {
    if ((await cfgVal(db, 'otomatis_tutup_buku', '1')) !== '1') {
      return { dijalankan: false, alasan: 'Tutup buku otomatis nonaktif.' }
    }
    const tglTarget = Math.min(Math.max(parseInt(await cfgVal(db, 'otomatis_tutup_tanggal', '5')) || 5, 1), 28)
    if (tanggalHariWIB() < tglTarget) {
      return { dijalankan: false, alasan: `Menunggu tanggal ${tglTarget}.` }
    }

    const periode = bulanWIB(1) // bulan lalu

    // Pastikan biaya baglog bulan itu sudah dibukukan SEBELUM disnapshot,
    // supaya tidak ada biaya yang "yatim" setelah periode terkunci.
    await jalankanBiayaBaglog(env).catch(() => {})

    const r = await hitungRekap(db, periode)
    // Periode benar-benar kosong (belum ada transaksi apa pun) → jangan ditutup
    if (r.omzet === 0 && r.pengeluaran === 0 && r.pemasukanLain === 0 && r.panenKg === 0) {
      return { dijalankan: false, alasan: `Periode ${periode} tidak punya transaksi.` }
    }

    // KLAIM ATOMIK: baris buku_tutup sendiri jadi kuncinya. Hanya pemanggil
    // pertama yang berhasil INSERT yang lanjut kirim WA & catat audit.
    const ins = await db.prepare(`
      INSERT INTO buku_tutup
        (periode, ditutup_oleh, otomatis, omzet, pemasukan_lain, pengeluaran, laba,
         kas_masuk, piutang_akhir, panen_kg, hpp_per_kg, catatan)
      VALUES (?, NULL, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'Ditutup otomatis oleh sistem')
      ON CONFLICT(periode) DO NOTHING
    `).bind(
      periode, r.omzet, r.pemasukanLain, r.pengeluaran, r.laba,
      r.kasMasuk, r.piutangAkhir, r.panenKg, r.hppPerKg
    ).run()
    if (!ins.meta.changes) return { dijalankan: false, alasan: `Periode ${periode} sudah ditutup.` }

    await db.prepare(`
      INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail)
      VALUES (NULL, 'SISTEM', 'ubah', 'buku-tutup', ?, ?)
    `).bind(periode, `Tutup buku ${periode}: omzet ${r.omzet}, pengeluaran ${r.pengeluaran}, laba ${r.laba}`)
      .run().catch(() => {})
    await setCfg(db, 'otomatis_tutup_terakhir', new Date().toISOString())
    await kirimRekapKeOwner(env, r, true)
    return { dijalankan: true, periode }
  } catch (e: any) {
    return { dijalankan: false, alasan: String(e?.message || e) }
  }
}

export async function simpanTutupBuku(
  db: D1Database, r: RekapPeriode, userId: number | null, otomatis: boolean
): Promise<void> {
  await db.prepare(`
    INSERT INTO buku_tutup
      (periode, ditutup_oleh, otomatis, omzet, pemasukan_lain, pengeluaran, laba,
       kas_masuk, piutang_akhir, panen_kg, hpp_per_kg, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(periode) DO UPDATE SET
      omzet=excluded.omzet, pemasukan_lain=excluded.pemasukan_lain,
      pengeluaran=excluded.pengeluaran, laba=excluded.laba,
      kas_masuk=excluded.kas_masuk, piutang_akhir=excluded.piutang_akhir,
      panen_kg=excluded.panen_kg, hpp_per_kg=excluded.hpp_per_kg
  `).bind(
    r.periode, userId, otomatis ? 1 : 0, r.omzet, r.pemasukanLain, r.pengeluaran,
    r.laba, r.kasMasuk, r.piutangAkhir, r.panenKg, r.hppPerKg,
    otomatis ? 'Ditutup otomatis oleh sistem' : ''
  ).run()

  await db.prepare(`
    INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail)
    VALUES (?, ?, 'ubah', 'buku-tutup', ?, ?)
  `).bind(
    userId, userId ? 'PENGGUNA' : 'SISTEM', r.periode,
    `Tutup buku ${r.periode}: omzet ${r.omzet}, pengeluaran ${r.pengeluaran}, laba ${r.laba}`
  ).run().catch(() => {})
}

// ------------------------------------------------------------
// 2. REKAP BULANAN KE WHATSAPP
// Laporan laba/rugi bulan lalu dikirim otomatis ke owner.
// ------------------------------------------------------------
async function kirimRekapKeOwner(env: OpenWAEnv, r: RekapPeriode, tutup: boolean): Promise<number> {
  const db = env.DB
  try {
    const cfg = await getWAConfig(env)
    if (!siapKirim(cfg)) return 0
    const nama = await cfgVal(db, 'situs_nama', 'Hiratake')
    const margin = r.omzet > 0 ? Math.round((r.laba / (r.omzet + r.pemasukanLain)) * 1000) / 10 : 0

    const isi = [
      `📊 *${nama} — Rekap ${r.periode}*`,
      ``,
      `💰 Omzet: *${rupiah(r.omzet)}* (${r.jumlahNota} nota)`,
      r.pemasukanLain > 0 ? `➕ Pemasukan lain: ${rupiah(r.pemasukanLain)}` : '',
      `💸 Pengeluaran: ${rupiah(r.pengeluaran)}`,
      `${r.laba >= 0 ? '✅' : '🔴'} Laba/Rugi: *${rupiah(r.laba)}*${margin ? ` (${margin}%)` : ''}`,
      ``,
      `🏦 Kas benar-benar masuk: ${rupiah(r.kasMasuk)}`,
      r.piutangAkhir > 0 ? `⚠️ Piutang belum tertagih: *${rupiah(r.piutangAkhir)}*` : `✅ Tidak ada piutang menggantung`,
      ``,
      `🌾 Panen: ${r.panenKg} kg`,
      r.hppPerKg > 0 ? `🧮 HPP: ${rupiah(r.hppPerKg)}/kg` : '',
      ``,
      tutup ? `_Buku periode ini sudah DITUTUP otomatis. Angka di atas final._` : `_Rekap otomatis dari sistem._`
    ].filter((x) => x !== '').join('\n')

    const { results: owners } = await db.prepare(
      "SELECT wa FROM users WHERE role='owner' AND aktif=1 AND wa IS NOT NULL AND wa != ''"
    ).all<any>()
    let terkirim = 0
    for (const o of owners as any[]) {
      const h = await kirimAman(env, normalWA(o.wa), isi, {
        jenis: 'rekap', entitas: 'pembukuan', entitasId: r.periode
      })
      if ((h as any)?.ok !== false) terkirim++
    }
    return terkirim
  } catch {
    return 0
  }
}

export async function jalankanRekapBulanan(
  env: OpenWAEnv
): Promise<{ dijalankan: boolean; alasan?: string }> {
  const db = env.DB
  try {
    if ((await cfgVal(db, 'otomatis_rekap_bulanan', '1')) !== '1') {
      return { dijalankan: false, alasan: 'Rekap bulanan nonaktif.' }
    }
    const periode = bulanWIB(1)
    const terakhir = await cfgVal(db, 'otomatis_rekap_terakhir', '')
    if (terakhir === periode || terakhir === `proses:${periode}`) {
      return { dijalankan: false, alasan: 'Sudah dikirim.' }
    }
    // Kirim di awal bulan (tanggal 1-3) supaya owner cepat dapat laporan
    if (tanggalHariWIB() > 3) return { dijalankan: false, alasan: 'Lewat jendela awal bulan.' }

    // KLAIM ATOMIK: hanya satu request yang boleh lanjut kirim.
    if (!(await klaimCfg(db, 'otomatis_rekap_terakhir', terakhir, `proses:${periode}`))) {
      return { dijalankan: false, alasan: 'Sedang diproses request lain.' }
    }
    const r = await hitungRekap(db, periode)
    if (r.omzet === 0 && r.pengeluaran === 0) {
      await setCfg(db, 'otomatis_rekap_terakhir', periode) // tidak ada yang perlu dikirim
      return { dijalankan: false, alasan: 'Periode kosong.' }
    }
    const terkirim = await kirimRekapKeOwner(env, r, false)
    // Gagal kirim → lepas kunci agar dicoba lagi
    await setCfg(db, 'otomatis_rekap_terakhir', terkirim > 0 ? periode : '')
    return { dijalankan: terkirim > 0, alasan: terkirim > 0 ? undefined : 'Pengiriman gagal, akan dicoba lagi.' }
  } catch (e: any) {
    return { dijalankan: false, alasan: String(e?.message || e) }
  }
}

// ------------------------------------------------------------
// 3. BIAYA BAGLOG OTOMATIS MASUK PENGELUARAN
// Sebelumnya investasi baglog HANYA dipakai di rumus HPP, tidak pernah
// jadi baris pengeluaran → laba/rugi terlihat lebih besar dari kenyataan.
// ------------------------------------------------------------
export async function jalankanBiayaBaglog(
  env: OpenWAEnv
): Promise<{ dijalankan: boolean; dicatat: number }> {
  const db = env.DB
  try {
    if ((await cfgVal(db, 'otomatis_baglog_biaya', '1')) !== '1') return { dijalankan: false, dicatat: 0 }

    // Batch yang punya biaya tapi belum pernah dibukukan sebagai pengeluaran
    const { results } = await db.prepare(`
      SELECT b.id, b.kode, b.tanggal, b.jumlah, b.biaya_per_baglog, b.user_id
      FROM baglog_batch b
      WHERE b.biaya_per_baglog > 0 AND b.jumlah > 0
        AND NOT EXISTS (
          SELECT 1 FROM pengeluaran p
          WHERE p.sumber = 'auto:baglog' AND p.no_bukti = b.kode
        )
        AND NOT EXISTS (SELECT 1 FROM buku_tutup t WHERE t.periode = strftime('%Y-%m', b.tanggal))
      ORDER BY b.tanggal LIMIT 20
    `).all<any>()
    if (!results.length) return { dijalankan: true, dicatat: 0 }

    const stmts = (results as any[]).map((b) =>
      db.prepare(`
        INSERT OR IGNORE INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id, no_bukti, sumber)
        VALUES (?, 'bibit', ?, ?, ?, ?, 'auto:baglog')
      `).bind(
        b.tanggal, b.jumlah * b.biaya_per_baglog,
        `Baglog batch ${b.kode} — ${b.jumlah} baglog × ${rupiah(b.biaya_per_baglog)}`,
        b.user_id ?? null, b.kode
      )
    )
    await db.batch(stmts)
    await db.prepare(`
      INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail)
      VALUES (NULL, 'SISTEM', 'tambah', 'pengeluaran', 'auto:baglog', ?)
    `).bind(`Otomatis membukukan biaya ${results.length} batch baglog`).run().catch(() => {})
    return { dijalankan: true, dicatat: results.length }
  } catch {
    return { dijalankan: false, dicatat: 0 }
  }
}

// ------------------------------------------------------------
// 4. PIUTANG JATUH TEMPO OTOMATIS DITANDAI
// Piutang yang cicilannya sudah menutup total tapi statusnya masih 'tempo'
// (mis. karena cicilan terakhir dicatat mundur) diperbaiki otomatis.
// ------------------------------------------------------------
export async function jalankanRekonPiutang(
  env: OpenWAEnv
): Promise<{ dijalankan: boolean; diperbaiki: number }> {
  const db = env.DB
  try {
    const { results } = await db.prepare(`
      SELECT j.id, MAX(b.tanggal) tgl_akhir
      FROM penjualan j JOIN pembayaran_piutang b ON b.penjualan_id = j.id
      WHERE j.status_bayar = 'tempo'
      GROUP BY j.id
      HAVING SUM(b.jumlah) >= j.total
      LIMIT 20
    `).all<any>()
    if (!results.length) return { dijalankan: true, diperbaiki: 0 }

    await db.batch((results as any[]).map((r) =>
      db.prepare("UPDATE penjualan SET status_bayar='lunas', tanggal_lunas=? WHERE id=? AND status_bayar='tempo'")
        .bind(r.tgl_akhir, r.id)
    ))
    await db.prepare(`
      INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail)
      VALUES (NULL, 'SISTEM', 'bayar', 'piutang', 'auto:rekon', ?)
    `).bind(`Otomatis melunasi ${results.length} piutang yang cicilannya sudah penuh`).run().catch(() => {})
    return { dijalankan: true, diperbaiki: results.length }
  } catch {
    return { dijalankan: false, diperbaiki: 0 }
  }
}

// ------------------------------------------------------------
// 5. REKONSILIASI KAS: pembayaran gateway vs pembukuan
// Membandingkan uang yang tercatat masuk (pembayaran berstatus 'dibayar')
// dengan yang terbukukan (penjualan + pemasukan_lain) per bulan.
// ------------------------------------------------------------
export type HasilRekonKas = {
  periode: string
  gatewayDiterima: number
  terbukukan: number
  selisih: number
  cocok: boolean
  rincian: { pesanan: string; diterima: number; terbukukan: number; selisih: number }[]
}

export async function rekonsiliasiKas(db: D1Database, periode: string): Promise<HasilRekonKas> {
  // Per pesanan: jumlah yang masuk lewat pembayaran vs yang terbukukan
  const { results } = await db.prepare(`
    SELECT ps.kode,
      COALESCE((SELECT SUM(pb.jumlah) FROM pembayaran pb
                WHERE pb.pesanan_id = ps.id AND pb.status = 'dibayar'), 0) AS diterima,
      COALESCE((SELECT SUM(j.total) FROM penjualan j WHERE j.pesanan_id = ps.id), 0)
      + COALESCE((SELECT SUM(pl.jumlah) FROM pemasukan_lain pl WHERE pl.no_bukti = ps.kode), 0) AS terbukukan
    FROM pesanan ps
    WHERE ps.status_bayar = 'lunas'
      AND strftime('%Y-%m', COALESCE(date(ps.dibayar_at), ps.tanggal_pesan)) = ?
  `).bind(periode).all<any>()

  const rincian = (results as any[])
    .map((r) => ({
      pesanan: r.kode,
      diterima: r.diterima || 0,
      terbukukan: r.terbukukan || 0,
      selisih: (r.diterima || 0) - (r.terbukukan || 0)
    }))
    .filter((r) => r.selisih !== 0)

  const gatewayDiterima = (results as any[]).reduce((s, r) => s + (r.diterima || 0), 0)
  const terbukukan = (results as any[]).reduce((s, r) => s + (r.terbukukan || 0), 0)

  return {
    periode,
    gatewayDiterima,
    terbukukan,
    selisih: gatewayDiterima - terbukukan,
    cocok: gatewayDiterima === terbukukan,
    rincian: rincian.slice(0, 20)
  }
}

// ------------------------------------------------------------
// AGREGATOR: dipanggil dari denyut
// ------------------------------------------------------------
export async function jalankanPembukuanOtomatis(env: OpenWAEnv): Promise<void> {
  // Biaya baglog HARUS selesai dibukukan sebelum tutup buku, supaya tidak ada
  // biaya yang "yatim" begitu periode terkunci.
  await jalankanBiayaBaglog(env).catch(() => {})
  await Promise.allSettled([
    jalankanRekonPiutang(env),
    jalankanTutupBuku(env),
    jalankanRekapBulanan(env)
  ])
}
