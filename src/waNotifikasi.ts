// ============================================================
//  Notifikasi otomatis Hiratake via OpenWA
//  Semua fungsi di sini "aman gagal": kegagalan WhatsApp TIDAK
//  boleh menggagalkan transaksi bisnis (anti-miss).
// ============================================================
import {
  type OpenWAEnv, kirimAman, pesanDariTemplate, namaSitus, cfgVal, klaimCfg,
  rupiah, tanggalID, rincianItem, normalWA, hariIniWIB, jamWIB, getWAConfig, siapKirim
} from './openwa'

/** Cek satu saklar notifikasi (mis. openwa_notif_pesanan). */
async function notifAktif(db: D1Database, kunci: string): Promise<boolean> {
  const cfg = await getWAConfig({ DB: db } as OpenWAEnv)
  if (!cfg.aktif) return false
  return (await cfgVal(db, kunci, '1')) === '1'
}

/** Bisa kirim? (integrasi aktif + API key ada + saklar spesifik hidup) */
async function bolehKirim(env: OpenWAEnv, kunci: string): Promise<boolean> {
  const cfg = await getWAConfig(env)
  if (!siapKirim(cfg)) return false
  return (await cfgVal(env.DB, kunci, '1')) === '1'
}

const labelStatus: Record<string, string> = {
  baru: 'Baru diterima',
  diproses: 'Sedang diproses',
  siap: 'Siap dikirim/diambil',
  selesai: 'Selesai',
  batal: 'Dibatalkan'
}
const catatanStatus: Record<string, string> = {
  baru: 'Pesanan Anda masuk daftar dan akan segera kami proses.',
  diproses: 'Jamur sedang kami siapkan & sortir. 🍄',
  siap: 'Pesanan sudah siap. Kami hubungi untuk pengiriman/pengambilan.',
  selesai: 'Terima kasih! Pesanan sudah selesai.',
  batal: 'Pesanan dibatalkan. Hubungi kami bila ini keliru.'
}

// ---------- 1. Pesanan baru (ke pelanggan) ----------
export async function notifPesananBaru(
  env: OpenWAEnv,
  pesananId: number | string,
  userId?: number | null
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_pesanan'))) return
    const db = env.DB
    const ps = await db.prepare(
      `SELECT ps.id, ps.kode, ps.tanggal_kirim, ps.catatan, pl.nama, pl.wa
       FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
    ).bind(pesananId).first<any>()
    if (!ps || !normalWA(ps.wa)) return

    const { results: items } = await db.prepare(
      'SELECT nama_produk, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?'
    ).bind(ps.id).all<any>()
    const total = items.reduce((a: number, b: any) => a + (b.subtotal || 0), 0)

    const isi = await pesanDariTemplate(db, 'pesanan_baru', {
      nama: ps.nama, kode: ps.kode, rincian: rincianItem(items as any),
      total: rupiah(total), tanggal_kirim: tanggalID(ps.tanggal_kirim),
      situs: await namaSitus(db), catatan: ps.catatan || '-'
    })
    if (!isi) return
    await kirimAman(env, ps.wa, isi, {
      jenis: 'pesanan_baru', entitas: 'pesanan', entitasId: ps.kode, userId: userId ?? null
    })
  } catch { /* notifikasi tidak boleh mengganggu operasi utama */ }
}

// ---------- 2. Pesanan web baru (ke owner/admin internal) ----------
export async function notifInternalPO(
  env: OpenWAEnv,
  pesananId: number | string
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_internal'))) return
    const db = env.DB
    const ps = await db.prepare(
      `SELECT ps.id, ps.kode, ps.catatan, pl.nama, pl.wa
       FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
    ).bind(pesananId).first<any>()
    if (!ps) return
    const { results: items } = await db.prepare(
      'SELECT nama_produk, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?'
    ).bind(ps.id).all<any>()
    const total = items.reduce((a: number, b: any) => a + (b.subtotal || 0), 0)

    const isi = await pesanDariTemplate(db, 'internal_po', {
      kode: ps.kode, nama: ps.nama, wa: normalWA(ps.wa),
      rincian: rincianItem(items as any), total: rupiah(total),
      catatan: ps.catatan || '-', situs: await namaSitus(db)
    })
    if (!isi) return

    // Kirim ke semua owner & admin yang punya nomor WA terdaftar
    const { results: petugas } = await db.prepare(
      "SELECT wa FROM users WHERE role IN ('owner','admin') AND aktif = 1 AND wa IS NOT NULL AND wa != ''"
    ).all<any>()
    for (const p of petugas as any[]) {
      await kirimAman(env, p.wa, isi, { jenis: 'pesanan_baru', entitas: 'internal', entitasId: ps.kode })
    }
  } catch { /* diamkan */ }
}

