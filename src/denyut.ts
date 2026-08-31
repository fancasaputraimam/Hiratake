// ============================================================
//  FASE 11 — Denyut Otomatisasi (satu pintu untuk semua route)
//
//  TEMUAN AUDIT (kritis):
//  Sebelumnya `jalankanOtomatisasi()` HANYA dipanggil dari
//  GET /api/admin/ringkasan — artinya seluruh otomatisasi (auto-alpa,
//  ringkasan pagi, housekeeping, sapu tagihan kedaluwarsa, pengingat
//  piutang) baru jalan kalau ada orang yang membuka dashboard.
//  Kalau sehari tidak ada yang login → tidak ada apa pun yang jalan.
//
//  Sekarang setiap request yang wajar (halaman depan, checkout, halaman
//  bayar, lacak, API produk, dashboard, absensi) ikut "memberi denyut".
//  Karena Cloudflare hosted deploy tidak mendukung cron trigger, pola
//  lazy-cron inilah pengganti cron — dan dengan banyak pintu masuk
//  peluang otomatisasi terlewat menjadi sangat kecil.
//
//  Semua pekerjaan berjalan di `waitUntil`, jadi TIDAK PERNAH
//  memperlambat atau menggagalkan response ke pengunjung.
// ============================================================
import { jalankanOtomatisasi } from './otomatis'
import type { OpenWAEnv } from './openwa'

/**
 * Picu seluruh otomatisasi harian tanpa menunggu hasilnya.
 * Aman dipanggil dari route mana pun, sesering apa pun.
 *
 * @param c  Context Hono
 * @param sumber label untuk audit/monitor (mis. 'landing', 'checkout')
 */
export function denyutOtomatisasi(c: any, sumber: string): void {
  const env = c.env as OpenWAEnv
  // `jalankanOtomatisasi` sudah mencakup pengingat piutang & sapu tagihan
  // kedaluwarsa, semuanya di balik satu kunci atomik — jadi cukup panggil ini.
  const tugas = Promise.resolve(jalankanOtomatisasi(env, sumber)).catch(() => {})

  // waitUntil = jalan di belakang setelah response terkirim.
  // Bila runtime tidak menyediakannya, jangan sampai error menjalar.
  try {
    if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(tugas)
    else tugas.catch(() => {})
  } catch {
    tugas.catch(() => {})
  }
}

/**
 * Middleware Hono: pasang sekali, semua route ikut memberi denyut.
 * Hanya untuk request GET yang bukan aset statis, agar tidak ada
 * pekerjaan sia-sia pada permintaan gambar/CSS/JS.
 */
export function middlewareDenyut() {
  return async (c: any, next: any) => {
    await next()
    try {
      if (c.req.method !== 'GET') return
      const p = new URL(c.req.url).pathname
      if (p.startsWith('/static/') || p.startsWith('/__') || /\.\w{2,5}$/.test(p)) return
      denyutOtomatisasi(c, `auto:${p}`)
    } catch {
      /* denyut tidak boleh mengganggu response */
    }
  }
}
