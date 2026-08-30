// ============================================================
//  Backup Database Lengkap (khusus owner)
//
//  Kenapa penting: semua data usaha (penjualan, keuangan, gaji, absensi)
//  hanya ada di satu D1. Salah hapus = tidak bisa kembali.
//
//  Dua format:
//   1. SQL  — file .sql berisi INSERT semua tabel, bisa dipulihkan penuh
//             dengan `wrangler d1 execute ... --file=backup.sql`
//   2. JSON — file .json untuk dibaca/diolah (Excel, script, arsip)
// ============================================================

import { Hono } from 'hono'
import { type Bindings, type SessionUser, requireAuth, catatAudit } from './auth'

/**
 * Tabel yang di-backup, DIURUTKAN sesuai ketergantungan foreign key
 * agar file SQL bisa dipulihkan berurutan tanpa galat referensi.
 */
const TABEL_BACKUP = [
  // Master & konfigurasi
  'pengaturan', 'users', 'produk', 'pelanggan', 'testimoni', 'wa_template',
  // Produksi
  'baglog_batch', 'baglog_kejadian', 'panen',
  // Penjualan & pesanan
  'pesanan', 'pesanan_item', 'penjualan', 'pembayaran_piutang', 'stok_penyesuaian',
  // Keuangan & SDM
  'pengeluaran', 'pemasukan_lain', 'absensi', 'gaji',
  // Pembayaran online
  'pembayaran', 'pembayaran_callback',
  // WhatsApp
  'wa_pesan', 'wa_masuk',
  // Jejak audit
  'audit_log'
] as const

/**
 * Tabel yang SENGAJA tidak di-backup:
 *  - sessions, login_attempts, wa_otp : data sementara/keamanan, tidak perlu
 *  - absensi_foto, situs_media        : gambar base64, ukurannya besar sekali
 *                                       (tersedia opsi ?media=1 bila diperlukan)
 */
const TABEL_MEDIA = ['situs_media', 'absensi_foto'] as const

/** Escape nilai menjadi literal SQL yang aman. */
function sqlNilai(v: any): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    // BLOB → literal hex X'..'
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array((v as any).buffer)
    let hex = ''
    for (const b of bytes) hex += b.toString(16).padStart(2, '0')
    return `X'${hex}'`
  }
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Baca seluruh isi satu tabel; kembalikan null bila tabel tidak ada. */
async function bacaTabel(db: D1Database, tabel: string): Promise<any[] | null> {
  try {
    const { results } = await db.prepare(`SELECT * FROM ${tabel}`).all<any>()
    return (results || []) as any[]
  } catch {
    return null // tabel belum ada (migrasi belum diterapkan) — dilewati
  }
}

/** Timestamp WIB untuk nama file: 2026-08-30_1530 */
function capWaktuWIB(): { tanggal: string; berkas: string; iso: string } {
  const wib = new Date(Date.now() + 7 * 3600 * 1000)
  const iso = wib.toISOString()
  return {
    tanggal: iso.slice(0, 10),
    berkas: `${iso.slice(0, 10)}_${iso.slice(11, 13)}${iso.slice(14, 16)}`,
    iso: iso.replace('T', ' ').slice(0, 19) + ' WIB'
  }
}

export const backupRoutes = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

/**
 * Ringkasan isi backup — ditampilkan di dashboard sebelum diunduh,
 * supaya owner tahu berapa banyak data yang tersimpan.
 */
backupRoutes.get('/api/admin/backup/ringkasan', requireAuth(['owner']), async (c) => {
  const db = c.env.DB
  const daftar: { tabel: string; baris: number }[] = []
  let totalBaris = 0

  for (const t of [...TABEL_BACKUP, ...TABEL_MEDIA]) {
    try {
      const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<any>()
      const n = r?.n ?? 0
      daftar.push({ tabel: t, baris: n })
      totalBaris += n
    } catch { /* tabel tidak ada — dilewati */ }
  }

  // Kapan backup terakhir diunduh (dari audit trail)
  const terakhir = await db.prepare(
    "SELECT created_at FROM audit_log WHERE entitas = 'backup' ORDER BY id DESC LIMIT 1"
  ).first<any>().catch(() => null)

  let hariSejak: number | null = null
  if (terakhir?.created_at) {
    const selisih = Date.now() - new Date(String(terakhir.created_at).replace(' ', 'T') + 'Z').getTime()
    hariSejak = Math.floor(selisih / 86400000)
  }

  return c.json({
    tabel: daftar,
    totalBaris,
    totalTabel: daftar.length,
    backupTerakhir: terakhir?.created_at || null,
    hariSejakBackup: hariSejak,
    // Peringatan bila belum pernah / lebih dari 7 hari (anjuran mingguan)
    perluBackup: hariSejak === null || hariSejak >= 7
  })
})

