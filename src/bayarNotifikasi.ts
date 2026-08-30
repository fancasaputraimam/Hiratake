// ============================================================
//  Notifikasi WhatsApp untuk peristiwa pembayaran.
//  Semua fungsi "aman gagal": kegagalan WhatsApp TIDAK boleh
//  menggagalkan pencatatan pembayaran (anti-miss).
// ============================================================
import {
  type OpenWAEnv, kirimAman, pesanDariTemplate, namaSitus, cfgVal,
  rupiah, rincianItem, normalWA, getWAConfig, siapKirim, tanggalID
} from './openwa'

async function bolehKirim(env: OpenWAEnv, kunci: string): Promise<boolean> {
  const cfg = await getWAConfig(env)
  if (!siapKirim(cfg)) return false
  return (await cfgVal(env.DB, kunci, '1')) === '1'
}

const labelMetode: Record<string, string> = {
  cash: 'Tunai / COD',
  qris: 'QRIS',
  transfer: 'Transfer Bank'
}

/** Waktu sekarang menurut WIB, format "29 Agu 2026 14:35". */
function waktuWIB(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${d.getUTCDate()} ${bulan[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} WIB`
}

/** Ambil data pesanan + item + pelanggan untuk pesan. */
async function dataPesanan(db: D1Database, pesananId: number | string) {
  const ps = await db.prepare(
    `SELECT ps.id, ps.kode, ps.metode_bayar, ps.total_bayar, ps.ongkir, ps.biaya_admin,
            ps.token_lacak, ps.tanggal_kirim, pl.nama, pl.wa
     FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
  ).bind(pesananId).first<any>()
  if (!ps) return null
  const { results: items } = await db.prepare(
    'SELECT nama_produk, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?'
  ).bind(ps.id).all<any>()
  return { ps, items: items as any[] }
}

function rincianLengkap(items: any[], ongkir: number, biaya: number, total: number): string {
  let t = rincianItem(items)
  if (ongkir > 0) t += `\n• Ongkir = ${rupiah(ongkir)}`
  if (biaya > 0) t += `\n• Biaya layanan = ${rupiah(biaya)}`
  t += `\n*Total: ${rupiah(total)}*`
  return t
}

// ---------- 1. Menunggu pembayaran QRIS ----------
export async function notifBayarMenunggu(
  env: OpenWAEnv,
  pesananId: number | string,
  linkBayar: string,
  batasWaktu: string
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'bayar_notif_menunggu'))) return
    const d = await dataPesanan(env.DB, pesananId)
    if (!d || !normalWA(d.ps.wa)) return
    const isi = await pesanDariTemplate(env.DB, 'bayar_menunggu', {
      situs: await namaSitus(env.DB),
      nama: d.ps.nama,
      kode: d.ps.kode,
      total: rupiah(d.ps.total_bayar),
      rincian: rincianLengkap(d.items, d.ps.ongkir, d.ps.biaya_admin, d.ps.total_bayar),
      link: linkBayar,
      batas: batasWaktu
    })
    if (!isi) return
    await kirimAman(env, d.ps.wa, isi, {
      jenis: 'bayar_menunggu', entitas: 'pesanan', entitasId: d.ps.kode
    })
  } catch { /* aman gagal */ }
}

// ---------- 2. Pembayaran diterima (ke pelanggan) ----------
export async function notifBayarLunas(
  env: OpenWAEnv,
  pesananId: number | string,
  metode: string,
  linkLacak: string
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'bayar_notif_lunas'))) return
    const d = await dataPesanan(env.DB, pesananId)
    if (!d || !normalWA(d.ps.wa)) return
    const isi = await pesanDariTemplate(env.DB, 'bayar_lunas', {
      situs: await namaSitus(env.DB),
      nama: d.ps.nama,
      kode: d.ps.kode,
      total: rupiah(d.ps.total_bayar),
      metode: labelMetode[metode] || metode,
      waktu: waktuWIB(),
      rincian: rincianLengkap(d.items, d.ps.ongkir, d.ps.biaya_admin, d.ps.total_bayar),
      link: linkLacak
    })
    if (!isi) return
    await kirimAman(env, d.ps.wa, isi, {
      jenis: 'bayar_lunas', entitas: 'pesanan', entitasId: d.ps.kode
    })
  } catch { /* aman gagal */ }
}

