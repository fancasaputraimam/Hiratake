// ===== Fase 9: Absensi Selfie + GPS (anti-kecurangan) =====
// Prinsip ketat:
//  1. Jam dicatat SERVER (WIB / zona Jawa Barat) — jam HP karyawan tidak dipercaya.
//  2. Selfie wajib diambil dari kamera langsung (bukan unggah galeri) & diberi
//     watermark terbakar: nama, tanggal-jam server, koordinat, jarak dari kumbung.
//  3. Lokasi GPS wajib dalam radius kumbung (owner atur titik & radius).
//  4. Keterlambatan & pulang cepat dihitung otomatis dari jam kerja.
//  5. Semua bukti tersimpan & bisa diperiksa owner/admin kapan saja.
import { Hono } from 'hono'
import { type Bindings, type SessionUser, requireAuth, catatAudit } from './auth'

type Env = { Bindings: Bindings; Variables: { user: SessionUser } }

export const absensiRoutes = new Hono<Env>()

// ---------- Helper waktu WIB (Jawa Barat, UTC+7) ----------
const kiniWIB = () => new Date(Date.now() + 7 * 3600 * 1000)
const tglWIB = () => kiniWIB().toISOString().slice(0, 10)
const jamWIB = () => kiniWIB().toISOString().slice(11, 16)          // HH:MM
const waktuWIB = () => kiniWIB().toISOString().slice(0, 19).replace('T', ' ')

/** Selisih menit "HH:MM" (a - b). */
function selisihMenit(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return (ah * 60 + am) - (bh * 60 + bm)
}

/** Jarak haversine antar koordinat (meter). */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

async function ambilCfg(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare(
    `SELECT key, value FROM pengaturan WHERE key IN
     ('absen_wajib_selfie','absen_wajib_lokasi','absen_lat','absen_lng','absen_radius_m',
      'absen_toleransi_telat','jam_kerja_masuk','jam_kerja_pulang','situs_nama')`
  ).all<{ key: string; value: string }>()
  const m: Record<string, string> = {}
  for (const r of results) m[r.key] = r.value
  return m
}

// ---------- Konfigurasi absen untuk semua peran (dipakai UI kamera) ----------
absensiRoutes.get('/api/admin/absensi/config', requireAuth(), async (c) => {
  const cfg = await ambilCfg(c.env.DB)
  return c.json({
    // Waktu server WIB — dipakai untuk watermark (jam HP tidak dipercaya)
    serverTanggal: tglWIB(),
    serverJam: jamWIB(),
    serverWaktu: waktuWIB(),
    wajibSelfie: cfg.absen_wajib_selfie !== '0',
    wajibLokasi: cfg.absen_wajib_lokasi !== '0' && !!cfg.absen_lat && !!cfg.absen_lng,
    lokasiKumbung: cfg.absen_lat && cfg.absen_lng ? { lat: parseFloat(cfg.absen_lat), lng: parseFloat(cfg.absen_lng) } : null,
    radiusM: parseInt(cfg.absen_radius_m || '150') || 150,
    jamMasuk: cfg.jam_kerja_masuk || '07:00',
    jamPulang: cfg.jam_kerja_pulang || '16:00',
    toleransiTelat: parseInt(cfg.absen_toleransi_telat || '10') || 0,
    namaSitus: cfg.situs_nama || 'Hiratake'
  })
})

// ---------- Validasi bersama masuk & pulang ----------
type HasilValidasi = { error?: string; status?: number; jarak?: number | null; foto?: string | null }

