// ============================================================
//  Modul Pembayaran Universal (Payment Gateway Adapter)
//
//  Satu antarmuka, banyak provider. Owner memilih provider di
//  dashboard; kode pemanggil (checkout) tidak berubah.
//
//    manual   → QRIS statis milik sendiri (tanpa gateway, gratis)
//    midtrans → Midtrans Core API (QRIS / GoPay)
//    xendit   → Xendit QR Code API
//    duitku   → Duitku Inquiry (SP / QRIS)
//    tripay   → Tripay Transaction Create (QRIS)
//
//  SEMUA kredensial disimpan sebagai Cloudflare secret / .dev.vars,
//  TIDAK PERNAH dikirim ke browser:
//    BAYAR_SERVER_KEY  → server key / secret key / API key provider
//    BAYAR_CLIENT_KEY  → client key (opsional, sebagian provider)
//    BAYAR_CALLBACK_SECRET → secret verifikasi callback (Tripay/Duitku/Xendit)
// ============================================================
import { sha256hex } from './auth'
import { cfgVal, type OpenWAEnv } from './openwa'

export type BayarEnv = OpenWAEnv & {
  BAYAR_SERVER_KEY?: string
  BAYAR_CLIENT_KEY?: string
  BAYAR_CALLBACK_SECRET?: string
}

export type ProviderId = 'manual' | 'midtrans' | 'xendit' | 'duitku' | 'tripay'

export type BayarConfig = {
  aktif: boolean
  cash: boolean
  qris: boolean
  provider: ProviderId
  mode: 'sandbox' | 'produksi'
  merchantKode: string
  channel: string
  qrisGambar: string
  qrisNama: string
  kedaluwarsaMenit: number
  biayaMode: 'serap' | 'bebankan'
  biayaPersen: number
  biayaTetap: number
  minQris: number
  maksQris: number
  ongkir: number
  ongkirGratisMin: number
  instruksiCash: string
  serverKey: string
  clientKey: string
  callbackSecret: string
}

export const PROVIDER_INFO: Record<ProviderId, { nama: string; butuhKey: boolean; catatan: string }> = {
  manual: {
    nama: 'QRIS Statis (tanpa gateway)',
    butuhKey: false,
    catatan: 'Pakai gambar QRIS milik Anda sendiri. Gratis, tapi pembayaran harus diverifikasi manual oleh admin.'
  },
  midtrans: {
    nama: 'Midtrans (Core API — QRIS/GoPay)',
    butuhKey: true,
    catatan: 'BAYAR_SERVER_KEY = Server Key Midtrans. Callback: Payment Notification URL di dashboard Midtrans.'
  },
  xendit: {
    nama: 'Xendit (QR Code)',
    butuhKey: true,
    catatan: 'BAYAR_SERVER_KEY = Secret API Key Xendit. BAYAR_CALLBACK_SECRET = Callback Verification Token.'
  },
  duitku: {
    nama: 'Duitku (QRIS / Semua Channel)',
    butuhKey: true,
    catatan: 'BAYAR_SERVER_KEY = API Key Duitku, Kode Merchant diisi di kolom bawah. Callback pakai MD5 signature.'
  },
  tripay: {
    nama: 'Tripay (QRIS)',
    butuhKey: true,
    catatan: 'BAYAR_SERVER_KEY = API Key, BAYAR_CALLBACK_SECRET = Private Key. Kode Merchant = Merchant Code Tripay.'
  }
}

// ---------- Konfigurasi ----------

const KUNCI_BAYAR = [
  'bayar_aktif', 'bayar_cash', 'bayar_qris', 'bayar_provider', 'bayar_mode',
  'bayar_merchant_kode', 'bayar_channel', 'bayar_qris_gambar', 'bayar_qris_nama',
  'bayar_kedaluwarsa_menit', 'bayar_biaya_mode', 'bayar_biaya_persen', 'bayar_biaya_tetap',
  'bayar_min_qris', 'bayar_maks_qris', 'bayar_ongkir', 'bayar_ongkir_gratis_min',
  'bayar_instruksi_cash'
]

