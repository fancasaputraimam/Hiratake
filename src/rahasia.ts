// ============================================================
//  Penyimpanan kredensial rahasia
//
//  Kredensial (API key OpenWA, kunci payment gateway) boleh diisi
//  langsung dari dashboard supaya pemilik tidak perlu masuk ke server.
//  Nilainya disimpan di tabel `pengaturan` dengan pengamanan berlapis:
//
//   1. Hanya OWNER yang boleh mengisi/menghapus (admin pun tidak).
//   2. Nilainya TIDAK PERNAH dikirim balik ke browser — semua endpoint
//      yang membaca tabel pengaturan menyaringnya lewat `saring()`.
//      Yang dikirim hanya status "sudah diisi / belum" + 4 huruf terakhir.
//   3. Environment variable tetap menang bila diisi, sehingga pemasangan
//      lama (Cloudflare secret / .env) tidak berubah perilakunya.
//
//  Catatan jujur: menyimpan di database memang kurang aman dibanding
//  environment variable — bila database bocor, kunci ikut terbaca.
//  Karena itu environment variable tetap didukung dan diprioritaskan
//  untuk yang mementingkan keamanan maksimal.
// ============================================================

/** Kunci pengaturan yang isinya rahasia — tak boleh keluar ke browser. */
export const KUNCI_RAHASIA = [
  'rahasia_openwa_api_key',
  'rahasia_openwa_webhook_secret',
  'rahasia_bayar_server_key',
  'rahasia_bayar_client_key',
  'rahasia_bayar_callback_secret'
] as const

export type KunciRahasia = (typeof KUNCI_RAHASIA)[number]

/** Peta nama environment variable → kunci penyimpanan di database. */
export const PETA_RAHASIA: Record<string, KunciRahasia> = {
  OPENWA_API_KEY: 'rahasia_openwa_api_key',
  OPENWA_WEBHOOK_SECRET: 'rahasia_openwa_webhook_secret',
  BAYAR_SERVER_KEY: 'rahasia_bayar_server_key',
  BAYAR_CLIENT_KEY: 'rahasia_bayar_client_key',
  BAYAR_CALLBACK_SECRET: 'rahasia_bayar_callback_secret'
}

const SET_RAHASIA: Set<string> = new Set(KUNCI_RAHASIA)

/** Apakah sebuah kunci pengaturan bersifat rahasia? */
export const itiRahasia = (key: string): boolean => SET_RAHASIA.has(key)

/**
 * Buang semua nilai rahasia dari objek pengaturan sebelum dikirim ke browser.
 * WAJIB dipakai di setiap endpoint yang mengembalikan isi tabel `pengaturan`.
 */
export function saring<T extends Record<string, any>>(map: T): T {
  const bersih: Record<string, any> = {}
  for (const [k, v] of Object.entries(map)) {
    if (!SET_RAHASIA.has(k)) bersih[k] = v
  }
  return bersih as T
}

/**
 * Ambil satu kredensial. Environment variable diprioritaskan; bila kosong
 * baru mengambil dari database (yang diisi lewat dashboard).
 */
export async function ambilRahasia(
  db: D1Database,
  namaEnv: string,
  nilaiEnv?: string
): Promise<string> {
  if (nilaiEnv) return nilaiEnv
  const kunci = PETA_RAHASIA[namaEnv]
  if (!kunci) return ''
  try {
    const r = await db.prepare('SELECT value FROM pengaturan WHERE key = ?').bind(kunci).first<any>()
    return r?.value || ''
  } catch {
    return ''
  }
}

/** Ambil beberapa kredensial sekaligus (satu query, hemat untuk D1). */
export async function ambilBanyakRahasia(
  db: D1Database,
  daftar: { namaEnv: string; nilaiEnv?: string }[]
): Promise<Record<string, string>> {
  const hasil: Record<string, string> = {}
  const perluDB: string[] = []

  for (const { namaEnv, nilaiEnv } of daftar) {
    if (nilaiEnv) hasil[namaEnv] = nilaiEnv
    else perluDB.push(namaEnv)
  }
  if (!perluDB.length) return hasil

  const kunci = perluDB.map((n) => PETA_RAHASIA[n]).filter(Boolean)
  if (!kunci.length) return hasil

  try {
    const tanda = kunci.map(() => '?').join(',')
    const { results } = await db
      .prepare(`SELECT key, value FROM pengaturan WHERE key IN (${tanda})`)
      .bind(...kunci)
      .all<{ key: string; value: string }>()
    const m: Record<string, string> = {}
    for (const r of results) m[r.key] = r.value
    for (const n of perluDB) hasil[n] = m[PETA_RAHASIA[n]] || ''
  } catch {
    for (const n of perluDB) hasil[n] = ''
  }
  return hasil
}

/**
 * Tampilkan kredensial dengan aman untuk ditunjukkan di dashboard:
 * hanya 4 huruf terakhir, sisanya disembunyikan. Contoh: "••••••a9f3"
 */
export function sensorRahasia(nilai: string): string {
  if (!nilai) return ''
  if (nilai.length <= 4) return '•'.repeat(nilai.length)
  return '•'.repeat(Math.min(8, nilai.length - 4)) + nilai.slice(-4)
}

/** Dari mana kredensial ini berasal — untuk ditampilkan ke pemilik. */
export type SumberRahasia = 'server' | 'web' | 'kosong'

export function sumberRahasia(nilaiEnv: string | undefined, nilaiDB: string): SumberRahasia {
  if (nilaiEnv) return 'server'
  if (nilaiDB) return 'web'
  return 'kosong'
}
