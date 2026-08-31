// ============================================================
//  Rute API integrasi OpenWA
//  - /api/admin/wa/*        : pengaturan, status, log, kirim, template
//  - /api/webhook/openwa    : pesan masuk dari gateway (HMAC diverifikasi)
//  - /api/auth/otp/*        : login pengelola tanpa sandi via OTP WhatsApp
// ============================================================
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import {
  type Bindings as AuthBindings, type SessionUser,
  generateToken, requireAuth, catatAudit
} from './auth'
import {
  type OpenWAEnv, getWAConfig, siapKirim, statusSesi, ambilQR, mulaiSesi,
  daftarWebhook, cekWebhook,
  kirimWA, kirimBanyak, normalWA, validWA, sensorWA, cfgVal, namaSitus,
  buatDanKirimOTP, verifikasiOTP, verifikasiTandaTangan, renderTemplate,
  pesanDariTemplate, rupiah, tanggalID, hariIniWIB, envMenyala
} from './openwa'
import { notifPiutang, jalankanPengingatHarian } from './waNotifikasi'
import { saring, sensorRahasia, sumberRahasia, PETA_RAHASIA, itiRahasia, ambilRahasia } from './rahasia'

export type WABindings = AuthBindings & {
  OPENWA_URL?: string
  OPENWA_SESSION?: string
  OPENWA_AKTIF?: string
  OPENWA_API_KEY?: string
  OPENWA_WEBHOOK_SECRET?: string
}

type Env = { Bindings: WABindings; Variables: { user: SessionUser } }

export const waRoutes = new Hono<Env>()

// Kunci pengaturan yang boleh diubah dari dashboard (whitelist — anti injeksi kunci)
const KUNCI_WA = [
  'openwa_url', 'openwa_session', 'openwa_aktif', 'openwa_otp_login', 'openwa_otp_pesanan',
  'openwa_autoreply', 'openwa_notif_pesanan', 'openwa_notif_status', 'openwa_notif_nota',
  'openwa_notif_piutang', 'openwa_notif_gaji', 'openwa_notif_internal', 'openwa_notif_ringkasan', 'openwa_jam_pengingat'
]

// ============================================================
//  A. PENGATURAN & STATUS (owner/admin; kunci rahasia owner saja)
// ============================================================

waRoutes.get('/api/admin/wa/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT key, value FROM pengaturan WHERE key LIKE 'openwa_%' OR key LIKE 'rahasia_openwa_%'`
  ).all<{ key: string; value: string }>()
  const map: Record<string, string> = {}
  for (const r of results) map[r.key] = r.value

  const cfg = await getWAConfig(c.env as OpenWAEnv)
  const webhookDB = map.rahasia_openwa_webhook_secret || ''
  const aktifDariEnv = envMenyala(c.env.OPENWA_AKTIF)

  // `saring` membuang nilai rahasia — browser hanya menerima status.
  // Nilai URL/sesi/saklar yang dikirim adalah nilai EFEKTIF (env menang),
  // supaya dashboard menampilkan yang benar-benar dipakai server.
  const pengaturan = saring(map)
  pengaturan.openwa_url = cfg.url
  pengaturan.openwa_session = cfg.session
  if (aktifDariEnv) pengaturan.openwa_aktif = '1'

  return c.json({
    pengaturan,
    apiKeyTerpasang: !!cfg.apiKey,
    webhookSecretTerpasang: !!(c.env.OPENWA_WEBHOOK_SECRET || webhookDB),
    // Dari mana nilainya berasal: 'server' (env) / 'web' (database) / 'kosong'
    apiKeySumber: sumberRahasia(c.env.OPENWA_API_KEY, map.rahasia_openwa_api_key || ''),
    webhookSecretSumber: sumberRahasia(c.env.OPENWA_WEBHOOK_SECRET, webhookDB),
    urlSumber: sumberRahasia(c.env.OPENWA_URL, map.openwa_url || ''),
    sessionSumber: sumberRahasia(c.env.OPENWA_SESSION, map.openwa_session || ''),
    aktifSumber: aktifDariEnv ? 'server' : 'web',
    // Hanya 4 huruf terakhir, untuk memastikan pemilik memasang kunci yang benar
    apiKeyPetunjuk: sensorRahasia(cfg.apiKey),
    webhookSecretPetunjuk: sensorRahasia(c.env.OPENWA_WEBHOOK_SECRET || webhookDB),
    siap: siapKirim(cfg),
    webhookUrl: new URL('/api/webhook/openwa', c.req.url).toString()
  })
})

