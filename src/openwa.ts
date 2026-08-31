// ============================================================
//  Modul Integrasi OpenWA — WhatsApp API Gateway
//  Repo: https://github.com/rmyndharis/OpenWA
//
//  OpenWA adalah gateway self-hosted (NestJS + whatsapp-web.js/baileys).
//  Hiratake hanya memanggilnya via REST + menerima webhook:
//    Hiratake  --REST + X-API-Key-->  OpenWA  -->  WhatsApp
//    Hiratake  <--webhook + HMAC----  OpenWA
//
//  Konfigurasi (URL, sesi, API key, secret webhook, saklar aktif) bisa
//  diisi lewat environment variable ATAU dari dashboard — env selalu menang.
//  Di VPS: cukup isi semuanya di berkas .env (lihat .env.example), tidak
//  perlu buka dashboard. Kredensial TIDAK PERNAH dikirim ke frontend.
// ============================================================
import { sha256hex } from './auth'

export type OpenWAEnv = {
  DB: D1Database
  OPENWA_URL?: string           // env: URL gateway OpenWA (menang atas dashboard)
  OPENWA_SESSION?: string       // env: nama sessionId di OpenWA
  OPENWA_AKTIF?: string         // env: "1"/"true" = paksa aktif tanpa saklar dashboard
  OPENWA_API_KEY?: string       // secret: X-API-Key untuk OpenWA
  OPENWA_WEBHOOK_SECRET?: string // secret: HMAC-SHA256 verifikasi webhook masuk
}

export type WAConfig = {
  url: string
  session: string
  apiKey: string
  aktif: boolean
}

// ---------- Utilitas nomor WA ----------

/** Normalkan nomor Indonesia ke format 62xxxxxxxxx (angka saja). */
export function normalWA(raw: string | null | undefined): string {
  let n = String(raw || '').replace(/[^0-9]/g, '')
  if (!n) return ''
  if (n.startsWith('620')) n = '62' + n.slice(3)
  else if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  return n
}

export function validWA(n: string): boolean {
  return /^62\d{8,13}$/.test(n)
}

/** chatId format OpenWA untuk chat perorangan. */
export function chatId(wa: string): string {
  return normalWA(wa) + '@c.us'
}

/** Sembunyikan sebagian nomor untuk ditampilkan ke publik: 6281****7890 */
export function sensorWA(wa: string): string {
  const n = normalWA(wa)
  if (n.length < 8) return '****'
  return n.slice(0, 4) + '*'.repeat(Math.max(3, n.length - 8)) + n.slice(-4)
}

// ---------- Konfigurasi ----------

/** Apakah string environment bernilai "menyala"? ("1" atau "true"). */
export const envMenyala = (v: string | undefined): boolean => v === '1' || v === 'true'

export async function getWAConfig(env: OpenWAEnv): Promise<WAConfig> {
  // Alamat & kredensial bisa datang dari environment (diprioritaskan — praktis
  // untuk VPS: semua di .env) atau dari database (diisi lewat dashboard).
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM pengaturan WHERE key IN
     ('openwa_url','openwa_session','openwa_aktif','rahasia_openwa_api_key')`
  ).all<{ key: string; value: string }>()
  const m: Record<string, string> = {}
  for (const r of results) m[r.key] = r.value
  return {
    url: (env.OPENWA_URL || m.openwa_url || '').replace(/\/+$/, ''),
    session: env.OPENWA_SESSION || m.openwa_session || '',
    apiKey: env.OPENWA_API_KEY || m.rahasia_openwa_api_key || '',
    // OPENWA_AKTIF di env memaksa aktif; selain itu ikut saklar dashboard.
    aktif: envMenyala(env.OPENWA_AKTIF) || m.openwa_aktif === '1'
  }
}

/** Apakah integrasi siap dipakai (URL + sesi + API key ada & diaktifkan). */
export function siapKirim(cfg: WAConfig): boolean {
  return cfg.aktif && !!cfg.url && !!cfg.session && !!cfg.apiKey
}

/** Ambil satu nilai pengaturan (helper ringan). */
export async function cfgVal(db: D1Database, key: string, def = ''): Promise<string> {
  const r = await db.prepare('SELECT value FROM pengaturan WHERE key = ?').bind(key).first<any>()
  return r?.value ?? def
}

// ---------- Klien REST OpenWA ----------

async function openwaFetch(
  cfg: WAConfig,
  path: string,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(cfg.url + path, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiKey,
        ...(init.headers || {})
      }
    })
    const text = await res.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text.slice(0, 500) } }
    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`
      return { ok: false, status: res.status, data, error: Array.isArray(msg) ? msg.join(', ') : String(msg) }
    }
    return { ok: true, status: res.status, data }
  } catch (e: any) {
    const err = e?.name === 'AbortError'
      ? 'Gateway OpenWA tidak merespons (timeout). Pastikan VPS hidup & URL bisa diakses dari internet.'
      : `Tidak bisa menghubungi OpenWA: ${e?.message || e}`
    return { ok: false, status: 0, data: null, error: err }
  } finally {
    clearTimeout(timer)
  }
}