// ---------- 3. Pembayaran kedaluwarsa ----------
export async function notifBayarKedaluwarsa(env: OpenWAEnv, pesananId: number | string): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'bayar_notif_menunggu'))) return
    const d = await dataPesanan(env.DB, pesananId)
    if (!d || !normalWA(d.ps.wa)) return
    const isi = await pesanDariTemplate(env.DB, 'bayar_kedaluwarsa', {
      situs: await namaSitus(env.DB), nama: d.ps.nama, kode: d.ps.kode,
      total: rupiah(d.ps.total_bayar)
    })
    if (!isi) return
    await kirimAman(env, d.ps.wa, isi, {
      jenis: 'bayar_kedaluwarsa', entitas: 'pesanan', entitasId: d.ps.kode
    })
  } catch { /* aman gagal */ }
}

// ---------- 4. Kabar kas masuk ke owner/admin ----------
export async function notifBayarInternal(
  env: OpenWAEnv,
  pesananId: number | string,
  metode: string
): Promise<void> {
  try {
    if (!(await bolehKirim(env, 'bayar_notif_internal'))) return
    const d = await dataPesanan(env.DB, pesananId)
    if (!d) return
    const { results: staf } = await env.DB.prepare(
      "SELECT wa FROM users WHERE role IN ('owner','admin') AND aktif = 1 AND COALESCE(wa,'') != ''"
    ).all<any>()
    if (!staf.length) return
    const isi = await pesanDariTemplate(env.DB, 'bayar_internal', {
      situs: await namaSitus(env.DB), kode: d.ps.kode, nama: d.ps.nama,
      metode: labelMetode[metode] || metode, total: rupiah(d.ps.total_bayar), waktu: waktuWIB()
    })
    if (!isi) return
    for (const s of staf as any[]) {
      await kirimAman(env, s.wa, isi, {
        jenis: 'bayar_internal', entitas: 'pesanan', entitasId: d.ps.kode
      })
      await new Promise((r) => setTimeout(r, 800))
    }
  } catch { /* aman gagal */ }
}

// ---------- 5. Konfirmasi barang diterima ----------
export async function notifTerimaSelesai(env: OpenWAEnv, pesananId: number | string): Promise<void> {
  try {
    const cfg = await getWAConfig(env)
    if (!siapKirim(cfg)) return
    const d = await dataPesanan(env.DB, pesananId)
    if (!d || !normalWA(d.ps.wa)) return
    const isi = await pesanDariTemplate(env.DB, 'terima_selesai', {
      situs: await namaSitus(env.DB), kode: d.ps.kode, nama: d.ps.nama, waktu: waktuWIB()
    })
    if (!isi) return
    await kirimAman(env, d.ps.wa, isi, {
      jenis: 'terima_selesai', entitas: 'pesanan', entitasId: d.ps.kode
    })
  } catch { /* aman gagal */ }
}

/**
 * Lazy-cron pembayaran: tandai transaksi QRIS yang melewati batas waktu
 * sebagai kedaluwarsa dan batalkan pesanannya (hosted deploy tidak
 * mendukung cron trigger, jadi ini menempel pada request yang masuk).
 */
export async function bersihkanBayarKedaluwarsa(env: OpenWAEnv): Promise<{ kedaluwarsa: number }> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, pesanan_id FROM pembayaran
       WHERE status = 'menunggu' AND expires_at IS NOT NULL AND expires_at < datetime('now')
       LIMIT 30`
    ).all<any>()
    if (!results.length) return { kedaluwarsa: 0 }

    const stmts: any[] = []
    for (const p of results as any[]) {
      stmts.push(env.DB.prepare(
        "UPDATE pembayaran SET status='kedaluwarsa', updated_at=CURRENT_TIMESTAMP WHERE id = ? AND status='menunggu'"
      ).bind(p.id))
      // Pesanan yang belum dibayar & belum diproses ikut dibatalkan
      stmts.push(env.DB.prepare(
        `UPDATE pesanan SET status='batal', status_bayar='kedaluwarsa'
         WHERE id = ? AND status_bayar = 'menunggu' AND status = 'baru'`
      ).bind(p.pesanan_id))
    }
    await env.DB.batch(stmts)
    for (const p of results as any[]) await notifBayarKedaluwarsa(env, p.pesanan_id)
    return { kedaluwarsa: results.length }
  } catch {
    return { kedaluwarsa: 0 }
  }
}

export { waktuWIB, labelMetode }