// ------------------------------------------------------------
//  Simpan / hapus kredensial dari dashboard — KHUSUS OWNER
//  Nilainya masuk database dan tidak pernah dikirim balik ke browser.
// ------------------------------------------------------------
waRoutes.put('/api/admin/wa/kredensial', requireAuth(['owner']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const izin: Record<string, string> = {
    api_key: 'OPENWA_API_KEY',
    webhook_secret: 'OPENWA_WEBHOOK_SECRET'
  }

  const stmts: any[] = []
  const diubah: string[] = []

  for (const [medan, namaEnv] of Object.entries(izin)) {
    if (body[medan] === undefined) continue
    const nilai = String(body[medan] ?? '').trim()
    const kunci = PETA_RAHASIA[namaEnv]

    if (nilai === '') {
      // String kosong = perintah hapus
      stmts.push(c.env.DB.prepare('DELETE FROM pengaturan WHERE key = ?').bind(kunci))
      diubah.push(`${medan} dihapus`)
      continue
    }
    if (nilai.length > 500) {
      return c.json({ error: 'Kredensial terlalu panjang (maksimal 500 karakter).' }, 400)
    }
    stmts.push(c.env.DB.prepare(
      'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(kunci, nilai))
    diubah.push(`${medan} diperbarui`)
  }

  if (!stmts.length) return c.json({ error: 'Tidak ada kredensial yang dikirim.' }, 400)
  await c.env.DB.batch(stmts)
  // Audit mencatat AKSI-nya saja, bukan nilai kredensialnya
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'wa-kredensial', '-', diubah.join(', '))
  return c.json({ sukses: true, pesan: 'Kredensial disimpan. Tidak perlu restart server.' })
})

waRoutes.put('/api/admin/wa/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const pasangan: Array<{ key: string; value: string }> = []

  // Kunci yang sudah ditetapkan lewat environment server: abaikan dari form
  // supaya nilai .env tidak tertimpa nilai kosong dari kolom yang dikunci.
  const dikunciEnv = new Set<string>()
  if (c.env.OPENWA_URL) dikunciEnv.add('openwa_url')
  if (c.env.OPENWA_SESSION) dikunciEnv.add('openwa_session')
  if (envMenyala(c.env.OPENWA_AKTIF)) dikunciEnv.add('openwa_aktif')

  for (const [key, valueRaw] of Object.entries(body)) {
    if (!KUNCI_WA.includes(key)) continue
    if (dikunciEnv.has(key)) continue
    // Sabuk keamanan tambahan: kredensial tidak boleh lewat endpoint ini
    if (itiRahasia(key)) continue
    let value = String(valueRaw ?? '').trim()

    if (key === 'openwa_url' && value) {
      try {
        const u = new URL(value)
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
        value = u.origin + (u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, ''))
      } catch {
        return c.json({ error: 'URL OpenWA tidak valid. Contoh: https://wa.domainanda.com atau http://127.0.0.1:2785' }, 400)
      }
    }
    if (key === 'openwa_jam_pengingat') {
      const j = parseInt(value)
      if (isNaN(j) || j < 0 || j > 23) return c.json({ error: 'Jam pengingat harus 0–23.' }, 400)
      value = String(j)
    }
    if (key.startsWith('openwa_notif') || ['openwa_aktif', 'openwa_otp_login', 'openwa_otp_pesanan', 'openwa_autoreply'].includes(key)) {
      value = value === '1' || value === 'true' ? '1' : '0'
    }
    pasangan.push({ key, value })
  }
  if (!pasangan.length) return c.json({ error: 'Tidak ada pengaturan yang dikenali.' }, 400)

  // Mengaktifkan integrasi tanpa API key hanya bikin semua pesan gagal.
  // JANGAN tolak seluruh simpanan (dulu URL & sesi ikut hilang) — cukup tahan
  // flag "aktif" saja lalu beri tahu pemilik.
  let peringatan = ''
  const itemAktif = pasangan.find((p) => p.key === 'openwa_aktif')
  if (itemAktif?.value === '1') {
    const cfgCek = await getWAConfig(c.env as OpenWAEnv)
    if (!cfgCek.apiKey) {
      itemAktif.value = '0'
      peringatan = 'URL & sesi tersimpan. Integrasi BELUM diaktifkan karena API key OpenWA belum diisi — isi API key lalu simpan lagi.'
    }
  }

  await c.env.DB.batch(pasangan.map(({ key, value }) => c.env.DB.prepare(
    'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value)))
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'wa-pengaturan', '-', 'Ubah pengaturan integrasi WhatsApp')
  return c.json({ sukses: true, ...(peringatan ? { peringatan } : {}) })
})

// Status sesi WhatsApp di gateway
waRoutes.get('/api/admin/wa/status', requireAuth(['owner', 'admin']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if (!cfg.url || !cfg.session) {
    return c.json({ terhubung: false, status: 'belum_diatur', pesan: 'URL gateway atau nama sesi belum diisi.' })
  }
  if (!cfg.apiKey) {
    return c.json({ terhubung: false, status: 'tanpa_apikey', pesan: 'API key OpenWA belum dipasang sebagai secret di server.' })
  }
  const s = await statusSesi(cfg)
  if (!s.ok) return c.json({ terhubung: false, status: 'error', pesan: s.error })
  const siapPakai = s.status === 'ready'
  return c.json({
    terhubung: siapPakai, status: s.status, aktif: cfg.aktif,
    pesan: siapPakai ? 'WhatsApp tersambung & siap mengirim.'
      : s.status === 'qr_ready' ? 'Sesi menunggu QR discan. Buka dashboard OpenWA atau ambil QR di sini.'
      : `Sesi berstatus "${s.status}" — belum siap mengirim.`,
    sesi: s.sesi
  })
})

// Ambil QR untuk scan (agar tidak perlu buka dashboard OpenWA)
waRoutes.get('/api/admin/wa/qr', requireAuth(['owner', 'admin']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if (!cfg.url || !cfg.session || !cfg.apiKey) return c.json({ error: 'Konfigurasi OpenWA belum lengkap.' }, 400)
  const r = await ambilQR(cfg)
  if (!r.ok) return c.json({ error: r.error }, 502)
  return c.json({ qr: r.qr })
})

// Mulai sesi WhatsApp
waRoutes.post('/api/admin/wa/mulai-sesi', requireAuth(['owner', 'admin']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if (!cfg.url || !cfg.session || !cfg.apiKey) return c.json({ error: 'Konfigurasi OpenWA belum lengkap.' }, 400)
  const r = await mulaiSesi(cfg)
  if (!r.ok) return c.json({ error: r.error }, 502)
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'wa-sesi', cfg.session, 'Mulai sesi WhatsApp')
  return c.json({ sukses: true })
})

