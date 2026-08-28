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

// Format hash: salt$sha256(salt:password)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID().slice(0, 8)
  return salt + '$' + (await sha256hex(salt + ':' + password))
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  return (await sha256hex(salt + ':' + password)) === hash
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