export async function getBayarConfig(env: BayarEnv): Promise<BayarConfig> {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM pengaturan WHERE key LIKE 'bayar_%'`
  ).all<{ key: string; value: string }>()
  const m: Record<string, string> = {}
  for (const r of results) m[r.key] = r.value

  const provider = (PROVIDER_INFO as any)[m.bayar_provider] ? (m.bayar_provider as ProviderId) : 'manual'
  const num = (k: string, def: number) => {
    const v = parseFloat(m[k] ?? '')
    return isNaN(v) ? def : v
  }
  return {
    aktif: m.bayar_aktif !== '0',
    cash: m.bayar_cash !== '0',
    qris: m.bayar_qris !== '0',
    provider,
    mode: m.bayar_mode === 'produksi' ? 'produksi' : 'sandbox',
    merchantKode: m.bayar_merchant_kode || '',
    channel: m.bayar_channel || 'qris',
    qrisGambar: m.bayar_qris_gambar || '',
    qrisNama: m.bayar_qris_nama || '',
    kedaluwarsaMenit: Math.min(1440, Math.max(5, num('bayar_kedaluwarsa_menit', 60))),
    biayaMode: m.bayar_biaya_mode === 'bebankan' ? 'bebankan' : 'serap',
    biayaPersen: Math.max(0, Math.min(10, num('bayar_biaya_persen', 0.7))),
    biayaTetap: Math.max(0, num('bayar_biaya_tetap', 0)),
    minQris: Math.max(0, num('bayar_min_qris', 10000)),
    maksQris: Math.max(0, num('bayar_maks_qris', 5000000)),
    ongkir: Math.max(0, num('bayar_ongkir', 0)),
    ongkirGratisMin: Math.max(0, num('bayar_ongkir_gratis_min', 0)),
    instruksiCash: m.bayar_instruksi_cash || 'Bayar tunai saat barang diterima.',
    serverKey: env.BAYAR_SERVER_KEY || '',
    clientKey: env.BAYAR_CLIENT_KEY || '',
    callbackSecret: env.BAYAR_CALLBACK_SECRET || ''
  }
}

export { KUNCI_BAYAR }

/** Apakah metode QRIS bisa dipakai sekarang? */
export function qrisSiap(cfg: BayarConfig): { ok: boolean; alasan?: string } {
  if (!cfg.aktif) return { ok: false, alasan: 'Pembayaran online sedang dinonaktifkan.' }
  if (!cfg.qris) return { ok: false, alasan: 'Metode QRIS sedang dinonaktifkan pemilik usaha.' }
  if (cfg.provider === 'manual') {
    if (!cfg.qrisGambar) return { ok: false, alasan: 'Gambar QRIS belum diunggah pemilik usaha.' }
    return { ok: true }
  }
  if (!cfg.serverKey) return { ok: false, alasan: 'Kredensial payment gateway belum dipasang di server.' }
  if ((cfg.provider === 'duitku' || cfg.provider === 'tripay') && !cfg.merchantKode) {
    return { ok: false, alasan: 'Kode merchant payment gateway belum diisi.' }
  }
  return { ok: true }
}

/** Biaya admin gateway yang dibebankan ke pelanggan (0 bila diserap penjual). */
export function hitungBiayaAdmin(cfg: BayarConfig, subtotal: number): number {
  if (cfg.biayaMode !== 'bebankan') return 0
  return Math.round(subtotal * (cfg.biayaPersen / 100) + cfg.biayaTetap)
}

/** Ongkir sesuai aturan owner (gratis bila subtotal >= batas). */
export function hitungOngkir(cfg: BayarConfig, subtotal: number): number {
  if (!cfg.ongkir) return 0
  if (cfg.ongkirGratisMin > 0 && subtotal >= cfg.ongkirGratisMin) return 0
  return Math.round(cfg.ongkir)
}

// ---------- Hasil pembuatan tagihan ----------

export type HasilTagihan = {
  ok: boolean
  error?: string
  refId?: string
  qrString?: string   // payload QRIS mentah (bisa dirender jadi QR di browser)
  qrUrl?: string      // gambar QR siap tampil
  bayarUrl?: string   // halaman bayar provider (bila ada)
  instruksi?: string
  respons?: string    // JSON mentah untuk audit
}

async function ambilJson(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    const text = await res.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text.slice(0, 800) } }
    if (!res.ok) {
      const msg = data?.error_messages?.join?.(', ') || data?.status_message || data?.message ||
        data?.Message || data?.statusMessage || `HTTP ${res.status}`
      return { ok: false, status: res.status, data, error: String(msg) }
    }
    return { ok: true, status: res.status, data }
  } catch (e: any) {
    return {
      ok: false, status: 0, data: null,
      error: e?.name === 'AbortError'
        ? 'Payment gateway tidak merespons (timeout). Coba lagi atau pilih bayar tunai.'
        : `Tidak bisa menghubungi payment gateway: ${e?.message || e}`
    }
  } finally { clearTimeout(timer) }
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))

async function md5hex(text: string): Promise<string> {
  // Duitku memakai MD5. Web Crypto tidak menyediakan MD5, jadi
  // implementasi ringkas di sini (hanya untuk signature, bukan keamanan data).
  return md5(text)
}

// MD5 murni JS (ringkas) — dipakai HANYA untuk signature Duitku.
function md5(str: string): string {
  const rl = (n: number, c: number) => (n << c) | (n >>> (32 - c))
  const au = (x: number, y: number) => {
    const l = (x & 0xFFFF) + (y & 0xFFFF)
    return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF)
  }
  const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) =>
    au(rl(au(au(a, q), au(x, t)), s), b)
  const ff = (a: number, b: number, cc: number, d: number, x: number, s: number, t: number) =>
    cmn((b & cc) | (~b & d), a, b, x, s, t)
  const gg = (a: number, b: number, cc: number, d: number, x: number, s: number, t: number) =>
    cmn((b & d) | (cc & ~d), a, b, x, s, t)
  const hh = (a: number, b: number, cc: number, d: number, x: number, s: number, t: number) =>
    cmn(b ^ cc ^ d, a, b, x, s, t)
  const ii = (a: number, b: number, cc: number, d: number, x: number, s: number, t: number) =>
    cmn(cc ^ (b | ~d), a, b, x, s, t)

  const bytes = new TextEncoder().encode(str)
  const n = bytes.length
  const words: number[] = []
  for (let i = 0; i < n; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8))
  words[n >> 2] = (words[n >> 2] || 0) | (0x80 << ((n % 4) * 8))
  const len = (((n + 8) >> 6) + 1) * 16
  while (words.length < len) words.push(0)
  words[len - 2] = n * 8

  let a = 1732584193, b = -271733879, cc = -1732584194, d = 271733878
  for (let i = 0; i < len; i += 16) {
    const oa = a, ob = b, oc = cc, od = d
    a = ff(a, b, cc, d, words[i], 7, -680876936); d = ff(d, a, b, cc, words[i + 1], 12, -389564586)
    cc = ff(cc, d, a, b, words[i + 2], 17, 606105819); b = ff(b, cc, d, a, words[i + 3], 22, -1044525330)
    a = ff(a, b, cc, d, words[i + 4], 7, -176418897); d = ff(d, a, b, cc, words[i + 5], 12, 1200080426)
    cc = ff(cc, d, a, b, words[i + 6], 17, -1473231341); b = ff(b, cc, d, a, words[i + 7], 22, -45705983)
    a = ff(a, b, cc, d, words[i + 8], 7, 1770035416); d = ff(d, a, b, cc, words[i + 9], 12, -1958414417)
    cc = ff(cc, d, a, b, words[i + 10], 17, -42063); b = ff(b, cc, d, a, words[i + 11], 22, -1990404162)
    a = ff(a, b, cc, d, words[i + 12], 7, 1804603682); d = ff(d, a, b, cc, words[i + 13], 12, -40341101)
    cc = ff(cc, d, a, b, words[i + 14], 17, -1502002290); b = ff(b, cc, d, a, words[i + 15], 22, 1236535329)

    a = gg(a, b, cc, d, words[i + 1], 5, -165796510); d = gg(d, a, b, cc, words[i + 6], 9, -1069501632)
    cc = gg(cc, d, a, b, words[i + 11], 14, 643717713); b = gg(b, cc, d, a, words[i], 20, -373897302)
    a = gg(a, b, cc, d, words[i + 5], 5, -701558691); d = gg(d, a, b, cc, words[i + 10], 9, 38016083)
    cc = gg(cc, d, a, b, words[i + 15], 14, -660478335); b = gg(b, cc, d, a, words[i + 4], 20, -405537848)
    a = gg(a, b, cc, d, words[i + 9], 5, 568446438); d = gg(d, a, b, cc, words[i + 14], 9, -1019803690)
    cc = gg(cc, d, a, b, words[i + 3], 14, -187363961); b = gg(b, cc, d, a, words[i + 8], 20, 1163531501)
    a = gg(a, b, cc, d, words[i + 13], 5, -1444681467); d = gg(d, a, b, cc, words[i + 2], 9, -51403784)
    cc = gg(cc, d, a, b, words[i + 7], 14, 1735328473); b = gg(b, cc, d, a, words[i + 12], 20, -1926607734)

    a = hh(a, b, cc, d, words[i + 5], 4, -378558); d = hh(d, a, b, cc, words[i + 8], 11, -2022574463)
    cc = hh(cc, d, a, b, words[i + 11], 16, 1839030562); b = hh(b, cc, d, a, words[i + 14], 23, -35309556)
    a = hh(a, b, cc, d, words[i + 1], 4, -1530992060); d = hh(d, a, b, cc, words[i + 4], 11, 1272893353)
    cc = hh(cc, d, a, b, words[i + 7], 16, -155497632); b = hh(b, cc, d, a, words[i + 10], 23, -1094730640)
    a = hh(a, b, cc, d, words[i + 13], 4, 681279174); d = hh(d, a, b, cc, words[i], 11, -358537222)
    cc = hh(cc, d, a, b, words[i + 3], 16, -722521979); b = hh(b, cc, d, a, words[i + 6], 23, 76029189)
    a = hh(a, b, cc, d, words[i + 9], 4, -640364487); d = hh(d, a, b, cc, words[i + 12], 11, -421815835)
    cc = hh(cc, d, a, b, words[i + 15], 16, 530742520); b = hh(b, cc, d, a, words[i + 2], 23, -995338651)

    a = ii(a, b, cc, d, words[i], 6, -198630844); d = ii(d, a, b, cc, words[i + 7], 10, 1126891415)
    cc = ii(cc, d, a, b, words[i + 14], 15, -1416354905); b = ii(b, cc, d, a, words[i + 5], 21, -57434055)
    a = ii(a, b, cc, d, words[i + 12], 6, 1700485571); d = ii(d, a, b, cc, words[i + 3], 10, -1894986606)
    cc = ii(cc, d, a, b, words[i + 10], 15, -1051523); b = ii(b, cc, d, a, words[i + 1], 21, -2054922799)
    a = ii(a, b, cc, d, words[i + 8], 6, 1873313359); d = ii(d, a, b, cc, words[i + 15], 10, -30611744)
    cc = ii(cc, d, a, b, words[i + 6], 15, -1560198380); b = ii(b, cc, d, a, words[i + 13], 21, 1309151649)
    a = ii(a, b, cc, d, words[i + 4], 6, -145523070); d = ii(d, a, b, cc, words[i + 11], 10, -1120210379)
    cc = ii(cc, d, a, b, words[i + 2], 15, 718787259); b = ii(b, cc, d, a, words[i + 9], 21, -343485551)

    a = au(a, oa); b = au(b, ob); cc = au(cc, oc); d = au(d, od)
  }
  const hex = (num: number) => {
    let s = ''
    for (let j = 0; j < 4; j++) s += ((num >> (j * 8 + 4)) & 0x0F).toString(16) + ((num >> (j * 8)) & 0x0F).toString(16)
    return s
  }
  return hex(a) + hex(b) + hex(cc) + hex(d)
}

/** HMAC-SHA256 hex (dipakai Tripay & verifikasi callback). */
export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(mac)).map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Perbandingan constant-time untuk hex signature. */
export function samaAman(a: string, b: string): boolean {
  const x = String(a || '').toLowerCase(), y = String(b || '').toLowerCase()
  if (!x || x.length !== y.length) return false
  let beda = 0
  for (let i = 0; i < x.length; i++) beda |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return beda === 0
}

// ---------- Pembuatan tagihan per provider ----------

export type DataTagihan = {
  kodePembayaran: string     // referensi kita (dipakai sebagai order_id di provider)
  kodePesanan: string
  jumlah: number             // rupiah bulat
  namaPelanggan: string
  waPelanggan: string
  emailPelanggan?: string
  item: Array<{ nama: string; harga: number; jumlah: number }>
  kedaluwarsaMenit: number
  urlKembali: string         // halaman status bayar kita
  urlCallback: string        // endpoint callback kita
}

export async function buatTagihan(
  cfg: BayarConfig,
  d: DataTagihan
): Promise<HasilTagihan> {
  switch (cfg.provider) {
    case 'manual': return tagihanManual(cfg, d)
    case 'midtrans': return tagihanMidtrans(cfg, d)
    case 'xendit': return tagihanXendit(cfg, d)
    case 'duitku': return tagihanDuitku(cfg, d)
    case 'tripay': return tagihanTripay(cfg, d)
    default: return { ok: false, error: 'Provider pembayaran tidak dikenali.' }
  }
}

// --- manual: QRIS statis milik sendiri ---
function tagihanManual(cfg: BayarConfig, d: DataTagihan): HasilTagihan {
  return {
    ok: true,
    refId: d.kodePembayaran,
    qrUrl: cfg.qrisGambar,
    instruksi:
      `Scan QRIS di atas${cfg.qrisNama ? ` (a.n. ${cfg.qrisNama})` : ''}, bayar tepat sejumlah tagihan, ` +
      `lalu kirim bukti transfer via WhatsApp. Admin akan memverifikasi.`,
    respons: JSON.stringify({ provider: 'manual', catatan: 'QRIS statis, verifikasi manual admin' })
  }
}

// --- Midtrans Core API: charge QRIS ---
async function tagihanMidtrans(cfg: BayarConfig, d: DataTagihan): Promise<HasilTagihan> {
  const base = cfg.mode === 'produksi' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  const r = await ambilJson(base + '/v2/charge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Basic ' + b64(cfg.serverKey + ':')
    },
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: d.kodePembayaran, gross_amount: d.jumlah },
      qris: { acquirer: 'gopay' },
      customer_details: { first_name: d.namaPelanggan.slice(0, 40), phone: d.waPelanggan },
      item_details: d.item.map((i, idx) => ({
        id: String(idx + 1), name: i.nama.slice(0, 50), price: i.harga, quantity: i.jumlah
      })),
      custom_expiry: { unit: 'minute', expiry_duration: d.kedaluwarsaMenit }
    })
  })
  if (!r.ok) return { ok: false, error: r.error }
  const actions: any[] = r.data?.actions || []
  const qr = actions.find((a) => a.name === 'generate-qr-code')
  if (String(r.data?.status_code || '') >= '400') {
    return { ok: false, error: r.data?.status_message || 'Midtrans menolak transaksi.' }
  }
  return {
    ok: true,
    refId: r.data?.transaction_id || d.kodePembayaran,
    qrUrl: qr?.url || '',
    qrString: r.data?.qr_string || '',
    instruksi: 'Scan QRIS dengan aplikasi bank/e-wallet apa pun. Status otomatis terbarui setelah dibayar.',
    respons: JSON.stringify(r.data).slice(0, 4000)
  }
}

// --- Xendit QR Code ---
async function tagihanXendit(cfg: BayarConfig, d: DataTagihan): Promise<HasilTagihan> {
  const r = await ambilJson('https://api.xendit.co/qr_codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-version': '2022-07-31',
      Authorization: 'Basic ' + b64(cfg.serverKey + ':')
    },
    body: JSON.stringify({
      reference_id: d.kodePembayaran,
      type: 'DYNAMIC',
      currency: 'IDR',
      amount: d.jumlah,
      expires_at: new Date(Date.now() + d.kedaluwarsaMenit * 60000).toISOString()
    })
  })
  if (!r.ok) return { ok: false, error: r.error }
  return {
    ok: true,
    refId: r.data?.id || d.kodePembayaran,
    qrString: r.data?.qr_string || '',
    instruksi: 'Scan QRIS dengan aplikasi bank/e-wallet apa pun. Status otomatis terbarui setelah dibayar.',
    respons: JSON.stringify(r.data).slice(0, 4000)
  }
}

// --- Duitku Inquiry ---
async function tagihanDuitku(cfg: BayarConfig, d: DataTagihan): Promise<HasilTagihan> {
  const base = cfg.mode === 'produksi'
    ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry'
    : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'
  const signature = await md5hex(cfg.merchantKode + d.kodePembayaran + d.jumlah + cfg.serverKey)
  const r = await ambilJson(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCode: cfg.merchantKode,
      paymentAmount: d.jumlah,
      paymentMethod: (cfg.channel || 'SP').toUpperCase() === 'QRIS' ? 'SP' : (cfg.channel || 'SP').toUpperCase(),
      merchantOrderId: d.kodePembayaran,
      productDetails: `Pesanan ${d.kodePesanan}`,
      customerVaName: d.namaPelanggan.slice(0, 40),
      phoneNumber: d.waPelanggan,
      callbackUrl: d.urlCallback,
      returnUrl: d.urlKembali,
      signature,
      expiryPeriod: d.kedaluwarsaMenit
    })
  })
  if (!r.ok) return { ok: false, error: r.error }
  if (String(r.data?.statusCode || '') !== '00') {
    return { ok: false, error: r.data?.statusMessage || 'Duitku menolak transaksi.' }
  }
  return {
    ok: true,
    refId: r.data?.reference || d.kodePembayaran,
    qrString: r.data?.qrString || '',
    bayarUrl: r.data?.paymentUrl || '',
    instruksi: 'Scan QRIS atau buka halaman pembayaran. Status otomatis terbarui setelah dibayar.',
    respons: JSON.stringify(r.data).slice(0, 4000)
  }
}

// --- Tripay Transaction Create ---
async function tagihanTripay(cfg: BayarConfig, d: DataTagihan): Promise<HasilTagihan> {
  const base = cfg.mode === 'produksi'
    ? 'https://tripay.co.id/api/transaction/create'
    : 'https://tripay.co.id/api-sandbox/transaction/create'
  const signature = await hmacSha256Hex(
    cfg.callbackSecret || cfg.serverKey,
    cfg.merchantKode + d.kodePembayaran + d.jumlah
  )
  const r = await ambilJson(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.serverKey },
    body: JSON.stringify({
      method: (cfg.channel || 'QRIS').toUpperCase() === 'QRIS' ? 'QRIS' : (cfg.channel || 'QRIS').toUpperCase(),
      merchant_ref: d.kodePembayaran,
      amount: d.jumlah,
      customer_name: d.namaPelanggan.slice(0, 40),
      customer_phone: d.waPelanggan,
      customer_email: d.emailPelanggan || 'pelanggan@example.com',
      order_items: d.item.map((i) => ({ name: i.nama.slice(0, 50), price: i.harga, quantity: i.jumlah })),
      return_url: d.urlKembali,
      expired_time: Math.floor(Date.now() / 1000) + d.kedaluwarsaMenit * 60,
      signature
    })
  })
  if (!r.ok) return { ok: false, error: r.error }
  if (r.data?.success === false) return { ok: false, error: r.data?.message || 'Tripay menolak transaksi.' }
  const t = r.data?.data || {}
  return {
    ok: true,
    refId: t.reference || d.kodePembayaran,
    qrString: t.qr_string || '',
    qrUrl: t.qr_url || '',
    bayarUrl: t.checkout_url || '',
    instruksi: 'Scan QRIS dengan aplikasi bank/e-wallet apa pun. Status otomatis terbarui setelah dibayar.',
    respons: JSON.stringify(t).slice(0, 4000)
  }
}

// ---------- Cek status ke provider (polling cadangan) ----------

export type HasilStatus = { ok: boolean; error?: string; status?: 'menunggu' | 'dibayar' | 'kedaluwarsa' | 'gagal'; mentah?: string }

export async function cekStatusTagihan(
  cfg: BayarConfig,
  kodePembayaran: string,
  refId: string
): Promise<HasilStatus> {
  if (cfg.provider === 'manual') return { ok: true, status: 'menunggu' }

  if (cfg.provider === 'midtrans') {
    const base = cfg.mode === 'produksi' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
    const r = await ambilJson(base + `/v2/${encodeURIComponent(kodePembayaran)}/status`, {
      headers: { Accept: 'application/json', Authorization: 'Basic ' + b64(cfg.serverKey + ':') }
    })
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, status: petaStatusMidtrans(r.data?.transaction_status), mentah: JSON.stringify(r.data).slice(0, 2000) }
  }

  if (cfg.provider === 'xendit') {
    const r = await ambilJson(`https://api.xendit.co/qr_codes/${encodeURIComponent(refId)}/payments`, {
      headers: { 'api-version': '2022-07-31', Authorization: 'Basic ' + b64(cfg.serverKey + ':') }
    })
    if (!r.ok) return { ok: false, error: r.error }
    const bayar = (r.data?.data || []).some((p: any) => String(p.status).toUpperCase() === 'SUCCEEDED')
    return { ok: true, status: bayar ? 'dibayar' : 'menunggu', mentah: JSON.stringify(r.data).slice(0, 2000) }
  }

  if (cfg.provider === 'duitku') {
    const base = cfg.mode === 'produksi'
      ? 'https://passport.duitku.com/webapi/api/merchant/transactionStatus'
      : 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus'
    const signature = await md5hex(cfg.merchantKode + kodePembayaran + cfg.serverKey)
    const r = await ambilJson(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantCode: cfg.merchantKode, merchantOrderId: kodePembayaran, signature })
    })
    if (!r.ok) return { ok: false, error: r.error }
    const kode = String(r.data?.statusCode || '')
    return {
      ok: true,
      status: kode === '00' ? 'dibayar' : kode === '01' ? 'menunggu' : 'gagal',
      mentah: JSON.stringify(r.data).slice(0, 2000)
    }
  }

  if (cfg.provider === 'tripay') {
    const base = cfg.mode === 'produksi'
      ? 'https://tripay.co.id/api/transaction/detail'
      : 'https://tripay.co.id/api-sandbox/transaction/detail'
    const r = await ambilJson(base + '?reference=' + encodeURIComponent(refId), {
      headers: { Authorization: 'Bearer ' + cfg.serverKey }
    })
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, status: petaStatusTripay(r.data?.data?.status), mentah: JSON.stringify(r.data?.data).slice(0, 2000) }
  }

  return { ok: false, error: 'Provider tidak dikenali.' }
}