// Uji kirim ke nomor sendiri
waRoutes.post('/api/admin/wa/uji', requireAuth(['owner', 'admin']), async (c) => {
  const { wa } = await c.req.json()
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid (contoh: 081234567890).' }, 400)
  const situs = await namaSitus(c.env.DB)
  const me = c.get('user')
  const isi = `✅ *Uji Koneksi ${situs}*\n\nIntegrasi OpenWA berhasil.\nDiuji oleh: ${me.nama} (${me.role})\nWaktu: ${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')} WIB\n\nNotifikasi otomatis siap digunakan. 🍄`
  const r = await kirimWA(c.env as OpenWAEnv, nomor, isi, { jenis: 'uji', entitas: 'auth', userId: me.id })
  if (!r.ok) return c.json({ error: r.error }, 502)
  return c.json({ sukses: true, messageId: r.messageId })
})

// Uji koneksi ke gateway: cek URL + API key + status sesi (tanpa kirim pesan)
waRoutes.post('/api/admin/wa/uji-koneksi', requireAuth(['owner', 'admin']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  const kurang: string[] = []
  if (!cfg.url) kurang.push('URL gateway')
  if (!cfg.session) kurang.push('nama sesi')
  if (!cfg.apiKey) kurang.push('API key')
  if (kurang.length) return c.json({ ok: false, error: `Lengkapi & simpan dulu: ${kurang.join(', ')}.` }, 400)
  const s = await statusSesi(cfg)
  if (!s.ok) return c.json({ ok: false, error: s.error }, 502)
  return c.json({ ok: true, status: s.status, ready: s.status === 'ready' })
})

// Daftarkan webhook Hiratake ke OpenWA otomatis.
// Bila webhook secret belum ada, dibuatkan otomatis & disimpan — jadi pemilik
// tidak perlu mengarang teks acak sendiri. Secret tetap di server.
waRoutes.post('/api/admin/wa/webhook/daftar', requireAuth(['owner']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if (!cfg.url || !cfg.session || !cfg.apiKey) {
    return c.json({ error: 'Lengkapi & simpan dulu URL gateway, nama sesi, dan API key OpenWA di halaman ini.' }, 400)
  }

  let secret = await ambilRahasia(c.env.DB, 'OPENWA_WEBHOOK_SECRET', c.env.OPENWA_WEBHOOK_SECRET)
  let secretBaru = false
  if (!secret) {
    secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0')).join('')
    await c.env.DB.prepare(
      'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind('rahasia_openwa_webhook_secret', secret).run()
    secretBaru = true
  }

  const webhookUrl = new URL('/api/webhook/openwa', c.req.url).toString()
  const r = await daftarWebhook(cfg, webhookUrl, secret)
  if (!r.ok) {
    let e = r.error || 'Gagal mendaftarkan webhook.'
    if (/not allowed|private|localhost|loopback|127\.0\.0\.1/i.test(e)) {
      e = `OpenWA menolak alamat webhook "${webhookUrl}" — biasanya karena localhost / IP privat. ` +
          `Daftarkan dari server produksi (domain publik, mis. https://domainanda.com), bukan dari lokal.`
    }
    return c.json({ error: e }, 502)
  }
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'wa-webhook', cfg.session,
    secretBaru ? 'Daftarkan webhook + buat webhook secret otomatis' : 'Daftarkan webhook OpenWA otomatis')
  return c.json({ sukses: true, webhookUrl, secretBaru })
})

// Cek apakah webhook Hiratake sudah terdaftar di OpenWA (best-effort)
waRoutes.get('/api/admin/wa/webhook/cek', requireAuth(['owner', 'admin']), async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  const webhookUrl = new URL('/api/webhook/openwa', c.req.url).toString()
  const r = await cekWebhook(cfg, webhookUrl)
  return c.json({ terdaftar: r.terdaftar, pesan: r.error || '' })
})

// ============================================================
//  B. LOG PESAN
// ============================================================

