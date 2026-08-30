// ===== Modul Autentikasi Hiratake =====
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'

export type Bindings = { DB: D1Database }

export type SessionUser = {
  id: number
  username: string
  nama: string
  role: 'owner' | 'admin' | 'karyawan'
}

// SHA-256 hex menggunakan Web Crypto (kompatibel Cloudflare Workers)
export async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const hex = (buf: ArrayBuffer | Uint8Array): string =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

// PBKDF2-SHA256 via Web Crypto (didukung Cloudflare Workers).
// 100.000 iterasi — jauh lebih tahan brute-force dibanding 1x SHA-256,
// tetap aman di bawah batas CPU Workers (crypto.subtle native, bukan JS).
const PBKDF2_ITERASI = 100000

async function pbkdf2hex(password: string, saltHex: string, iterasi: number): Promise<string> {
  const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterasi }, key, 256)
  return hex(bits)
}

// Format hash baru: pbkdf2$<iterasi>$<saltHex>$<hashHex>
// Format lama (masih diterima saat verifikasi): salt$sha256(salt:password)
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const saltHex = hex(salt)
  return `pbkdf2$${PBKDF2_ITERASI}$${saltHex}$${await pbkdf2hex(password, saltHex, PBKDF2_ITERASI)}`
}

// Perbandingan waktu-konstan sederhana (hindari timing attack)
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let beda = 0
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return beda === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const bagian = stored.split('$')
  if (bagian[0] === 'pbkdf2' && bagian.length === 4) {
    const iterasi = parseInt(bagian[1])
    if (!iterasi || !bagian[2] || !bagian[3]) return false
    return samaAman(await pbkdf2hex(password, bagian[2], iterasi), bagian[3])
  }
  // Fallback format lama: salt$sha256(salt:password)
  const [salt, hash] = bagian
  if (!salt || !hash) return false
  return samaAman(await sha256hex(salt + ':' + password), hash)
}

// True bila hash tersimpan masih format lama / iterasi usang → perlu di-rehash
export function needsRehash(stored: string): boolean {
  const bagian = stored.split('$')
  return !(bagian[0] === 'pbkdf2' && parseInt(bagian[1]) >= PBKDF2_ITERASI)
}

export function generateToken(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID()
}

// Ambil user dari cookie sesi
export async function getSessionUser(c: Context<{ Bindings: Bindings }>): Promise<SessionUser | null> {
  const token = getCookie(c, 'hiratake_session')
  if (!token) return null
  const row = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.nama, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.aktif = 1
  `).bind(token).first<SessionUser>()
  return row ?? null
}

// Catat aktivitas ke audit log (tidak boleh menggagalkan operasi utama)
export async function catatAudit(
  db: D1Database,
  user: { id?: number; nama?: string } | null,
  aksi: string,
  entitas: string,
  entitasId?: string | number | null,
  detail?: string
): Promise<void> {
  try {
    await db.prepare(
      'INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user?.id ?? null, user?.nama ?? '-', aksi, entitas, String(entitasId ?? ''), detail || '').run()
  } catch { /* audit tidak boleh mengganggu operasi utama */ }
}

// Middleware: wajib login
export function requireAuth(roles?: Array<'owner' | 'admin' | 'karyawan'>) {
  return async (c: Context<{ Bindings: Bindings; Variables: { user: SessionUser } }>, next: Next) => {
    const user = await getSessionUser(c)
    if (!user) {
      return c.json({ error: 'Belum login. Silakan login terlebih dahulu.' }, 401)
    }
    if (roles && !roles.includes(user.role)) {
      return c.json({ error: 'Akses ditolak. Peran Anda tidak diizinkan.' }, 403)
    }
    c.set('user', user)
    await next()
  }
}