function petaStatusMidtrans(s: string): 'menunggu' | 'dibayar' | 'kedaluwarsa' | 'gagal' {
  const v = String(s || '').toLowerCase()
  if (v === 'settlement' || v === 'capture') return 'dibayar'
  if (v === 'pending') return 'menunggu'
  if (v === 'expire') return 'kedaluwarsa'
  return 'gagal'
}
function petaStatusTripay(s: string): 'menunggu' | 'dibayar' | 'kedaluwarsa' | 'gagal' {
  const v = String(s || '').toUpperCase()
  if (v === 'PAID') return 'dibayar'
  if (v === 'UNPAID') return 'menunggu'
  if (v === 'EXPIRED') return 'kedaluwarsa'
  return 'gagal'
}

// ---------- Verifikasi callback ----------

export type HasilCallback = {
  sah: boolean
  error?: string
  kodePembayaran?: string   // merchant ref kita
  refId?: string
  status?: 'menunggu' | 'dibayar' | 'kedaluwarsa' | 'gagal'
  jumlah?: number
  sidik?: string            // untuk idempotency
}

/**
 * Verifikasi + terjemahkan callback dari provider apa pun.
 * rawBody diperlukan apa adanya karena signature dihitung atas body mentah.
 */
export async function verifikasiCallback(
  cfg: BayarConfig,
  provider: ProviderId,
  rawBody: string,
  header: (nama: string) => string | null | undefined
): Promise<HasilCallback> {
  let body: any = {}
  try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }

  if (provider === 'midtrans') {
    // signature_key = SHA512(order_id + status_code + gross_amount + server_key)
    const orderId = String(body.order_id || '')
    const perlu = orderId + String(body.status_code || '') + String(body.gross_amount || '') + cfg.serverKey
    const bytes = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(perlu))
    const hex = Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, '0')).join('')
    if (!samaAman(hex, String(body.signature_key || ''))) {
      return { sah: false, error: 'Signature Midtrans tidak cocok.' }
    }
    return {
      sah: true, kodePembayaran: orderId, refId: String(body.transaction_id || ''),
      status: petaStatusMidtrans(body.transaction_status),
      jumlah: Math.round(parseFloat(body.gross_amount || '0')),
      sidik: 'midtrans:' + orderId + ':' + String(body.transaction_status || '') + ':' + String(body.transaction_id || '')
    }
  }

  if (provider === 'xendit') {
    const token = header('x-callback-token') || ''
    if (!cfg.callbackSecret || !samaAman(String(token), cfg.callbackSecret)) {
      return { sah: false, error: 'Callback token Xendit tidak cocok.' }
    }
    const data = body.data || body
    const st = String(data.status || body.status || '').toUpperCase()
    return {
      sah: true,
      kodePembayaran: String(data.reference_id || data.qr_code?.reference_id || ''),
      refId: String(data.qr_id || data.id || ''),
      status: st === 'SUCCEEDED' || st === 'COMPLETED' ? 'dibayar' : st === 'EXPIRED' ? 'kedaluwarsa' : 'menunggu',
      jumlah: Math.round(parseFloat(data.amount || '0')),
      sidik: 'xendit:' + String(data.id || data.reference_id || '') + ':' + st
    }
  }

  if (provider === 'duitku') {
    // signature = MD5(merchantCode + amount + merchantOrderId + apiKey)
    const perlu = cfg.merchantKode + String(body.amount || '') + String(body.merchantOrderId || '') + cfg.serverKey
    const hex = await md5hex(perlu)
    if (!samaAman(hex, String(body.signature || ''))) {
      return { sah: false, error: 'Signature Duitku tidak cocok.' }
    }
    const kode = String(body.resultCode || '')
    return {
      sah: true, kodePembayaran: String(body.merchantOrderId || ''), refId: String(body.reference || ''),
      status: kode === '00' ? 'dibayar' : kode === '01' ? 'menunggu' : 'gagal',
      jumlah: Math.round(parseFloat(body.amount || '0')),
      sidik: 'duitku:' + String(body.merchantOrderId || '') + ':' + kode + ':' + String(body.reference || '')
    }
  }

  if (provider === 'tripay') {
    const sig = header('x-callback-signature') || ''
    const hex = await hmacSha256Hex(cfg.callbackSecret || cfg.serverKey, rawBody)
    if (!samaAman(hex, String(sig))) {
      return { sah: false, error: 'Signature Tripay tidak cocok.' }
    }
    return {
      sah: true, kodePembayaran: String(body.merchant_ref || ''), refId: String(body.reference || ''),
      status: petaStatusTripay(body.status),
      jumlah: Math.round(parseFloat(body.total_amount || body.amount_received || '0')),
      sidik: 'tripay:' + String(body.reference || '') + ':' + String(body.status || '')
    }
  }

  return { sah: false, error: 'Provider callback tidak dikenali atau QRIS statis (manual) tidak punya callback.' }
}

// ---------- Util ----------

/** Kode pembayaran unik: BYR-YYYYMMDD-XXXXXX */
export function kodePembayaran(): string {
  const tgl = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  const b = new Uint8Array(4)
  crypto.getRandomValues(b)
  const acak = Array.from(b).map((x) => x.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 6)
  return `BYR-${tgl}-${acak}`
}

/** Token lacak pesanan (URL-safe, sulit ditebak). */
export function tokenLacak(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 32)
}

export async function sidikCallback(provider: string, rawBody: string): Promise<string> {
  return provider + ':' + (await sha256hex(rawBody)).slice(0, 40)
}