waRoutes.get('/api/admin/wa/log', requireAuth(['owner', 'admin']), async (c) => {
  const jenis = c.req.query('jenis') || ''
  const status = c.req.query('status') || ''
  const cari = (c.req.query('cari') || '').trim()
  const cond: string[] = []
  const bind: any[] = []
  if (jenis) { cond.push('jenis = ?'); bind.push(jenis) }
  if (status) { cond.push('status = ?'); bind.push(status) }
  if (cari) { cond.push('(tujuan LIKE ? OR isi LIKE ? OR entitas_id LIKE ?)'); bind.push(`%${cari}%`, `%${cari}%`, `%${cari}%`) }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : ''

  const { results } = await c.env.DB.prepare(
    `SELECT w.id, w.tujuan, w.jenis, w.isi, w.status, w.error, w.entitas, w.entitas_id,
            w.created_at, w.terkirim_at, u.nama AS oleh
     FROM wa_pesan w LEFT JOIN users u ON u.id = w.user_id
     ${where} ORDER BY w.id DESC LIMIT 100`
  ).bind(...bind).all<any>()

  const stat = await c.env.DB.prepare(
    `SELECT
       COUNT(*) total,
       SUM(CASE WHEN status='terkirim' THEN 1 ELSE 0 END) terkirim,
       SUM(CASE WHEN status='gagal' THEN 1 ELSE 0 END) gagal,
       SUM(CASE WHEN date(created_at,'+7 hours') = date('now','+7 hours') THEN 1 ELSE 0 END) hari_ini
     FROM wa_pesan`
  ).first<any>()

  return c.json({ log: results, statistik: stat })
})

// Kirim ulang pesan yang gagal
waRoutes.post('/api/admin/wa/log/:id/kirim-ulang', requireAuth(['owner', 'admin']), async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM wa_pesan WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!row) return c.json({ error: 'Pesan tidak ditemukan.' }, 404)
  if (row.status === 'terkirim') return c.json({ error: 'Pesan ini sudah terkirim.' }, 400)
  if (row.jenis === 'otp') return c.json({ error: 'Kode OTP tidak boleh dikirim ulang (alasan keamanan). Minta kode baru.' }, 400)

  const r = await kirimWA(c.env as OpenWAEnv, row.tujuan, row.isi, {
    jenis: row.jenis, entitas: row.entitas, entitasId: row.entitas_id, userId: c.get('user').id
  })
  if (!r.ok) return c.json({ error: r.error }, 502)
  await c.env.DB.prepare("UPDATE wa_pesan SET status='terkirim', terkirim_at=datetime('now'), error='' WHERE id = ?")
    .bind(row.id).run()
  return c.json({ sukses: true })
})

// Pesan masuk (dari webhook)
waRoutes.get('/api/admin/wa/masuk', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, pengirim, nama_pengirim, isi, tipe, dibalas, balasan, created_at FROM wa_masuk ORDER BY id DESC LIMIT 60'
  ).all()
  return c.json({ masuk: results })
})

// ============================================================
//  C. KIRIM MANUAL & BROADCAST
// ============================================================

waRoutes.post('/api/admin/wa/kirim', requireAuth(['owner', 'admin']), async (c) => {
  const { wa, pesan } = await c.req.json()
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid.' }, 400)
  const isi = String(pesan || '').trim()
  if (!isi) return c.json({ error: 'Isi pesan wajib diisi.' }, 400)
  if (isi.length > 4000) return c.json({ error: 'Pesan maksimal 4000 karakter.' }, 400)

  const me = c.get('user')
  const r = await kirimWA(c.env as OpenWAEnv, nomor, isi, { jenis: 'manual', entitas: 'manual', userId: me.id })
  if (!r.ok) return c.json({ error: r.error }, 502)
  await catatAudit(c.env.DB, me, 'kirim', 'wa-manual', nomor, isi.slice(0, 80))
  return c.json({ sukses: true })
})

/**
 * Broadcast ke kelompok pelanggan.
 * Dibatasi 50 nomor per kirim + jeda 1,2 detik/pesan agar tidak
 * dianggap spam oleh WhatsApp (risiko nomor diblokir).
 */
waRoutes.post('/api/admin/wa/broadcast', requireAuth(['owner', 'admin']), async (c) => {
  const { target, tipe, pesan } = await c.req.json()
  const isi = String(pesan || '').trim()
  if (!isi) return c.json({ error: 'Isi pesan wajib diisi.' }, 400)
  if (isi.length > 3000) return c.json({ error: 'Pesan broadcast maksimal 3000 karakter.' }, 400)

  let sql = "SELECT nama, wa FROM pelanggan WHERE aktif = 1 AND wa IS NOT NULL AND wa != ''"
  const bind: any[] = []
  if (target === 'tipe' && tipe) { sql += ' AND tipe = ?'; bind.push(tipe) }
  else if (target === 'piutang') {
    sql = `SELECT DISTINCT pl.nama, pl.wa FROM pelanggan pl
           JOIN penjualan pj ON pj.pelanggan_id = pl.id
           WHERE pj.status_bayar = 'tempo' AND pl.wa IS NOT NULL AND pl.wa != ''`
  } else if (target === 'aktif30') {
    sql = `SELECT DISTINCT pl.nama, pl.wa FROM pelanggan pl
           JOIN penjualan pj ON pj.pelanggan_id = pl.id
           WHERE pj.tanggal >= date('now','-30 days') AND pl.wa IS NOT NULL AND pl.wa != ''`
  }
  sql += ' LIMIT 50'

  const { results } = await c.env.DB.prepare(sql).bind(...bind).all<any>()
  if (!results.length) return c.json({ error: 'Tidak ada pelanggan dengan nomor WhatsApp pada kelompok ini.' }, 400)

  const me = c.get('user')
  const situs = await namaSitus(c.env.DB)
  const daftar = (results as any[]).map((p) => ({
    wa: p.wa,
    // Personalisasi ringan: {nama} & {situs} bisa dipakai di pesan broadcast
    isi: renderTemplate(isi, { nama: p.nama, situs })
  }))
  const hasil = await kirimBanyak(c.env as OpenWAEnv, daftar, {
    jenis: 'broadcast', entitas: 'broadcast', userId: me.id
  })
  await catatAudit(c.env.DB, me, 'kirim', 'wa-broadcast', target || 'semua',
    `${hasil.terkirim} terkirim / ${hasil.gagal} gagal — ${isi.slice(0, 60)}`)
  return c.json({ sukses: true, ...hasil })
})