/** Status sesi WhatsApp di OpenWA (ready / qr_ready / disconnected / ...). */
export async function statusSesi(cfg: WAConfig) {
  if (!cfg.url || !cfg.session || !cfg.apiKey) {
    return { ok: false, error: 'Konfigurasi OpenWA belum lengkap (URL, sesi, atau API key kosong).' }
  }
  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}`)
  if (!r.ok) return { ok: false, error: r.error }
  const s = r.data?.data ?? r.data
  return { ok: true, status: s?.status || 'unknown', sesi: s }
}

/** Ambil QR code (untuk scan pertama kali dari dashboard). */
export async function ambilQR(cfg: WAConfig) {
  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}/qr`)
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data?.data ?? r.data
  return { ok: true, qr: d?.qr || d?.qrCode || d?.dataUrl || null, raw: d }
}

/** Mulai sesi WhatsApp di OpenWA. */
export async function mulaiSesi(cfg: WAConfig) {
  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}/start`, { method: 'POST' })
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
}

// ---------- Webhook ----------

const WEBHOOK_EVENTS = ['message.received', 'session.status']

/**
 * Daftarkan (atau perbarui) webhook Hiratake di OpenWA.
 * Dipanggil dari server — `secret` tetap di server, tidak pernah lewat browser.
 */
export async function daftarWebhook(cfg: WAConfig, webhookUrl: string, secret: string) {
  if (!cfg.url || !cfg.session || !cfg.apiKey) {
    return { ok: false, error: 'Konfigurasi OpenWA belum lengkap (URL, sesi, atau API key kosong).' }
  }
  if (!secret) return { ok: false, error: 'Webhook secret belum diisi. Simpan dulu di halaman Konfigurasi.' }
  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({ url: webhookUrl, events: WEBHOOK_EVENTS, secret })
  })
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
}

/**
 * Cek apakah webhook Hiratake sudah terdaftar di OpenWA.
 * `terdaftar: null` bila gateway tidak menyediakan daftar webhook (tidak fatal).
 */
export async function cekWebhook(
  cfg: WAConfig,
  webhookUrl: string
): Promise<{ ok: boolean; terdaftar: boolean | null; error?: string }> {
  if (!cfg.url || !cfg.session || !cfg.apiKey) {
    return { ok: false, terdaftar: null, error: 'Konfigurasi OpenWA belum lengkap.' }
  }
  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}/webhooks`)
  if (!r.ok) return { ok: false, terdaftar: null, error: r.error }
  const d = r.data?.data ?? r.data
  const arr = Array.isArray(d) ? d : null
  if (!arr) return { ok: true, terdaftar: null }
  const norm = (u: any) => String(u || '').replace(/\/+$/, '')
  return { ok: true, terdaftar: arr.some((w: any) => norm(w?.url ?? w?.webhookUrl ?? w?.endpoint) === norm(webhookUrl)) }
}

// ---------- Pengiriman pesan (selalu tercatat di wa_pesan) ----------