// ---------- 3. Status pesanan berubah ----------
export async function notifStatusPesanan(
  env: OpenWAEnv,
  pesananId: number | string,
  status: string,
  userId?: number | null
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_status'))) return
    const db = env.DB
    const ps = await db.prepare(
      `SELECT ps.id, ps.kode, pl.nama, pl.wa,
              (SELECT COALESCE(SUM(subtotal),0) FROM pesanan_item WHERE pesanan_id = ps.id) AS total
       FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
    ).bind(pesananId).first<any>()
    if (!ps || !normalWA(ps.wa)) return

    const isi = await pesanDariTemplate(db, 'pesanan_status', {
      nama: ps.nama, kode: ps.kode, status: labelStatus[status] || status,
      catatan_status: catatanStatus[status] || '', total: rupiah(ps.total),
      situs: await namaSitus(db)
    })
    if (!isi) return
    await kirimAman(env, ps.wa, isi, {
      jenis: 'pesanan_status', entitas: 'pesanan', entitasId: ps.kode, userId: userId ?? null
    })
  } catch { /* diamkan */ }
}

// ---------- 4. Nota saat pesanan selesai ----------
export async function notifNota(
  env: OpenWAEnv,
  pesananId: number | string,
  statusBayar: string,
  jatuhTempo: string | null,
  userId?: number | null
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_nota'))) return
    const db = env.DB
    const ps = await db.prepare(
      `SELECT ps.id, ps.kode, ps.sumber, ps.ongkir, ps.biaya_admin, ps.total_bayar, pl.nama, pl.wa
       FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
    ).bind(pesananId).first<any>()
    if (!ps || !normalWA(ps.wa)) return

    const { results: items } = await db.prepare(
      'SELECT nama_produk, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?'
    ).bind(ps.id).all<any>()
    const subtotal = items.reduce((a: number, b: any) => a + (b.subtotal || 0), 0)
    const ongkir = Math.max(0, parseInt(ps.ongkir || 0, 10) || 0)
    const biaya = Math.max(0, parseInt(ps.biaya_admin || 0, 10) || 0)
    // Nota harus sama dengan yang DIBAYAR pelanggan: subtotal item + ongkir +
    // biaya admin (untuk pesanan web). total_bayar dipakai bila tersedia.
    const total = Number(ps.total_bayar) > 0 ? Number(ps.total_bayar) : subtotal + ongkir + biaya
    const rincianExtra =
      (ongkir > 0 ? `\n• Ongkos kirim = ${rupiah(ongkir)}` : '') +
      (biaya > 0 ? `\n• Biaya layanan = ${rupiah(biaya)}` : '')

    const isi = await pesanDariTemplate(db, 'nota', {
      kode: ps.kode, nama: ps.nama, tanggal: tanggalID(hariIniWIB()),
      rincian: rincianItem(items as any) + rincianExtra, total: rupiah(total),
      status_bayar: statusBayar === 'tempo' ? 'TEMPO (belum lunas)' : 'LUNAS ✅',
      info_tempo: statusBayar === 'tempo' && jatuhTempo ? `\nJatuh tempo: ${tanggalID(jatuhTempo)}` : '',
      situs: await namaSitus(db)
    })
    if (!isi) return
    await kirimAman(env, ps.wa, isi, {
      jenis: 'nota', entitas: 'pesanan', entitasId: ps.kode, userId: userId ?? null
    })
  } catch { /* diamkan */ }
}