// Hitung dulu jumlah penerima broadcast (agar owner tahu sebelum mengirim)
waRoutes.get('/api/admin/wa/broadcast/hitung', requireAuth(['owner', 'admin']), async (c) => {
  const target = c.req.query('target') || 'semua'
  const tipe = c.req.query('tipe') || ''
  let sql = "SELECT COUNT(*) v FROM pelanggan WHERE aktif = 1 AND wa IS NOT NULL AND wa != ''"
  const bind: any[] = []
  if (target === 'tipe' && tipe) { sql += ' AND tipe = ?'; bind.push(tipe) }
  else if (target === 'piutang') {
    sql = `SELECT COUNT(DISTINCT pl.id) v FROM pelanggan pl JOIN penjualan pj ON pj.pelanggan_id = pl.id
           WHERE pj.status_bayar='tempo' AND pl.wa IS NOT NULL AND pl.wa != ''`
  } else if (target === 'aktif30') {
    sql = `SELECT COUNT(DISTINCT pl.id) v FROM pelanggan pl JOIN penjualan pj ON pj.pelanggan_id = pl.id
           WHERE pj.tanggal >= date('now','-30 days') AND pl.wa IS NOT NULL AND pl.wa != ''`
  }
  const r = await c.env.DB.prepare(sql).bind(...bind).first<any>()
  return c.json({ jumlah: Math.min(50, r?.v ?? 0), total: r?.v ?? 0, batas: 50 })
})

// Kirim tagihan piutang manual dari tab Piutang
waRoutes.post('/api/admin/wa/tagih/:id', requireAuth(['owner', 'admin']), async (c) => {
  const r = await notifPiutang(c.env as OpenWAEnv, c.req.param('id'), c.get('user').id)
  if (!r.ok) return c.json({ error: r.error }, 400)
  return c.json({ sukses: true })
})

// Jalankan pengingat harian sekarang (manual trigger)
waRoutes.post('/api/admin/wa/pengingat', requireAuth(['owner', 'admin']), async (c) => {
  const r = await jalankanPengingatHarian(c.env as OpenWAEnv, true)
  return c.json({ sukses: true, ...r })
})

// ============================================================
//  D. TEMPLATE PESAN
// ============================================================

waRoutes.get('/api/admin/wa/template', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT kode, nama, isi, aktif, updated_at FROM wa_template ORDER BY kode'
  ).all()
  return c.json({ template: results })
})

waRoutes.put('/api/admin/wa/template/:kode', requireAuth(['owner', 'admin']), async (c) => {
  const kode = c.req.param('kode')
  const { isi, aktif } = await c.req.json()
  const ada = await c.env.DB.prepare('SELECT kode FROM wa_template WHERE kode = ?').bind(kode).first()
  if (!ada) return c.json({ error: 'Template tidak ditemukan.' }, 404)
  const teks = String(isi ?? '').trim()
  if (!teks) return c.json({ error: 'Isi template tidak boleh kosong.' }, 400)
  if (teks.length > 3000) return c.json({ error: 'Template maksimal 3000 karakter.' }, 400)

  await c.env.DB.prepare(
    "UPDATE wa_template SET isi = ?, aktif = ?, updated_at = datetime('now') WHERE kode = ?"
  ).bind(teks, aktif === false || aktif === 0 || aktif === '0' ? 0 : 1, kode).run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'wa-template', kode, 'Ubah template pesan WA')
  return c.json({ sukses: true })
})