async function validasiAbsen(
  db: D1Database,
  body: { foto?: string; lat?: number; lng?: number; akurasi?: number }
): Promise<HasilValidasi> {
  const cfg = await ambilCfg(db)
  const wajibSelfie = cfg.absen_wajib_selfie !== '0'
  const wajibLokasi = cfg.absen_wajib_lokasi !== '0' && !!cfg.absen_lat && !!cfg.absen_lng

  // --- Selfie ---
  let foto: string | null = null
  if (body.foto) {
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.foto)) {
      return { error: 'Format foto tidak valid. Gunakan kamera di halaman absen.', status: 400 }
    }
    if (body.foto.length > 600_000) return { error: 'Foto terlalu besar. Coba ulangi pengambilan foto.', status: 400 }
    if (body.foto.length < 4_000) return { error: 'Foto tidak lengkap. Coba ulangi pengambilan foto.', status: 400 }
    foto = body.foto
  }
  if (wajibSelfie && !foto) return { error: 'Selfie wajib. Ambil foto lewat kamera di halaman absen.', status: 400 }

  // --- Lokasi ---
  let jarak: number | null = null
  const lat = Number(body.lat), lng = Number(body.lng)
  const adaKoordinat = isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)
  if (adaKoordinat && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    return { error: 'Koordinat GPS tidak valid.', status: 400 }
  }
  if (wajibLokasi) {
    if (!adaKoordinat) return { error: 'Lokasi GPS wajib aktif untuk absen. Izinkan akses lokasi lalu coba lagi.', status: 400 }
    const radius = parseInt(cfg.absen_radius_m || '150') || 150
    jarak = jarakMeter(lat, lng, parseFloat(cfg.absen_lat), parseFloat(cfg.absen_lng))
    // Kelonggaran = akurasi GPS perangkat, maksimal 100 m (anti akal-akalan akurasi palsu besar)
    const slack = Math.min(Math.max(Number(body.akurasi) || 0, 0), 100)
    if (jarak > radius + slack) {
      return { error: `Anda berada ${jarak} m dari kumbung (maks. ${radius} m). Absen hanya bisa dilakukan di lokasi kerja.`, status: 403 }
    }
  } else if (adaKoordinat && cfg.absen_lat && cfg.absen_lng) {
    jarak = jarakMeter(lat, lng, parseFloat(cfg.absen_lat), parseFloat(cfg.absen_lng))
  }
  return { jarak, foto }
}

// ---------- Absen MASUK ----------
absensiRoutes.post('/api/admin/absensi/masuk', requireAuth(), async (c) => {
  const me = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const v = await validasiAbsen(c.env.DB, body)
  if (v.error) return c.json({ error: v.error }, (v.status || 400) as any)

  const tanggal = tglWIB()
  const jam = jamWIB()  // jam SERVER — bukan jam perangkat
  const cfg = await ambilCfg(c.env.DB)

  const ada = await c.env.DB.prepare('SELECT id, jam_masuk FROM absensi WHERE user_id=? AND tanggal=?').bind(me.id, tanggal).first<any>()
  if (ada?.jam_masuk) return c.json({ error: `Sudah absen masuk hari ini (${ada.jam_masuk}).` }, 400)

  // Hitung keterlambatan terhadap jam kerja + toleransi
  const jamKerja = cfg.jam_kerja_masuk || '07:00'
  const toleransi = parseInt(cfg.absen_toleransi_telat || '10') || 0
  const telat = Math.max(0, selisihMenit(jam, jamKerja) - toleransi)
  const perangkat = (c.req.header('user-agent') || '').slice(0, 160)
  const lat = isFinite(Number(body.lat)) ? Number(body.lat) : null
  const lng = isFinite(Number(body.lng)) ? Number(body.lng) : null

  let absensiId: number
  if (ada) {
    await c.env.DB.prepare(
      `UPDATE absensi SET jam_masuk=?, status='hadir', lat_masuk=?, lng_masuk=?, jarak_masuk_m=?, terlambat_menit=?, perangkat=? WHERE id=?`
    ).bind(jam, lat, lng, v.jarak, telat, perangkat, ada.id).run()
    absensiId = ada.id
  } else {
    const r = await c.env.DB.prepare(
      `INSERT INTO absensi (user_id, tanggal, jam_masuk, status, lat_masuk, lng_masuk, jarak_masuk_m, terlambat_menit, perangkat)
       VALUES (?,?,?,'hadir',?,?,?,?,?)`
    ).bind(me.id, tanggal, jam, lat, lng, v.jarak, telat, perangkat).run()
    absensiId = Number(r.meta.last_row_id)
  }

  if (v.foto) {
    await c.env.DB.prepare(
      `INSERT INTO absensi_foto (absensi_id, jenis, foto) VALUES (?, 'masuk', ?)
       ON CONFLICT(absensi_id, jenis) DO UPDATE SET foto=excluded.foto, created_at=CURRENT_TIMESTAMP`
    ).bind(absensiId, v.foto).run()
  }

  await catatAudit(c.env.DB, me, 'tambah', 'absensi', absensiId,
    `Masuk ${jam}${telat > 0 ? ` (TELAT ${telat} mnt)` : ''}${v.jarak != null ? `, jarak ${v.jarak} m` : ''}${v.foto ? ', +selfie' : ''}`)
  return c.json({ sukses: true, jam, telat, jarak: v.jarak })
})