// ---------- 5. Tagihan / pengingat piutang ----------
export async function notifPiutang(
  env: OpenWAEnv,
  penjualanId: number | string,
  userId?: number | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = env.DB
    const pj = await db.prepare(
      `SELECT pj.id, pj.total, pj.jatuh_tempo, pl.nama, pl.wa,
              COALESCE((SELECT SUM(jumlah) FROM pembayaran_piutang WHERE penjualan_id = pj.id),0) AS terbayar
       FROM penjualan pj LEFT JOIN pelanggan pl ON pl.id = pj.pelanggan_id
       WHERE pj.id = ? AND pj.status_bayar = 'tempo'`
    ).bind(penjualanId).first<any>()
    if (!pj) return { ok: false, error: 'Piutang tidak ditemukan atau sudah lunas.' }
    if (!normalWA(pj.wa)) return { ok: false, error: 'Pelanggan ini belum punya nomor WhatsApp.' }

    const sisa = (pj.total || 0) - (pj.terbayar || 0)
    const telat = pj.jatuh_tempo && pj.jatuh_tempo < hariIniWIB()
    const isi = await pesanDariTemplate(db, 'piutang', {
      nama: pj.nama, total: rupiah(pj.total), terbayar: rupiah(pj.terbayar),
      sisa: rupiah(sisa), jatuh_tempo: tanggalID(pj.jatuh_tempo),
      keterangan_tempo: telat ? 'SUDAH TERLAMBAT' : 'belum jatuh tempo',
      situs: await namaSitus(db)
    })
    if (!isi) return { ok: false, error: 'Template piutang dimatikan.' }
    const r = await kirimAman(env, pj.wa, isi, {
      jenis: 'piutang', entitas: 'penjualan', entitasId: pj.id, userId: userId ?? null
    })
    return { ok: r.ok, error: r.error }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

// ---------- 6. Konfirmasi pembayaran cicilan ----------
export async function notifCicilan(
  env: OpenWAEnv,
  penjualanId: number | string,
  jumlah: number,
  sisa: number,
  userId?: number | null
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_piutang'))) return
    const db = env.DB
    const pj = await db.prepare(
      'SELECT pl.nama, pl.wa FROM penjualan pj JOIN pelanggan pl ON pl.id = pj.pelanggan_id WHERE pj.id = ?'
    ).bind(penjualanId).first<any>()
    if (!pj || !normalWA(pj.wa)) return

    const isi = await pesanDariTemplate(db, 'cicilan', {
      nama: pj.nama, jumlah: rupiah(jumlah), sisa: rupiah(sisa),
      lunas_info: sisa <= 0 ? '✅ Piutang Anda sudah LUNAS. Terima kasih!' : 'Mohon lanjutkan pembayaran sisanya.',
      situs: await namaSitus(db)
    })
    if (!isi) return
    await kirimAman(env, pj.wa, isi, {
      jenis: 'cicilan', entitas: 'penjualan', entitasId: penjualanId, userId: userId ?? null
    })
  } catch { /* diamkan */ }
}

// ---------- 7. Slip gaji ----------
export async function notifGaji(
  env: OpenWAEnv,
  data: {
    userId: number; nama: string; wa: string; periode: string;
    hariHadir: number; upahHarian: number; pokok: number;
    bonus: number; potongan: number; total: number
  },
  olehUserId?: number | null
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'openwa_notif_gaji'))) return
    if (!normalWA(data.wa)) return
    const isi = await pesanDariTemplate(env.DB, 'gaji', {
      nama: data.nama, periode: data.periode, hari_hadir: data.hariHadir,
      upah_harian: rupiah(data.upahHarian), pokok: rupiah(data.pokok),
      bonus: rupiah(data.bonus), potongan: rupiah(data.potongan),
      total: rupiah(data.total), situs: await namaSitus(env.DB)
    })
    if (!isi) return
    await kirimAman(env, data.wa, isi, {
      jenis: 'gaji', entitas: 'gaji', entitasId: data.userId, userId: olehUserId ?? null
    })
  } catch { /* diamkan */ }
}