// Pratinjau template dengan data contoh
waRoutes.post('/api/admin/wa/template/:kode/pratinjau', requireAuth(['owner', 'admin']), async (c) => {
  const { isi } = await c.req.json()
  const contoh: Record<string, string | number> = {
    situs: await namaSitus(c.env.DB), nama: 'Ibu Sari', kode: 'PO-2026-01-007',
    rincian: '• Jamur Tiram Segar 3× @Rp 15.000 = Rp 45.000\n• Jamur Grade B 2× @Rp 12.000 = Rp 24.000',
    total: rupiah(69000), tanggal_kirim: tanggalID(hariIniWIB()), tanggal: tanggalID(hariIniWIB()),
    status: 'Sedang diproses', catatan_status: 'Jamur sedang kami siapkan & sortir. 🍄',
    status_bayar: 'LUNAS ✅', info_tempo: '', terbayar: rupiah(20000), sisa: rupiah(49000),
    jatuh_tempo: tanggalID(hariIniWIB()), keterangan_tempo: 'belum jatuh tempo',
    jumlah: rupiah(20000), lunas_info: 'Mohon lanjutkan pembayaran sisanya.',
    periode: hariIniWIB().slice(0, 7), hari_hadir: 24, upah_harian: rupiah(75000),
    pokok: rupiah(1800000), bonus: rupiah(100000), potongan: rupiah(0),
    menit: 5, wa: '628123456789', catatan: 'Tolong dikirim pagi'
  }
  return c.json({ hasil: renderTemplate(String(isi || ''), contoh) })
})

// ============================================================
//  E. NOMOR WA PENGGUNA (untuk OTP login & notifikasi internal)
// ============================================================

waRoutes.put('/api/admin/users/:id/wa', requireAuth(['owner']), async (c) => {
  const { wa } = await c.req.json()
  const nomor = normalWA(wa)
  if (nomor && !validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid (contoh: 081234567890).' }, 400)
  if (nomor) {
    const dipakai = await c.env.DB.prepare('SELECT username FROM users WHERE wa = ? AND id != ?')
      .bind(nomor, c.req.param('id')).first<any>()
    if (dipakai) return c.json({ error: `Nomor ini sudah dipakai pengguna "${dipakai.username}".` }, 400)
  }
  await c.env.DB.prepare('UPDATE users SET wa = ? WHERE id = ?').bind(nomor, c.req.param('id')).run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'users', c.req.param('id'),
    nomor ? `Set nomor WA ${sensorWA(nomor)}` : 'Hapus nomor WA')
  return c.json({ sukses: true })
})

// Simpan nomor WA sendiri
waRoutes.put('/api/auth/wa', requireAuth(), async (c) => {
  const { wa } = await c.req.json()
  const nomor = normalWA(wa)
  const me = c.get('user')
  if (nomor && !validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid.' }, 400)
  if (nomor) {
    const dipakai = await c.env.DB.prepare('SELECT id FROM users WHERE wa = ? AND id != ?').bind(nomor, me.id).first()
    if (dipakai) return c.json({ error: 'Nomor ini sudah dipakai pengguna lain.' }, 400)
  }
  await c.env.DB.prepare('UPDATE users SET wa = ? WHERE id = ?').bind(nomor, me.id).run()
  return c.json({ sukses: true })
})

// ============================================================
//  F. LOGIN VIA OTP WHATSAPP (tanpa kata sandi)
// ============================================================

/** Apakah login OTP tersedia? Dipakai halaman login untuk menampilkan tombol. */
waRoutes.get('/api/auth/otp/tersedia', async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  const aktif = (await cfgVal(c.env.DB, 'openwa_otp_login', '0')) === '1'
  return c.json({ tersedia: aktif && siapKirim(cfg) })
})

waRoutes.post('/api/auth/otp/minta', async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if ((await cfgVal(c.env.DB, 'openwa_otp_login', '0')) !== '1' || !siapKirim(cfg)) {
    return c.json({ error: 'Login via WhatsApp tidak aktif. Gunakan username & kata sandi.' }, 400)
  }
  const { username } = await c.req.json()
  const uname = String(username || '').trim().toLowerCase()
  if (!uname) return c.json({ error: 'Username wajib diisi.' }, 400)

  // Rate limit sama seperti login sandi (anti brute-force & anti-spam WA)
  const gagal = await c.env.DB.prepare(
    "SELECT COUNT(*) v FROM login_attempts WHERE username = ? AND sukses = 0 AND created_at > datetime('now','-5 minutes')"
  ).bind(uname).first<any>()
  if ((gagal?.v ?? 0) >= 5) return c.json({ error: 'Terlalu banyak percobaan. Tunggu 5 menit.' }, 429)

  const user = await c.env.DB.prepare(
    'SELECT id, nama, wa, aktif FROM users WHERE username = ?'
  ).bind(uname).first<any>()

  // Balasan seragam agar tidak membocorkan username mana yang terdaftar
  const balasanUmum = { sukses: true, pesan: 'Bila username terdaftar & punya nomor WhatsApp, kode sudah dikirim.' }
  if (!user || !user.aktif || !normalWA(user.wa)) {
    await c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 0)').bind(uname).run()
    return c.json(balasanUmum)
  }

  const r = await buatDanKirimOTP(c.env as OpenWAEnv, user.wa, 'login', user.id)
  if (!r.ok) return c.json({ error: r.error }, 400)
  return c.json({ ...balasanUmum, waSensor: sensorWA(user.wa), menit: r.menit })
})