export type KirimOpts = {
  jenis: string
  entitas?: string
  entitasId?: string | number | null
  userId?: number | null
  /** Lewati pencatatan log (dipakai autoreply agar tidak membanjiri log). */
  tanpaLog?: boolean
}

export type HasilKirim = { ok: boolean; error?: string; messageId?: string; logId?: number }

/**
 * Kirim satu pesan teks lewat OpenWA.
 * Selalu mencatat ke tabel wa_pesan (status menunggu → terkirim/gagal),
 * sehingga kegagalan tidak pernah hilang tanpa jejak.
 */
export async function kirimWA(
  env: OpenWAEnv,
  tujuanRaw: string,
  isi: string,
  opts: KirimOpts
): Promise<HasilKirim> {
  const db = env.DB
  const tujuan = normalWA(tujuanRaw)
  const cfg = await getWAConfig(env)

  const catat = async (status: 'menunggu' | 'terkirim' | 'gagal', error = '', messageId = '') => {
    if (opts.tanpaLog) return 0
    try {
      const r = await db.prepare(
        `INSERT INTO wa_pesan (tujuan, jenis, isi, status, message_id, error, entitas, entitas_id, percobaan, user_id, terkirim_at)
         VALUES (?,?,?,?,?,?,?,?,1,?, CASE WHEN ?='terkirim' THEN datetime('now') ELSE NULL END)`
      ).bind(tujuan, opts.jenis, isi, status, messageId, error, opts.entitas || '',
        String(opts.entitasId ?? ''), opts.userId ?? null, status).run()
      return Number(r.meta.last_row_id)
    } catch { return 0 }
  }

  if (!validWA(tujuan)) {
    const id = await catat('gagal', `Nomor tujuan tidak valid: ${tujuanRaw}`)
    return { ok: false, error: 'Nomor WhatsApp tujuan tidak valid.', logId: id }
  }
  if (!siapKirim(cfg)) {
    const id = await catat('gagal', 'Integrasi WhatsApp belum aktif / konfigurasi belum lengkap.')
    return { ok: false, error: 'Integrasi WhatsApp (OpenWA) belum aktif. Atur di tab WhatsApp.', logId: id }
  }

  const r = await openwaFetch(cfg, `/api/sessions/${encodeURIComponent(cfg.session)}/messages/send-text`, {
    method: 'POST',
    body: JSON.stringify({ chatId: chatId(tujuan), text: isi.slice(0, 4096) })
  })

  if (!r.ok) {
    const id = await catat('gagal', (r.error || 'Gagal kirim').slice(0, 500))
    return { ok: false, error: r.error, logId: id }
  }
  const d = r.data?.data ?? r.data
  const messageId = d?.id || d?.messageId || d?.key?.id || ''
  const id = await catat('terkirim', '', String(messageId))
  return { ok: true, messageId: String(messageId), logId: id }
}

/**
 * Kirim tanpa pernah melempar error — dipakai untuk notifikasi otomatis
 * agar kegagalan WA tidak menggagalkan transaksi bisnis (anti-miss).
 */