// ============================================================
//  Pengingat harian (lazy-cron)
//  Cloudflare hosted deploy tidak mendukung cron triggers, jadi
//  pengecekan dijalankan "menempel" pada request yang masuk:
//  bila hari ini belum dikirim & sudah lewat jam pengingat → kirim.
// ============================================================
export async function jalankanPengingatHarian(
  env: OpenWAEnv,
  paksa = false
): Promise<{ dijalankan: boolean; terkirim: number; alasan?: string }> {
  try {
    const db = env.DB
    if (!(await bolehKirim(env, 'openwa_notif_piutang'))) {
      return { dijalankan: false, terkirim: 0, alasan: 'Notifikasi piutang tidak aktif.' }
    }
    const hari = hariIniWIB()
    const terakhir = await cfgVal(db, 'openwa_pengingat_terakhir', '')
    const jamTarget = parseInt(await cfgVal(db, 'openwa_jam_pengingat', '8')) || 8

    if (!paksa) {
      if (terakhir === hari) return { dijalankan: false, terkirim: 0, alasan: 'Sudah dikirim hari ini.' }
      // Sedang diproses request lain (kunci sementara) — jangan kirim ganda
      if (terakhir === `proses:${hari}`) return { dijalankan: false, terkirim: 0, alasan: 'Sedang diproses.' }
      if (jamWIB() < jamTarget) return { dijalankan: false, terkirim: 0, alasan: `Menunggu jam ${jamTarget}:00 WIB.` }
    }

    const tandai = (v: string) =>
      db.prepare(
        'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind('openwa_pengingat_terakhir', v).run()

    // KLAIM ATOMIK: dua entry-point (webhook + denyut) sering menembak dalam
    // ~1 detik. Tanpa CAS keduanya lolos cek di atas & ambil daftar piutang yang
    // sama sebelum salah satu jadi 'terkirim' → pelanggan dapat pesan 2×.
    if (!paksa && !(await klaimCfg(db, 'openwa_pengingat_terakhir', terakhir, `proses:${hari}`))) {
      return { dijalankan: false, terkirim: 0, alasan: 'Sedang diproses.' }
    }
    if (paksa) await tandai(`proses:${hari}`)

    // Piutang: terlambat, atau jatuh tempo dalam 2 hari — 1 pesan per piutang per hari
    const { results } = await db.prepare(
      `SELECT pj.id FROM penjualan pj JOIN pelanggan pl ON pl.id = pj.pelanggan_id
       WHERE pj.status_bayar = 'tempo' AND pl.wa IS NOT NULL AND pl.wa != ''
         AND (pj.jatuh_tempo < date('now','+7 hours')
              OR pj.jatuh_tempo BETWEEN date('now','+7 hours') AND date('now','+9 days'))
         AND NOT EXISTS (
           SELECT 1 FROM wa_pesan w WHERE w.entitas = 'penjualan' AND w.entitas_id = CAST(pj.id AS TEXT)
             AND w.jenis = 'piutang' AND w.status = 'terkirim'
             AND date(w.created_at, '+7 hours') = date('now','+7 hours')
         )
       ORDER BY pj.jatuh_tempo LIMIT 20`
    ).all<any>()

    let terkirim = 0
    for (const r of results as any[]) {
      const h = await notifPiutang(env, r.id, null)
      if (h.ok) terkirim++
      await new Promise((res) => setTimeout(res, 1200)) // jeda: hindari flag spam WhatsApp
    }

    if (terkirim > 0 || (results as any[]).length === 0) {
      await tandai(hari)                 // selesai untuk hari ini
      return { dijalankan: true, terkirim }
    }
    await tandai('')                     // semua gagal → boleh dicoba lagi
    return { dijalankan: false, terkirim: 0, alasan: 'Semua pengiriman gagal, akan dicoba lagi.' }
  } catch (e: any) {
    return { dijalankan: false, terkirim: 0, alasan: String(e?.message || e) }
  }
}