waRoutes.post('/api/auth/otp/verifikasi', async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if ((await cfgVal(c.env.DB, 'openwa_otp_login', '0')) !== '1' || !siapKirim(cfg)) {
    return c.json({ error: 'Login via WhatsApp tidak aktif.' }, 400)
  }
  const { username, kode } = await c.req.json()
  const uname = String(username || '').trim().toLowerCase()
  const user = await c.env.DB.prepare(
    'SELECT id, username, nama, role, wa, aktif FROM users WHERE username = ?'
  ).bind(uname).first<any>()
  if (!user || !user.aktif || !normalWA(user.wa)) {
    await c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 0)').bind(uname).run()
    return c.json({ error: 'Kode tidak valid.' }, 401)
  }

  const v = await verifikasiOTP(c.env.DB, user.wa, kode, 'login')
  if (!v.ok) {
    await c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 0)').bind(uname).run()
    return c.json({ error: v.error }, 401)
  }
  // OTP harus milik user yang sama (cegah kode nomor lain dipakai lintas akun)
  if (v.userId && v.userId !== user.id) return c.json({ error: 'Kode tidak valid untuk akun ini.' }, 401)

  const token = generateToken()
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))").bind(token, user.id),
    c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 1)').bind(uname),
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
  ])
  await catatAudit(c.env.DB, { id: user.id, nama: user.nama }, 'login', 'auth', user.id, 'Login via OTP WhatsApp')
  setCookie(c, 'hiratake_session', token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 7
  })
  return c.json({ sukses: true, user: { id: user.id, username: user.username, nama: user.nama, role: user.role } })
})

// ============================================================
//  G. OTP VERIFIKASI PEMESAN (halaman depan)
// ============================================================

waRoutes.get('/api/pesan-online/otp-wajib', async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  const wajib = (await cfgVal(c.env.DB, 'openwa_otp_pesanan', '0')) === '1' && siapKirim(cfg)
  return c.json({ wajib })
})

waRoutes.post('/api/pesan-online/otp', async (c) => {
  const cfg = await getWAConfig(c.env as OpenWAEnv)
  if ((await cfgVal(c.env.DB, 'openwa_otp_pesanan', '0')) !== '1' || !siapKirim(cfg)) {
    return c.json({ error: 'Verifikasi WhatsApp tidak diaktifkan.' }, 400)
  }
  const { wa } = await c.req.json()
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid (contoh: 081234567890).' }, 400)

  // Batas harian per nomor: hindari nomor dipakai untuk spam OTP
  const harian = await c.env.DB.prepare(
    "SELECT COUNT(*) v FROM wa_otp WHERE wa = ? AND tujuan = 'pesanan' AND created_at > datetime('now','-1 day')"
  ).bind(nomor).first<any>()
  if ((harian?.v ?? 0) >= 10) return c.json({ error: 'Batas permintaan kode hari ini tercapai. Hubungi kami via WhatsApp.' }, 429)

  const r = await buatDanKirimOTP(c.env as OpenWAEnv, nomor, 'pesanan')
  if (!r.ok) return c.json({ error: r.error }, 400)
  return c.json({ sukses: true, menit: r.menit, waSensor: sensorWA(nomor) })
})

// ============================================================
//  H. WEBHOOK MASUK DARI OPENWA
//     HMAC-SHA256 atas RAW BODY wajib valid (X-OpenWA-Signature)
// ============================================================

waRoutes.post('/api/webhook/openwa', async (c) => {
  const raw = await c.req.text()
  const sig = c.req.header('X-OpenWA-Signature') || c.req.header('x-openwa-signature')

  // Rahasia webhook boleh berasal dari environment (diprioritaskan) atau
  // dari dashboard. Tanda tangan tetap WAJIB valid — tidak ada jalan pintas.
  const rahasiaWebhook = await ambilRahasia(c.env.DB, 'OPENWA_WEBHOOK_SECRET', c.env.OPENWA_WEBHOOK_SECRET)
  if (!rahasiaWebhook) {
    return c.json({ error: 'Webhook belum dikonfigurasi. Isi "Webhook Secret" di dashboard WhatsApp.' }, 503)
  }
  if (!(await verifikasiTandaTangan(raw, sig, rahasiaWebhook))) {
    return c.json({ error: 'Tanda tangan webhook tidak valid.' }, 401)
  }

  let body: any = null
  try { body = JSON.parse(raw) } catch { return c.json({ error: 'Body bukan JSON.' }, 400) }
  const event = body?.event || ''
  const data = body?.data || {}

  // Kita hanya menangani pesan masuk dari chat perorangan
  if (event !== 'message.received') return c.json({ ok: true, diabaikan: event })
  if (data?.fromMe || data?.isGroup) return c.json({ ok: true, diabaikan: 'bukan chat perorangan' })

  const pengirim = normalWA(String(data.from || '').split('@')[0])
  const isi = String(data.body || '').trim()
  const messageId = String(data.id || body?.idempotencyKey || '')
  if (!pengirim) return c.json({ ok: true })

  // Idempotency: OpenWA bisa mengirim ulang delivery yang sama
  if (messageId) {
    const ada = await c.env.DB.prepare('SELECT id FROM wa_masuk WHERE message_id = ?').bind(messageId).first()
    if (ada) return c.json({ ok: true, duplikat: true })
  }

  const balasan = await susunAutoReply(c.env as any, pengirim, isi)
  try {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO wa_masuk (message_id, pengirim, nama_pengirim, isi, tipe, dibalas, balasan)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(messageId || null, pengirim, String(data?.contact?.pushName || data?.contact?.name || '').slice(0, 60),
      isi.slice(0, 1000), String(data.type || 'chat'), balasan ? 1 : 0, (balasan || '').slice(0, 1000)).run()
  } catch { /* pencatatan gagal tidak boleh membatalkan balasan */ }

  if (balasan) {
    await kirimWA(c.env as OpenWAEnv, pengirim, balasan, {
      jenis: 'autoreply', entitas: 'wa-masuk', entitasId: messageId, tanpaLog: false
    })
  }

  // Titik lazy-cron: pengingat harian ikut jalan saat ada trafik masuk
  c.executionCtx?.waitUntil?.(jalankanPengingatHarian(c.env as OpenWAEnv).then(() => {}).catch(() => {}))
  return c.json({ ok: true, dibalas: !!balasan })
})