// ---------- Absen PULANG ----------
absensiRoutes.post('/api/admin/absensi/pulang', requireAuth(), async (c) => {
  const me = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const v = await validasiAbsen(c.env.DB, body)
  if (v.error) return c.json({ error: v.error }, (v.status || 400) as any)

  const tanggal = tglWIB()
  const jam = jamWIB()
  const cfg = await ambilCfg(c.env.DB)

  const ada = await c.env.DB.prepare('SELECT id, jam_masuk, jam_pulang FROM absensi WHERE user_id=? AND tanggal=?').bind(me.id, tanggal).first<any>()
  if (!ada?.jam_masuk) return c.json({ error: 'Belum absen masuk hari ini.' }, 400)
  if (ada.jam_pulang) return c.json({ error: `Sudah absen pulang (${ada.jam_pulang}).` }, 400)
  // Anti-spam: minimal 5 menit setelah absen masuk (mencegah masuk-pulang sekali jalan)
  if (selisihMenit(jam, ada.jam_masuk) < 5) return c.json({ error: 'Absen pulang minimal 5 menit setelah absen masuk.' }, 400)

  const jamKerjaPulang = cfg.jam_kerja_pulang || '16:00'
  const pulangCepat = Math.max(0, selisihMenit(jamKerjaPulang, jam))
  const lat = isFinite(Number(body.lat)) ? Number(body.lat) : null
  const lng = isFinite(Number(body.lng)) ? Number(body.lng) : null

  await c.env.DB.prepare(
    'UPDATE absensi SET jam_pulang=?, lat_pulang=?, lng_pulang=?, jarak_pulang_m=?, pulang_cepat_menit=? WHERE id=?'
  ).bind(jam, lat, lng, v.jarak, pulangCepat, ada.id).run()

  if (v.foto) {
    await c.env.DB.prepare(
      `INSERT INTO absensi_foto (absensi_id, jenis, foto) VALUES (?, 'pulang', ?)
       ON CONFLICT(absensi_id, jenis) DO UPDATE SET foto=excluded.foto, created_at=CURRENT_TIMESTAMP`
    ).bind(ada.id, v.foto).run()
  }

  await catatAudit(c.env.DB, me, 'ubah', 'absensi', ada.id,
    `Pulang ${jam}${pulangCepat > 0 ? ` (CEPAT ${pulangCepat} mnt)` : ''}${v.jarak != null ? `, jarak ${v.jarak} m` : ''}${v.foto ? ', +selfie' : ''}`)
  return c.json({ sukses: true, jam, pulangCepat, jarak: v.jarak })
})

// ---------- Lihat foto bukti (owner/admin bebas; karyawan hanya miliknya) ----------
absensiRoutes.get('/api/admin/absensi/foto/:absensiId/:jenis', requireAuth(), async (c) => {
  const me = c.get('user')
  const { absensiId, jenis } = c.req.param()
  if (!['masuk', 'pulang'].includes(jenis)) return c.json({ error: 'Jenis: masuk/pulang' }, 400)
  const row = await c.env.DB.prepare(`
    SELECT f.foto, a.user_id FROM absensi_foto f JOIN absensi a ON a.id=f.absensi_id
    WHERE f.absensi_id=? AND f.jenis=?`).bind(absensiId, jenis).first<any>()
  if (!row) return c.json({ error: 'Foto tidak ditemukan.' }, 404)
  if (me.role === 'karyawan' && row.user_id !== me.id) return c.json({ error: 'Akses ditolak.' }, 403)
  // Kirim sebagai gambar langsung (bukti bisa dibuka di tab baru)
  const b64 = String(row.foto).split(',')[1] || ''
  const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
  return new Response(bin, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } })
})
