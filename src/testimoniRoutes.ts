// ============================================================
//  Testimoni pelanggan — bukti sosial di landing page.
//  Dikelola owner/admin dari dashboard (tab Testimoni).
// ============================================================

import { Hono } from 'hono'
import { type Bindings, type SessionUser, requireAuth, catatAudit } from './auth'

export const testimoniRoutes = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

/** Daftar testimoni (owner/admin) — termasuk yang disembunyikan. */
testimoniRoutes.get('/api/admin/testimoni', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT t.*, p.nama AS nama_pelanggan
    FROM testimoni t LEFT JOIN pelanggan p ON p.id = t.pelanggan_id
    ORDER BY t.urutan, t.id DESC
  `).all()
  // Daftar pelanggan untuk pilihan "ambil dari pelanggan terdaftar"
  const { results: pelanggan } = await c.env.DB
    .prepare('SELECT id, nama, tipe FROM pelanggan WHERE aktif = 1 ORDER BY nama')
    .all()
  return c.json({ testimoni: results, pelanggan })
})

/** Validasi isi testimoni. Kembalikan pesan galat, atau null bila valid. */
function validasi(b: any): string | null {
  const nama = String(b.nama || '').trim()
  const isi = String(b.isi || '').trim()
  const rating = parseInt(b.rating)
  if (nama.length < 2) return 'Nama pelanggan minimal 2 karakter.'
  if (nama.length > 60) return 'Nama pelanggan maksimal 60 karakter.'
  if (String(b.asal || '').length > 80) return 'Asal/kota maksimal 80 karakter.'
  if (isi.length < 10) return 'Isi testimoni minimal 10 karakter.'
  if (isi.length > 400) return 'Isi testimoni maksimal 400 karakter agar rapi di halaman.'
  if (isNaN(rating) || rating < 1 || rating > 5) return 'Rating harus 1–5 bintang.'
  return null
}

/** Tambah testimoni. */
testimoniRoutes.post('/api/admin/testimoni', requireAuth(['owner', 'admin']), async (c) => {
  const b = await c.req.json<any>()
  const galat = validasi(b)
  if (galat) return c.json({ error: galat }, 400)

  // Batas wajar agar landing tidak kebanjiran & query tetap ringan
  const jml = await c.env.DB.prepare('SELECT COUNT(*) n FROM testimoni').first<any>()
  if ((jml?.n ?? 0) >= 50) return c.json({ error: 'Maksimal 50 testimoni. Hapus yang lama dulu.' }, 400)

  const r = await c.env.DB.prepare(`
    INSERT INTO testimoni (nama, asal, rating, isi, tampil, urutan, pelanggan_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    String(b.nama).trim(),
    String(b.asal || '').trim(),
    parseInt(b.rating),
    String(b.isi).trim(),
    b.tampil === false || b.tampil === 0 ? 0 : 1,
    parseInt(b.urutan) || 0,
    b.pelanggan_id ? parseInt(b.pelanggan_id) : null
  ).run()

  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'testimoni', r.meta.last_row_id,
    `Testimoni dari ${String(b.nama).trim()} (${parseInt(b.rating)}★)`)
  return c.json({ sukses: true, id: r.meta.last_row_id })
})

/** Ubah testimoni. */
testimoniRoutes.put('/api/admin/testimoni/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = parseInt(c.req.param('id'))
  const b = await c.req.json<any>()
  const galat = validasi(b)
  if (galat) return c.json({ error: galat }, 400)

  const ada = await c.env.DB.prepare('SELECT id FROM testimoni WHERE id = ?').bind(id).first()
  if (!ada) return c.json({ error: 'Testimoni tidak ditemukan.' }, 404)

  await c.env.DB.prepare(`
    UPDATE testimoni SET nama=?, asal=?, rating=?, isi=?, tampil=?, urutan=?, pelanggan_id=?
    WHERE id=?
  `).bind(
    String(b.nama).trim(),
    String(b.asal || '').trim(),
    parseInt(b.rating),
    String(b.isi).trim(),
    b.tampil === false || b.tampil === 0 ? 0 : 1,
    parseInt(b.urutan) || 0,
    b.pelanggan_id ? parseInt(b.pelanggan_id) : null,
    id
  ).run()

  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'testimoni', id, `Ubah testimoni ${String(b.nama).trim()}`)
  return c.json({ sukses: true })
})

/** Tampil / sembunyikan cepat (tombol mata di dashboard). */
testimoniRoutes.patch('/api/admin/testimoni/:id/tampil', requireAuth(['owner', 'admin']), async (c) => {
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT nama, tampil FROM testimoni WHERE id = ?').bind(id).first<any>()
  if (!row) return c.json({ error: 'Testimoni tidak ditemukan.' }, 404)
  const baru = row.tampil ? 0 : 1
  await c.env.DB.prepare('UPDATE testimoni SET tampil = ? WHERE id = ?').bind(baru, id).run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'testimoni', id,
    `${baru ? 'Tampilkan' : 'Sembunyikan'} testimoni ${row.nama}`)
  return c.json({ sukses: true, tampil: baru })
})

/** Hapus testimoni. */
testimoniRoutes.delete('/api/admin/testimoni/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT nama FROM testimoni WHERE id = ?').bind(id).first<any>()
  if (!row) return c.json({ error: 'Testimoni tidak ditemukan.' }, 404)
  await c.env.DB.prepare('DELETE FROM testimoni WHERE id = ?').bind(id).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'testimoni', id, `Hapus testimoni ${row.nama}`)
  return c.json({ sukses: true })
})