/**
 * Susun balasan otomatis. Perintah yang dikenali:
 *   CEK <kode>  → status pesanan
 *   HARGA       → daftar harga produk aktif
 *   JAM         → jam operasional & alamat
 *   lainnya     → menu bantuan (sekali per 6 jam agar tidak membanjiri)
 */
async function susunAutoReply(
  env: WABindings,
  pengirim: string,
  isi: string
): Promise<string | null> {
  if ((await cfgVal(env.DB, 'openwa_autoreply', '1')) !== '1') return null
  const db = env.DB
  const situs = await namaSitus(db)
  const teks = isi.toUpperCase().trim()

  // --- CEK <kode pesanan> ---
  const m = teks.match(/^CEK\s+([A-Z0-9\-\/]+)/)
  if (m) {
    const kode = m[1]
    const ps = await db.prepare(
      `SELECT ps.kode, ps.status, ps.tanggal_kirim, pl.nama, pl.wa,
              (SELECT COALESCE(SUM(subtotal),0) FROM pesanan_item WHERE pesanan_id = ps.id) total
       FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id
       WHERE UPPER(ps.kode) = ?`
    ).bind(kode).first<any>()
    if (!ps) return `Kode pesanan *${kode}* tidak ditemukan. Cek kembali kode pada pesan konfirmasi Anda ya. 🙏`
    // Privasi: hanya nomor pemesan boleh melihat detail pesanannya
    if (normalWA(ps.wa) !== pengirim) {
      return `Kode *${kode}* terdaftar, tetapi bukan atas nomor WhatsApp ini. Untuk keamanan data, silakan cek dari nomor yang dipakai saat memesan. 🙏`
    }
    const label: Record<string, string> = {
      baru: 'Baru diterima ⏳', diproses: 'Sedang diproses 🍄',
      siap: 'Siap dikirim/diambil 📦', selesai: 'Selesai ✅', batal: 'Dibatalkan ❌'
    }
    return `*Status Pesanan ${ps.kode}*\n\nPelanggan: ${ps.nama}\nStatus: *${label[ps.status] || ps.status}*\nTotal: ${rupiah(ps.total)}\nRencana kirim: ${tanggalID(ps.tanggal_kirim)}\n\n_${situs}_`
  }

  // --- HARGA ---
  if (/^(HARGA|DAFTAR HARGA|PRICE|PRICELIST|MENU HARGA)$/.test(teks)) {
    const { results } = await db.prepare(
      'SELECT nama, harga, satuan FROM produk WHERE aktif = 1 ORDER BY id LIMIT 20'
    ).all<any>()
    if (!results.length) return `Maaf, daftar harga belum tersedia. Hubungi kami langsung ya. 🙏`
    const baris = (results as any[]).map((p) => `• ${p.nama}: *${rupiah(p.harga)}*/${p.satuan || 'kg'}`).join('\n')
    return `*DAFTAR HARGA ${situs.toUpperCase()}* 🍄\n\n${baris}\n\nPesan sekarang lewat website atau balas chat ini. Harga dapat berubah sesuai panen.`
  }

  // --- JAM / ALAMAT ---
  if (/^(JAM|JAM BUKA|ALAMAT|LOKASI|BUKA)$/.test(teks)) {
    const jam = await cfgVal(db, 'jam_operasional', 'Setiap hari 07.00–17.00 WIB')
    const alamat = await cfgVal(db, 'alamat', '-')
    return `*${situs}* 🍄\n\n🕒 Jam operasional:\n${jam}\n\n📍 Alamat:\n${alamat}\n\nBalas *HARGA* untuk daftar harga.`
  }

  // --- Menu bantuan, dibatasi sekali per 6 jam per nomor ---
  const baruSaja = await db.prepare(
    `SELECT COUNT(*) v FROM wa_pesan WHERE tujuan = ? AND jenis = 'autoreply'
     AND created_at > datetime('now','-6 hours')`
  ).bind(pengirim).first<any>()
  if ((baruSaja?.v ?? 0) >= 1) return null

  return await pesanDariTemplate(db, 'autoreply', { situs })
}