/**
 * Unduh backup lengkap.
 *   GET /api/admin/backup/unduh?format=sql|json&media=1
 *
 * format=sql  (default) → file .sql siap dipulihkan
 * format=json           → file .json untuk arsip/olah data
 * media=1               → sertakan foto (situs_media, absensi_foto); file jauh lebih besar
 */
backupRoutes.get('/api/admin/backup/unduh', requireAuth(['owner']), async (c) => {
  const db = c.env.DB
  const format = c.req.query('format') === 'json' ? 'json' : 'sql'
  const ikutMedia = c.req.query('media') === '1'
  const cap = capWaktuWIB()
  const tabelDipakai = ikutMedia ? [...TABEL_BACKUP, ...TABEL_MEDIA] : [...TABEL_BACKUP]

  // Ambil nama usaha untuk nama file
  const namaRow = await db.prepare("SELECT value FROM pengaturan WHERE key='situs_nama'").first<any>().catch(() => null)
  const slug = String(namaRow?.value || 'hiratake').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hiratake'

  const isi: Record<string, any[]> = {}
  const dilewati: string[] = []
  let totalBaris = 0

  for (const t of tabelDipakai) {
    const rows = await bacaTabel(db, t)
    if (rows === null) { dilewati.push(t); continue }
    isi[t] = rows
    totalBaris += rows.length
  }

  await catatAudit(
    db, c.get('user'), 'ekspor', 'backup', null,
    `Unduh backup lengkap (${format.toUpperCase()}${ikutMedia ? ' + media' : ''}) — ${Object.keys(isi).length} tabel, ${totalBaris} baris`
  )

  // ---------- Format JSON ----------
  if (format === 'json') {
    const paket = {
      _info: {
        aplikasi: 'Hiratake — Sistem Pengelolaan Usaha Jamur Tiram',
        versi_backup: 1,
        dibuat: cap.iso,
        oleh: c.get('user').username,
        total_tabel: Object.keys(isi).length,
        total_baris: totalBaris,
        termasuk_media: ikutMedia,
        tabel_dilewati: dilewati,
        catatan: 'Simpan file ini di tempat aman (Google Drive / hard disk). Untuk memulihkan penuh, gunakan backup format SQL.'
      },
      data: isi
    }
    return c.body(JSON.stringify(paket, null, 2), 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="backup-${slug}-${cap.berkas}.json"`,
      'Cache-Control': 'no-store'
    })
  }

  // ---------- Format SQL ----------
  const bagian: string[] = []
  bagian.push(`-- ============================================================
-- BACKUP LENGKAP — Hiratake (Sistem Pengelolaan Usaha Jamur Tiram)
-- Dibuat   : ${cap.iso}
-- Oleh     : ${c.get('user').username}
-- Tabel    : ${Object.keys(isi).length}${dilewati.length ? ` (dilewati: ${dilewati.join(', ')})` : ''}
-- Baris    : ${totalBaris}
-- Media    : ${ikutMedia ? 'disertakan' : 'TIDAK disertakan (foto & logo)'}
--
-- CARA MEMULIHKAN (di komputer, perlu Node.js + wrangler):
--   1. Terapkan struktur tabel dulu:
--        npx wrangler d1 migrations apply webapp-production
--   2. Pulihkan data:
--        npx wrangler d1 execute webapp-production --file=nama-file-ini.sql
--
-- PERINGATAN: file ini berisi data usaha & hash kata sandi.
-- Simpan di tempat aman, jangan dibagikan.
-- ============================================================

PRAGMA defer_foreign_keys = ON;
`)

  for (const [tabel, rows] of Object.entries(isi)) {
    bagian.push(`\n-- ----- Tabel: ${tabel} (${rows.length} baris) -----`)
    // Kosongkan tabel dulu agar pemulihan bersifat "ganti total", bukan menumpuk
    bagian.push(`DELETE FROM ${tabel};`)
    if (!rows.length) continue

    const kolom = Object.keys(rows[0])
    const kolomSQL = kolom.map((k) => `"${k}"`).join(', ')

    // INSERT batch (maks 200 baris per pernyataan) — cepat & tetap aman dibaca
    for (let i = 0; i < rows.length; i += 200) {
      const potong = rows.slice(i, i + 200)
      const nilai = potong.map((r) => `  (${kolom.map((k) => sqlNilai(r[k])).join(', ')})`).join(',\n')
      bagian.push(`INSERT INTO ${tabel} (${kolomSQL}) VALUES\n${nilai};`)
    }
  }

  bagian.push(`\nPRAGMA defer_foreign_keys = OFF;\n-- Selesai. Total ${totalBaris} baris dari ${Object.keys(isi).length} tabel.\n`)

  return c.body(bagian.join('\n'), 200, {
    'Content-Type': 'application/sql; charset=utf-8',
    'Content-Disposition': `attachment; filename="backup-${slug}-${cap.berkas}.sql"`,
    'Cache-Control': 'no-store'
  })
})