export async function kirimAman(
  env: OpenWAEnv,
  tujuan: string,
  isi: string,
  opts: KirimOpts
): Promise<HasilKirim> {
  try {
    return await kirimWA(env, tujuan, isi, opts)
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/** Kirim ke banyak nomor berurutan dengan jeda kecil (hindari flag spam WhatsApp). */
export async function kirimBanyak(
  env: OpenWAEnv,
  daftar: Array<{ wa: string; isi: string }>,
  opts: KirimOpts,
  jedaMs = 1200
): Promise<{ terkirim: number; gagal: number; detail: Array<{ wa: string; ok: boolean; error?: string }> }> {
  let terkirim = 0, gagal = 0
  const detail: Array<{ wa: string; ok: boolean; error?: string }> = []
  for (let i = 0; i < daftar.length; i++) {
    const d = daftar[i]
    const r = await kirimAman(env, d.wa, d.isi, opts)
    r.ok ? terkirim++ : gagal++
    detail.push({ wa: normalWA(d.wa), ok: r.ok, error: r.error })
    if (i < daftar.length - 1) await new Promise((res) => setTimeout(res, jedaMs))
  }
  return { terkirim, gagal, detail }
}

// ---------- Template pesan ----------

/** Isi placeholder {kunci} pada template. Placeholder tak dikenal dikosongkan. */
export function renderTemplate(isi: string, data: Record<string, string | number>): string {
  return isi.replace(/\{(\w+)\}/g, (_, k) => {
    const v = data[k]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** Ambil template dari DB; kembalikan null bila tidak ada / dimatikan. */
export async function ambilTemplate(db: D1Database, kode: string): Promise<string | null> {
  const r = await db.prepare('SELECT isi, aktif FROM wa_template WHERE kode = ?').bind(kode).first<any>()
  if (!r || !r.aktif) return null
  return r.isi as string
}

/** Ambil + render template sekaligus. */
export async function pesanDariTemplate(
  db: D1Database,
  kode: string,
  data: Record<string, string | number>
): Promise<string | null> {
  const t = await ambilTemplate(db, kode)
  if (!t) return null
  return renderTemplate(t, data)
}

// ---------- Format bantu ----------

export const rupiah = (n: any) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

export const tanggalID = (t: string | null | undefined) => {
  if (!t) return '—'
  try {
    return new Date(String(t).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    })
  } catch { return String(t) }
}

/** Tanggal hari ini menurut WIB (UTC+7). */
export const hariIniWIB = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
/** Jam (0-23) sekarang menurut WIB. */
export const jamWIB = () => new Date(Date.now() + 7 * 3600 * 1000).getUTCHours()

/** Rincian item pesanan jadi teks daftar untuk pesan WA. */
export function rincianItem(items: Array<{ nama_produk: string; jumlah: number; harga: number; subtotal: number }>): string {
  return items.map((i) => `• ${i.nama_produk} ${i.jumlah}× @${rupiah(i.harga)} = ${rupiah(i.subtotal)}`).join('\n')
}

/** Nama situs untuk tanda tangan pesan. */
export async function namaSitus(db: D1Database): Promise<string> {
  return (await cfgVal(db, 'situs_nama', 'Hiratake')) || 'Hiratake'
}

// ---------- OTP ----------

const OTP_MENIT = 5

/** Tujuan pemakaian OTP (harus sinkron dengan CHECK di tabel wa_otp). */
export type TujuanOTP = 'login' | 'pesanan' | 'lacak' | 'terima'

const TEMPLATE_OTP: Record<TujuanOTP, string> = {
  login: 'otp_login',
  pesanan: 'otp_pesanan',
  lacak: 'lacak_otp',
  terima: 'terima_otp'
}

/** Buat kode OTP 6 digit acak yang aman (Web Crypto). */
export function kodeOTP(): string {
  const b = new Uint32Array(1)
  crypto.getRandomValues(b)
  return String(b[0] % 1000000).padStart(6, '0')
}

export async function hashOTP(wa: string, kode: string): Promise<string> {
  return sha256hex(normalWA(wa) + ':' + kode)
}

/**
 * Buat OTP dan kirim via WhatsApp.
 * Rate limit: maks 3 OTP per nomor per 10 menit (anti pembobolan & anti-spam WA).
 */
export async function buatDanKirimOTP(
  env: OpenWAEnv,
  wa: string,
  tujuan: TujuanOTP,
  userId?: number | null,
  ekstra?: Record<string, string | number>
): Promise<{ ok: boolean; error?: string; menit?: number }> {
  const db = env.DB
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return { ok: false, error: 'Nomor WhatsApp tidak valid.' }

  const baru = await db.prepare(
    "SELECT COUNT(*) v FROM wa_otp WHERE wa = ? AND tujuan = ? AND created_at > datetime('now','-10 minutes')"
  ).bind(nomor, tujuan).first<any>()
  if ((baru?.v ?? 0) >= 3) {
    return { ok: false, error: 'Terlalu banyak permintaan kode. Tunggu 10 menit lalu coba lagi.' }
  }

  const kode = kodeOTP()
  const situs = await namaSitus(db)
  // Template per tujuan. 'kode_otp' dipakai template baru (lacak/terima) supaya
  // penanda {kode} tetap bisa berarti kode pesanan.
  const isi = (await pesanDariTemplate(db, TEMPLATE_OTP[tujuan], {
    situs, kode, kode_otp: kode, menit: OTP_MENIT, ...(ekstra || {})
  })) || `Kode OTP ${situs}: ${kode} (berlaku ${OTP_MENIT} menit). Jangan bagikan ke siapa pun.`

  const hasil = await kirimWA(env, nomor, isi, {
    jenis: 'otp', entitas: 'auth', entitasId: tujuan, userId: userId ?? null
  })
  if (!hasil.ok) return { ok: false, error: hasil.error || 'Gagal mengirim kode OTP via WhatsApp.' }

  await db.batch([
    // Kode lama untuk nomor+tujuan ini dibatalkan agar hanya kode terbaru berlaku
    db.prepare('UPDATE wa_otp SET dipakai = 1 WHERE wa = ? AND tujuan = ? AND dipakai = 0').bind(nomor, tujuan),
    db.prepare(
      `INSERT INTO wa_otp (wa, kode_hash, tujuan, user_id, expires_at)
       VALUES (?, ?, ?, ?, datetime('now', '+${OTP_MENIT} minutes'))`
    ).bind(nomor, await hashOTP(nomor, kode), tujuan, userId ?? null),
    db.prepare("DELETE FROM wa_otp WHERE expires_at < datetime('now','-1 day')")
  ])
  return { ok: true, menit: OTP_MENIT }
}

/**
 * Verifikasi OTP. Kode hanya boleh dipakai sekali; maks 5 salah-input per kode.
 */
export async function verifikasiOTP(
  db: D1Database,
  wa: string,
  kode: string,
  tujuan: TujuanOTP
): Promise<{ ok: boolean; error?: string; userId?: number | null }> {
  const nomor = normalWA(wa)
  const bersih = String(kode || '').replace(/[^0-9]/g, '')
  if (bersih.length !== 6) return { ok: false, error: 'Kode OTP harus 6 angka.' }

  const row = await db.prepare(
    `SELECT id, kode_hash, user_id, percobaan FROM wa_otp
     WHERE wa = ? AND tujuan = ? AND dipakai = 0 AND expires_at > datetime('now')
     ORDER BY id DESC LIMIT 1`
  ).bind(nomor, tujuan).first<any>()

  if (!row) return { ok: false, error: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa. Minta kode baru.' }
  if ((row.percobaan ?? 0) >= 5) {
    await db.prepare('UPDATE wa_otp SET dipakai = 1 WHERE id = ?').bind(row.id).run()
    return { ok: false, error: 'Kode salah 5 kali. Minta kode baru.' }
  }

  if ((await hashOTP(nomor, bersih)) !== row.kode_hash) {
    await db.prepare('UPDATE wa_otp SET percobaan = percobaan + 1 WHERE id = ?').bind(row.id).run()
    const sisa = 4 - (row.percobaan ?? 0)
    return { ok: false, error: `Kode OTP salah. Sisa percobaan: ${Math.max(0, sisa)}.` }
  }

  await db.prepare('UPDATE wa_otp SET dipakai = 1 WHERE id = ?').bind(row.id).run()
  return { ok: true, userId: row.user_id ?? null }
}

// ---------- Verifikasi webhook (HMAC-SHA256) ----------

/**
 * Verifikasi header X-OpenWA-Signature: sha256=<hex>
 * HMAC dihitung atas RAW BODY memakai secret webhook.
 * Perbandingan constant-time agar tidak bocor lewat timing.
 */
export async function verifikasiTandaTangan(
  rawBody: string,
  header: string | null | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) return false
  const sig = String(header || '').trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(sig)) return false

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')

  // constant-time compare
  if (hex.length !== sig.length) return false
  let beda = 0
  for (let i = 0; i < hex.length; i++) beda |= hex.charCodeAt(i) ^ sig.charCodeAt(i)
  return beda === 0
}
