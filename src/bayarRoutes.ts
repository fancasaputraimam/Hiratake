// ============================================================
//  Rute Checkout & Pembayaran
//    /api/checkout/*          : publik — buat pesanan + tagihan
//    /api/bayar/*             : publik — status & instruksi bayar
//    /api/lacak/*             : publik — lacak pesanan via OTP WhatsApp
//    /api/callback/pembayaran : callback gateway (signature diverifikasi)
//    /api/admin/bayar/*       : owner/admin — konfigurasi & verifikasi
// ============================================================
import { Hono } from 'hono'
import {
  type Bindings as AuthBindings, type SessionUser,
  requireAuth, catatAudit
} from './auth'
import {
  type OpenWAEnv, normalWA, validWA, sensorWA, cfgVal, getWAConfig, siapKirim,
  buatDanKirimOTP, verifikasiOTP, rupiah, tanggalID
} from './openwa'
import {
  type BayarEnv, type BayarConfig, type ProviderId, PROVIDER_INFO, KUNCI_BAYAR,
  getBayarConfig, qrisSiap, hitungBiayaAdmin, hitungOngkir, buatTagihan,
  cekStatusTagihan, verifikasiCallback, kodePembayaran, tokenLacak, sidikCallback
} from './payment'
import { saring, sensorRahasia, sumberRahasia, PETA_RAHASIA, itiRahasia } from './rahasia'
import {
  notifBayarMenunggu, notifBayarLunas, notifBayarInternal, notifTerimaSelesai,
  bersihkanBayarKedaluwarsa, waktuWIB, labelMetode
} from './bayarNotifikasi'
import { notifPesananBaru, notifInternalPO } from './waNotifikasi'
// FASE 11 (hasil audit): kode pesanan anti-bentrok + penjualan otomatis
import { buatPesananDenganKode, buatPenjualanDariPesanan } from './pesananOtomatis'

export type BayarBindings = AuthBindings & {
  OPENWA_API_KEY?: string
  OPENWA_WEBHOOK_SECRET?: string
  BAYAR_SERVER_KEY?: string
  BAYAR_CLIENT_KEY?: string
  BAYAR_CALLBACK_SECRET?: string
}

type Env = { Bindings: BayarBindings; Variables: { user: SessionUser } }

export const bayarRoutes = new Hono<Env>()

const MAKS_ITEM = 20
const MAKS_QTY = 500

/** Batas waktu bayar dalam teks ramah manusia (WIB). */
function batasWaktuTeks(menit: number): string {
  const d = new Date(Date.now() + (menit + 7 * 60) * 60000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} WIB ` +
    `(${menit} menit dari sekarang)`
}

// ============================================================
//  A. INFO CHECKOUT (publik) — dipakai frontend menyusun form
// ============================================================

bayarRoutes.get('/api/checkout/info', async (c) => {
  const db = c.env.DB
  const cfg = await getBayarConfig(c.env as BayarEnv)
  const waCfg = await getWAConfig(c.env as OpenWAEnv)
  const otpWajib = (await cfgVal(db, 'openwa_otp_pesanan', '0')) === '1' && siapKirim(waCfg)
  const pesananAktif = (await cfgVal(db, 'situs_pesanan_online', '1')) !== '0'
  const qris = qrisSiap(cfg)

  const { results: produk } = await db.prepare(
    'SELECT id, nama, jp, harga, satuan, ikon, badge FROM produk WHERE aktif = 1 ORDER BY id'
  ).all()

  return c.json({
    pesananAktif,
    produk,
    otpWajib,
    // Kredensial TIDAK pernah dikirim — hanya kesiapan metode
    metode: {
      cash: cfg.aktif && cfg.cash,
      qris: qris.ok,
      qrisAlasan: qris.ok ? '' : qris.alasan
    },
    ongkir: cfg.ongkir,
    ongkirGratisMin: cfg.ongkirGratisMin,
    biayaMode: cfg.biayaMode,
    biayaPersen: cfg.biayaPersen,
    biayaTetap: cfg.biayaTetap,
    minQris: cfg.minQris,
    maksQris: cfg.maksQris,
    instruksiCash: cfg.instruksiCash,
    lacakAktif: (await cfgVal(db, 'lacak_aktif', '1')) === '1'
  })
})

// ============================================================
//  B. CHECKOUT (publik)
// ============================================================

bayarRoutes.post('/api/checkout', async (c) => {
  const db = c.env.DB

  if ((await cfgVal(db, 'situs_pesanan_online', '1')) === '0') {
    return c.json({ error: 'Pesanan online sedang dinonaktifkan. Silakan hubungi kami via WhatsApp.' }, 403)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { nama, wa, alamat, catatan, item, metode, otp } = body

  if (!nama || !String(nama).trim()) return c.json({ error: 'Nama wajib diisi.' }, 400)
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid (contoh: 081234567890).' }, 400)
  if (!Array.isArray(item) || item.length === 0) return c.json({ error: 'Keranjang masih kosong.' }, 400)
  if (item.length > MAKS_ITEM) return c.json({ error: `Maksimal ${MAKS_ITEM} jenis produk per pesanan.` }, 400)

  const metodeBayar = metode === 'qris' ? 'qris' : metode === 'cash' ? 'cash' : ''
  if (!metodeBayar) return c.json({ error: 'Pilih metode pembayaran: tunai atau QRIS.' }, 400)

  const cfg = await getBayarConfig(c.env as BayarEnv)
  if (!cfg.aktif) return c.json({ error: 'Pembayaran sedang dinonaktifkan pemilik usaha.' }, 403)
  if (metodeBayar === 'cash' && !cfg.cash) return c.json({ error: 'Pembayaran tunai sedang dinonaktifkan.' }, 400)
  if (metodeBayar === 'qris') {
    const siap = qrisSiap(cfg)
    if (!siap.ok) return c.json({ error: siap.alasan }, 400)
  }

  // --- Verifikasi OTP WhatsApp bila diwajibkan owner ---
  const waCfg = await getWAConfig(c.env as OpenWAEnv)
  const otpWajib = (await cfgVal(db, 'openwa_otp_pesanan', '0')) === '1' && siapKirim(waCfg)
  if (otpWajib) {
    const v = await verifikasiOTP(db, nomor, String(otp || ''), 'pesanan')
    if (!v.ok) return c.json({ error: v.error || 'Verifikasi nomor WhatsApp gagal.', butuhOtp: true }, 400)
  }

  // --- Anti-spam: maksimal 3 pesanan per nomor per hari ---
  const spam = await db.prepare(
    `SELECT COUNT(*) v FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id
     WHERE pl.wa = ? AND ps.created_at > datetime('now','-1 day') AND ps.status != 'batal'`
  ).bind(nomor).first<any>()
  if ((spam?.v ?? 0) >= 3) {
    return c.json({ error: 'Terlalu banyak pesanan hari ini. Hubungi kami via WhatsApp langsung ya.' }, 429)
  }

  // --- Validasi item; harga SELALU dari database (anti-miss) ---
  const baris: any[] = []
  for (const it of item) {
    const jml = parseInt(it?.jumlah)
    // Terima kedua gaya penamaan agar klien lama/baru sama-sama jalan
    const pid = it?.produk_id ?? it?.produkId
    if (!pid || !jml || jml <= 0 || jml > MAKS_QTY) continue
    const p = await db.prepare('SELECT id, nama, harga FROM produk WHERE id = ? AND aktif = 1')
      .bind(pid).first<any>()
    if (p) baris.push({ produk_id: p.id, nama_produk: p.nama, jumlah: jml, harga: p.harga, subtotal: p.harga * jml })
  }
  if (!baris.length) return c.json({ error: 'Produk yang dipilih tidak valid.' }, 400)

  const subtotal = baris.reduce((a, b) => a + b.subtotal, 0)
  const ongkir = hitungOngkir(cfg, subtotal)
  const biayaAdmin = metodeBayar === 'qris' ? hitungBiayaAdmin(cfg, subtotal + ongkir) : 0
  const totalBayar = subtotal + ongkir + biayaAdmin

  if (metodeBayar === 'qris') {
    if (cfg.minQris > 0 && totalBayar < cfg.minQris) {
      return c.json({ error: `Minimal pembayaran QRIS ${rupiah(cfg.minQris)}. Tambah pesanan atau pilih bayar tunai.` }, 400)
    }
    if (cfg.maksQris > 0 && totalBayar > cfg.maksQris) {
      return c.json({ error: `Maksimal pembayaran QRIS ${rupiah(cfg.maksQris)}. Silakan hubungi kami via WhatsApp.` }, 400)
    }
  }

  // --- Pelanggan: cari / daftarkan otomatis dari nomor WA ---
  let pel = await db.prepare('SELECT id FROM pelanggan WHERE wa = ?').bind(nomor).first<any>()
  if (!pel) {
    const r = await db.prepare(
      "INSERT INTO pelanggan (nama, tipe, wa, alamat, catatan, aktif) VALUES (?, 'eceran', ?, ?, 'Daftar sendiri via checkout web', 1)"
    ).bind(String(nama).trim().slice(0, 60), nomor, String(alamat || '').trim().slice(0, 200)).run()
    pel = { id: r.meta.last_row_id }
  }

  // --- Buat pesanan ---
  const hariIni = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const bulan = hariIni.slice(0, 7)
  const token = tokenLacak()
  const statusBayarAwal = metodeBayar === 'cash' ? 'belum' : 'menunggu'

  // FASE 11 (audit): kode dulu dihitung COUNT(*) — dua pelanggan yang checkout
  // pada detik yang sama menghasilkan kode kembar dan salah satu GAGAL (500).
  // Sekarang nomor terakhir + coba ulang otomatis, pelanggan tidak lihat error.
  const { kode, id: pesananId } = await buatPesananDenganKode(db, bulan, (kodeBaru) =>
    db.prepare(
      `INSERT INTO pesanan
         (kode, pelanggan_id, tanggal_pesan, tanggal_kirim, status, catatan, sumber,
          metode_bayar, status_bayar, alamat_kirim, ongkir, biaya_admin, total_bayar, token_lacak)
       VALUES (?, ?, ?, ?, 'baru', ?, 'web', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      kodeBaru, pel.id, hariIni, hariIni, String(catatan || '').trim().slice(0, 300),
      metodeBayar, statusBayarAwal, String(alamat || '').trim().slice(0, 200),
      ongkir, biayaAdmin, totalBayar, token
    ).run() as any
  )

  await db.batch(baris.map((b) =>
    db.prepare('INSERT INTO pesanan_item (pesanan_id, produk_id, nama_produk, jumlah, harga, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(pesananId, b.produk_id, b.nama_produk, b.jumlah, b.harga, b.subtotal)
  ))
  await catatAudit(db, null, 'tambah', 'checkout', kode,
    `Checkout web: ${nama} (${nomor}) — ${labelMetode[metodeBayar]} ${rupiah(totalBayar)}`)

  // --- Bayar tunai: langsung selesai, cukup notifikasi ---
  if (metodeBayar === 'cash') {
    const kodeBayar = kodePembayaran()
    await db.prepare(
      `INSERT INTO pembayaran (kode, pesanan_id, metode, provider, jumlah, biaya_admin, status, instruksi)
       VALUES (?, ?, 'cash', 'manual', ?, 0, 'menunggu', ?)`
    ).bind(kodeBayar, pesananId, totalBayar, cfg.instruksiCash).run()

    c.executionCtx?.waitUntil?.(Promise.allSettled([
      notifPesananBaru(c.env as OpenWAEnv, pesananId, null),
      notifInternalPO(c.env as OpenWAEnv, pesananId)
    ]).then(() => {}))

    return c.json({
      sukses: true, kode, pesananId, metode: 'cash',
      subtotal, ongkir, biayaAdmin, totalBayar,
      token, instruksi: cfg.instruksiCash,
      lacakUrl: `/lacak?token=${token}`
    })
  }

  // --- Bayar QRIS: buat tagihan di provider ---
  const kodeBayar = kodePembayaran()
  const asal = new URL(c.req.url).origin
  const tagihan = await buatTagihan(cfg, {
    kodePembayaran: kodeBayar,
    kodePesanan: kode,
    jumlah: totalBayar,
    namaPelanggan: String(nama).trim(),
    waPelanggan: nomor,
    item: [
      ...baris.map((b) => ({ nama: b.nama_produk, harga: b.harga, jumlah: b.jumlah })),
      ...(ongkir > 0 ? [{ nama: 'Ongkos kirim', harga: ongkir, jumlah: 1 }] : []),
      ...(biayaAdmin > 0 ? [{ nama: 'Biaya layanan', harga: biayaAdmin, jumlah: 1 }] : [])
    ],
    kedaluwarsaMenit: cfg.kedaluwarsaMenit,
    urlKembali: `${asal}/bayar?kode=${kodeBayar}`,
    urlCallback: `${asal}/api/callback/pembayaran`
  })

  if (!tagihan.ok) {
    // Pesanan sudah tercatat; tandai gagal bayar agar tidak menggantung
    await db.prepare("UPDATE pesanan SET status_bayar='gagal' WHERE id = ?").bind(pesananId).run()
    return c.json({
      error: `Gagal membuat tagihan QRIS: ${tagihan.error}. Pesanan ${kode} tetap tercatat — silakan pilih bayar tunai atau hubungi kami.`,
      kode
    }, 502)
  }

  await db.prepare(
    `INSERT INTO pembayaran
       (kode, pesanan_id, metode, provider, jumlah, biaya_admin, status, ref_id,
        qr_string, qr_url, bayar_url, instruksi, expires_at, respons)
     VALUES (?, ?, 'qris', ?, ?, ?, 'menunggu', ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' minutes'), ?)`
  ).bind(
    kodeBayar, pesananId, cfg.provider, totalBayar, biayaAdmin,
    tagihan.refId || '', tagihan.qrString || '', tagihan.qrUrl || '',
    tagihan.bayarUrl || '', tagihan.instruksi || '', cfg.kedaluwarsaMenit, tagihan.respons || ''
  ).run()

  const linkBayar = `${asal}/bayar?kode=${kodeBayar}`
  c.executionCtx?.waitUntil?.(Promise.allSettled([
    notifBayarMenunggu(c.env as OpenWAEnv, pesananId, linkBayar, batasWaktuTeks(cfg.kedaluwarsaMenit)),
    notifInternalPO(c.env as OpenWAEnv, pesananId)
  ]).then(() => {}))

  return c.json({
    sukses: true, kode, pesananId, metode: 'qris',
    kodeBayar, subtotal, ongkir, biayaAdmin, totalBayar,
    token, bayarUrl: linkBayar, lacakUrl: `/lacak?token=${token}`,
    kedaluwarsaMenit: cfg.kedaluwarsaMenit
  })
})

// ============================================================
//  C. HALAMAN & STATUS PEMBAYARAN (publik)
// ============================================================

/** Detail satu pembayaran untuk halaman /bayar (tanpa data sensitif). */
bayarRoutes.get('/api/bayar/:kode', async (c) => {
  const db = c.env.DB
  // Lazy-cron: sekalian bereskan tagihan yang sudah lewat batas waktu
  c.executionCtx?.waitUntil?.(bersihkanBayarKedaluwarsa(c.env as OpenWAEnv).then(() => {}).catch(() => {}))

  const p = await db.prepare(
    `SELECT b.kode, b.metode, b.provider, b.jumlah, b.biaya_admin, b.status, b.qr_string,
            b.qr_url, b.bayar_url, b.instruksi, b.expires_at, b.dibayar_at,
            ps.kode AS pesanan_kode, ps.ongkir, ps.token_lacak, ps.status AS pesanan_status,
            pl.nama AS pelanggan_nama
     FROM pembayaran b
     JOIN pesanan ps ON ps.id = b.pesanan_id
     LEFT JOIN pelanggan pl ON pl.id = ps.pelanggan_id
     WHERE b.kode = ?`
  ).bind(c.req.param('kode')).first<any>()
  if (!p) return c.json({ error: 'Data pembayaran tidak ditemukan.' }, 404)

  const { results: items } = await db.prepare(
    `SELECT pi.nama_produk, pi.jumlah, pi.harga, pi.subtotal
     FROM pesanan_item pi JOIN pesanan ps ON ps.id = pi.pesanan_id
     WHERE ps.kode = ?`
  ).bind(p.pesanan_kode).all()

  const cfg = await getBayarConfig(c.env as BayarEnv)
  return c.json({
    kode: p.kode,
    pesananKode: p.pesanan_kode,
    pelanggan: p.pelanggan_nama || '',
    metode: p.metode,
    status: p.status,
    jumlah: p.jumlah,
    ongkir: p.ongkir,
    biayaAdmin: p.biaya_admin,
    qrString: p.qr_string || '',
    qrUrl: p.qr_url || '',
    bayarUrl: p.bayar_url || '',
    instruksi: p.instruksi || '',
    expiresAt: p.expires_at,
    dibayarAt: p.dibayar_at,
    item: items,
    // Untuk QRIS statis (manual) pelanggan diminta kirim bukti via WA
    perluBuktiManual: p.provider === 'manual' && p.metode === 'qris',
    qrisNama: p.provider === 'manual' ? cfg.qrisNama : '',
    lacakUrl: p.token_lacak ? `/lacak?token=${p.token_lacak}` : ''
  })
})

/** Polling status. Untuk gateway asli sekaligus mengecek ulang ke provider. */
bayarRoutes.get('/api/bayar/:kode/status', async (c) => {
  const db = c.env.DB
  const p = await db.prepare(
    'SELECT id, pesanan_id, kode, metode, provider, status, ref_id, jumlah FROM pembayaran WHERE kode = ?'
  ).bind(c.req.param('kode')).first<any>()
  if (!p) return c.json({ error: 'Data pembayaran tidak ditemukan.' }, 404)
  if (p.status !== 'menunggu') return c.json({ status: p.status, final: true })

  // Provider manual: hanya admin yang bisa menandai lunas
  if (p.provider === 'manual') return c.json({ status: 'menunggu', final: false, manual: true })

  const cfg = await getBayarConfig(c.env as BayarEnv)
  const s = await cekStatusTagihan(cfg, p.kode, p.ref_id)
  if (!s.ok) return c.json({ status: 'menunggu', final: false, catatan: s.error })

  if (s.status === 'dibayar') {
    await tandaiLunas(c, p.id, p.pesanan_id, p.metode, 'polling')
    return c.json({ status: 'dibayar', final: true })
  }
  if (s.status === 'kedaluwarsa' || s.status === 'gagal') {
    await db.prepare("UPDATE pembayaran SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(s.status, p.id).run()
    await db.prepare('UPDATE pesanan SET status_bayar=? WHERE id=?').bind(s.status, p.pesanan_id).run()
    return c.json({ status: s.status, final: true })
  }
  return c.json({ status: 'menunggu', final: false })
})

/**
 * Tandai pembayaran lunas + perbarui pesanan + kirim notifikasi.
 * Idempoten: hanya berpengaruh bila baris masih berstatus 'menunggu'.
 */
async function tandaiLunas(
  c: any,
  pembayaranId: number,
  pesananId: number,
  metode: string,
  sumber: string,
  userId?: number | null
): Promise<boolean> {
  const db = c.env.DB as D1Database
  const upd = await db.prepare(
    `UPDATE pembayaran SET status='dibayar', dibayar_at=CURRENT_TIMESTAMP,
       updated_at=CURRENT_TIMESTAMP, diverifikasi_oleh=?, catatan = catatan || ?
     WHERE id = ? AND status = 'menunggu'`
  ).bind(userId ?? null, ` [lunas via ${sumber}]`, pembayaranId).run()

  // Tidak ada baris berubah = sudah diproses sebelumnya (callback dobel)
  if (!upd.meta.changes) return false

  await db.prepare(
    "UPDATE pesanan SET status_bayar='lunas', dibayar_at=CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(pesananId).run()

  const asal = new URL(c.req.url).origin
  const ps = await db.prepare('SELECT kode, token_lacak FROM pesanan WHERE id = ?').bind(pesananId).first<any>()
  const linkLacak = ps?.token_lacak ? `${asal}/lacak?token=${ps.token_lacak}` : asal
  await catatAudit(db, null, 'ubah', 'pembayaran', ps?.kode || String(pesananId),
    `Pembayaran ${metode} lunas (${sumber})`)

  // ===== FASE 11 (hasil audit) — OTOMATIS CATAT PENJUALAN =====
  // TEMUAN: sebelumnya pembayaran lunas hanya mengubah status_bayar.
  // Baris `penjualan` baru muncul kalau admin menekan tombol "Selesai".
  // Akibatnya bila admin lupa: omzet, laporan, stok, dan pajak BUTA
  // padahal uang pelanggan sudah masuk. Ongkir & biaya admin pun
  // tidak pernah tercatat di buku kas sama sekali.
  //
  // Sekarang penjualan + ongkir + biaya dicatat otomatis begitu lunas.
  // Fungsinya idempoten (dikunci lewat kolom penjualan_dibuat), jadi
  // callback dobel atau tombol admin sesudahnya tidak akan menggandakan.
  const tugasJual = (async () => {
    if ((await cfgVal(db, 'otomatis_jual_lunas', '1')) !== '1') return
    await buatPenjualanDariPesanan(c.env as OpenWAEnv, pesananId, {
      bayar: 'lunas', userId: userId ?? null, sumber: `bayar-${sumber}`
    })
  })().catch(() => {})

  const tugas = Promise.allSettled([
    notifBayarLunas(c.env as OpenWAEnv, pesananId, metode, linkLacak),
    notifBayarInternal(c.env as OpenWAEnv, pesananId, metode),
    tugasJual
  ]).then(() => {})
  c.executionCtx?.waitUntil?.(tugas)
  return true
}

// ============================================================
//  D. CALLBACK GATEWAY (publik, signature wajib valid)
// ============================================================

bayarRoutes.post('/api/callback/pembayaran', async (c) => {
  const db = c.env.DB
  const raw = await c.req.text()
  const cfg = await getBayarConfig(c.env as BayarEnv)

  // Provider bisa dipaksa lewat query (?provider=) untuk kasus multi-gateway,
  // default mengikuti pilihan owner.
  const q = String(c.req.query('provider') || '').toLowerCase()
  const provider: ProviderId = (PROVIDER_INFO as any)[q] ? (q as ProviderId) : cfg.provider

  const sidik = await sidikCallback(provider, raw)
  const hasil = await verifikasiCallback(cfg, provider, raw, (n) => c.req.header(n))

  // Semua callback dicatat (audit + idempotency).
  // FASE 11 (audit): dulu SEMUA error di sini dilaporkan ke gateway sebagai
  // "duplikat: ok", termasuk error DB sesungguhnya — gateway berhenti mengirim
  // ulang dan pembayaran hilang tanpa jejak. Sekarang hanya pelanggaran UNIQUE
  // (memang callback kembar) yang dianggap duplikat; error lain dibalas 500
  // supaya gateway MENGULANG pengirimannya.
  try {
    await db.prepare(
      `INSERT INTO pembayaran_callback (provider, ref_id, sidik, tanda_tangan_sah, isi)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(provider, hasil.refId || '', sidik, hasil.sah ? 1 : 0, raw.slice(0, 4000)).run()
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/UNIQUE|constraint failed/i.test(msg)) {
      // sidik duplikat → callback yang sama sudah pernah diproses
      return c.json({ ok: true, duplikat: true })
    }
    await catatAudit(db, null, 'ubah', 'pembayaran-callback', hasil.refId || '-',
      `GAGAL simpan callback (${provider}): ${msg.slice(0, 200)}`).catch(() => {})
    return c.json({ error: 'Gagal menyimpan callback, silakan kirim ulang.' }, 500)
  }

  if (!hasil.sah) {
    await db.prepare("UPDATE pembayaran_callback SET hasil=? WHERE sidik=?")
      .bind(hasil.error || 'signature tidak valid', sidik).run()
    return c.json({ error: hasil.error || 'Signature tidak valid.' }, 401)
  }

  const p = await db.prepare(
    'SELECT id, pesanan_id, metode, jumlah, status FROM pembayaran WHERE kode = ? OR (ref_id != \'\' AND ref_id = ?)'
  ).bind(hasil.kodePembayaran || '', hasil.refId || '').first<any>()
  if (!p) {
    await db.prepare("UPDATE pembayaran_callback SET hasil='transaksi tidak ditemukan' WHERE sidik=?")
      .bind(sidik).run()
    return c.json({ error: 'Transaksi tidak ditemukan.' }, 404)
  }

  // Anti-miss: jumlah yang dibayar harus sama dengan tagihan
  if (hasil.status === 'dibayar' && hasil.jumlah && Math.abs(hasil.jumlah - p.jumlah) > 1) {
    await db.prepare("UPDATE pembayaran_callback SET hasil=? WHERE sidik=?")
      .bind(`jumlah tidak cocok (callback ${hasil.jumlah} vs tagihan ${p.jumlah})`, sidik).run()
    return c.json({ error: 'Jumlah pembayaran tidak sesuai tagihan.' }, 409)
  }

  let catatanHasil = 'diabaikan (status ' + hasil.status + ')'
  if (hasil.status === 'dibayar') {
    const berubah = await tandaiLunas(c, p.id, p.pesanan_id, p.metode, `callback ${provider}`)
    catatanHasil = berubah ? 'pembayaran ditandai lunas' : 'sudah lunas sebelumnya'
  } else if (hasil.status === 'kedaluwarsa' || hasil.status === 'gagal') {
    await db.prepare(
      "UPDATE pembayaran SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='menunggu'"
    ).bind(hasil.status, p.id).run()
    await db.prepare(
      "UPDATE pesanan SET status_bayar=? WHERE id=? AND status_bayar='menunggu'"
    ).bind(hasil.status, p.pesanan_id).run()
    catatanHasil = 'ditandai ' + hasil.status
  }

  await db.prepare("UPDATE pembayaran_callback SET diproses=1, hasil=?, status_kirim=? WHERE sidik=?")
    .bind(catatanHasil, hasil.status || '', sidik).run()
  return c.json({ ok: true, hasil: catatanHasil })
})

// ============================================================
//  E. LACAK PESANAN (publik) — fitur pendukung OTP WhatsApp
// ============================================================

/** Lacak via token rahasia dari link (tanpa OTP). */
bayarRoutes.get('/api/lacak/token/:token', async (c) => {
  const t = String(c.req.param('token') || '')
  if (t.length < 16) return c.json({ error: 'Token tidak valid.' }, 400)
  const ps = await c.env.DB.prepare(
    `SELECT ps.id, ps.kode, ps.status, ps.status_bayar, ps.metode_bayar, ps.tanggal_pesan,
            ps.tanggal_kirim, ps.total_bayar, ps.ongkir, ps.biaya_admin, ps.alamat_kirim,
            ps.diterima_at, pl.nama, pl.wa
     FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id
     WHERE ps.token_lacak = ?`
  ).bind(t).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  return c.json({ pesanan: await susunLacak(c.env.DB, ps) })
})

/** Minta kode OTP untuk melihat semua pesanan milik satu nomor. */
bayarRoutes.post('/api/lacak/otp', async (c) => {
  const db = c.env.DB
  if ((await cfgVal(db, 'lacak_aktif', '1')) !== '1') {
    return c.json({ error: 'Fitur lacak pesanan sedang dinonaktifkan.' }, 403)
  }
  const waCfg = await getWAConfig(c.env as OpenWAEnv)
  if (!siapKirim(waCfg)) {
    return c.json({ error: 'Layanan WhatsApp belum aktif. Gunakan link lacak dari pesan konfirmasi Anda.' }, 503)
  }
  const { wa } = await c.req.json().catch(() => ({} as any))
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid.' }, 400)

  // Batas harian agar nomor gateway tidak dipakai spam
  const harian = await db.prepare(
    "SELECT COUNT(*) v FROM wa_otp WHERE wa = ? AND tujuan = 'lacak' AND created_at > datetime('now','-1 day')"
  ).bind(nomor).first<any>()
  if ((harian?.v ?? 0) >= 10) return c.json({ error: 'Batas permintaan kode hari ini tercapai.' }, 429)

  // Jawaban seragam: tidak membocorkan apakah nomor terdaftar
  const ada = await db.prepare('SELECT id FROM pelanggan WHERE wa = ?').bind(nomor).first<any>()
  if (ada) {
    const r = await buatDanKirimOTP(c.env as OpenWAEnv, nomor, 'lacak')
    if (!r.ok) return c.json({ error: r.error }, 400)
  }
  return c.json({ sukses: true, menit: 5, waSensor: sensorWA(nomor) })
})

/** Verifikasi OTP → tampilkan daftar pesanan nomor tersebut. */
bayarRoutes.post('/api/lacak/verifikasi', async (c) => {
  const db = c.env.DB
  const { wa, kode } = await c.req.json().catch(() => ({} as any))
  const nomor = normalWA(wa)
  if (!validWA(nomor)) return c.json({ error: 'Nomor WhatsApp tidak valid.' }, 400)

  const v = await verifikasiOTP(db, nomor, String(kode || ''), 'lacak')
  if (!v.ok) return c.json({ error: v.error }, 400)

  const { results } = await db.prepare(
    `SELECT ps.id, ps.kode, ps.status, ps.status_bayar, ps.metode_bayar, ps.tanggal_pesan,
            ps.tanggal_kirim, ps.total_bayar, ps.ongkir, ps.biaya_admin, ps.alamat_kirim,
            ps.token_lacak, ps.diterima_at, pl.nama, pl.wa
     FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id
     WHERE pl.wa = ? ORDER BY ps.id DESC LIMIT 20`
  ).bind(nomor).all<any>()

  const daftar = []
  for (const ps of results as any[]) daftar.push(await susunLacak(db, ps, true))
  return c.json({ sukses: true, pesanan: daftar })
})

async function susunLacak(db: D1Database, ps: any, sertakanToken = false) {
  const { results: items } = await db.prepare(
    'SELECT nama_produk, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?'
  ).bind(ps.id).all()
  const bayar = await db.prepare(
    `SELECT kode, status, metode FROM pembayaran WHERE pesanan_id = ? ORDER BY id DESC LIMIT 1`
  ).bind(ps.id).first<any>()
  return {
    kode: ps.kode,
    nama: ps.nama,
    waSensor: sensorWA(ps.wa),
    status: ps.status,
    statusBayar: ps.status_bayar,
    metodeBayar: ps.metode_bayar,
    tanggalPesan: ps.tanggal_pesan,
    tanggalKirim: ps.tanggal_kirim,
    totalBayar: ps.total_bayar,
    ongkir: ps.ongkir,
    biayaAdmin: ps.biaya_admin,
    alamatKirim: ps.alamat_kirim || '',
    diterimaAt: ps.diterima_at,
    item: items,
    kodeBayar: bayar?.kode || '',
    bayarUrl: bayar && bayar.status === 'menunggu' && bayar.metode === 'qris' ? `/bayar?kode=${bayar.kode}` : '',
    ...(sertakanToken && ps.token_lacak ? { lacakUrl: `/lacak?token=${ps.token_lacak}` } : {})
  }
}

// ============================================================
//  F. KONFIRMASI TERIMA BARANG via OTP (publik + kurir)
// ============================================================

/** Kurir/admin minta kode konfirmasi dikirim ke WA pelanggan. */
bayarRoutes.post('/api/admin/pesanan/:id/terima/kirim-kode', requireAuth(), async (c) => {
  const db = c.env.DB
  if ((await cfgVal(db, 'terima_otp', '1')) !== '1') {
    return c.json({ error: 'Konfirmasi terima via OTP sedang dinonaktifkan.' }, 403)
  }
  const ps = await db.prepare(
    `SELECT ps.id, ps.kode, ps.diterima_at, pl.wa FROM pesanan ps
     JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
  ).bind(c.req.param('id')).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  if (ps.diterima_at) return c.json({ error: 'Pesanan sudah dikonfirmasi diterima.' }, 400)
  const nomor = normalWA(ps.wa)
  if (!validWA(nomor)) return c.json({ error: 'Pelanggan belum punya nomor WhatsApp yang valid.' }, 400)

  const r = await buatDanKirimOTP(c.env as OpenWAEnv, nomor, 'terima', c.get('user').id, { kode: ps.kode })
  if (!r.ok) return c.json({ error: r.error }, 400)
  return c.json({ sukses: true, waSensor: sensorWA(nomor), menit: r.menit })
})

/** Kurir memasukkan kode dari pelanggan → pesanan ditandai diterima. */
bayarRoutes.post('/api/admin/pesanan/:id/terima', requireAuth(), async (c) => {
  const db = c.env.DB
  const { kode } = await c.req.json().catch(() => ({} as any))
  const ps = await db.prepare(
    `SELECT ps.id, ps.kode, ps.diterima_at, pl.wa FROM pesanan ps
     JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?`
  ).bind(c.req.param('id')).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  if (ps.diterima_at) return c.json({ error: 'Pesanan sudah dikonfirmasi diterima.' }, 400)

  const v = await verifikasiOTP(db, normalWA(ps.wa), String(kode || ''), 'terima')
  if (!v.ok) return c.json({ error: v.error }, 400)

  const user = c.get('user')
  await db.prepare(
    'UPDATE pesanan SET diterima_at=CURRENT_TIMESTAMP, diterima_oleh=? WHERE id=?'
  ).bind(user.nama, ps.id).run()
  await catatAudit(db, user, 'ubah', 'pesanan', ps.kode, 'Konfirmasi terima barang via OTP pelanggan')
  c.executionCtx?.waitUntil?.(notifTerimaSelesai(c.env as OpenWAEnv, ps.id))
  return c.json({ sukses: true })
})

// ============================================================
//  G. ADMIN: KONFIGURASI PEMBAYARAN (owner)
// ============================================================

bayarRoutes.get('/api/admin/bayar/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT key, value FROM pengaturan
     WHERE key LIKE 'bayar_%' OR key LIKE 'rahasia_bayar_%' OR key IN ('lacak_aktif','lacak_otp','terima_otp')`
  ).all<{ key: string; value: string }>()
  const map: Record<string, string> = {}
  for (const r of results) map[r.key] = r.value

  const cfg = await getBayarConfig(c.env as BayarEnv)
  const siap = qrisSiap(cfg)
  const asal = new URL(c.req.url).origin
  return c.json({
    // `saring` membuang nilai kredensial sebelum dikirim ke browser
    pengaturan: saring(map),
    // Dari mana kredensial berasal: 'server' (env) / 'web' (database) / 'kosong'
    serverKeySumber: sumberRahasia(c.env.BAYAR_SERVER_KEY, map.rahasia_bayar_server_key || ''),
    clientKeySumber: sumberRahasia(c.env.BAYAR_CLIENT_KEY, map.rahasia_bayar_client_key || ''),
    callbackSecretSumber: sumberRahasia(c.env.BAYAR_CALLBACK_SECRET, map.rahasia_bayar_callback_secret || ''),
    serverKeyPetunjuk: sensorRahasia(cfg.serverKey),
    clientKeyPetunjuk: sensorRahasia(cfg.clientKey),
    provider: Object.entries(PROVIDER_INFO).map(([id, i]) => ({ id, ...i })),
    // Kredensial TIDAK dikirim — hanya status terpasang
    serverKeyTerpasang: !!cfg.serverKey,
    clientKeyTerpasang: !!cfg.clientKey,
    callbackSecretTerpasang: !!cfg.callbackSecret,
    qrisSiap: siap.ok,
    qrisAlasan: siap.alasan || '',
    callbackUrl: `${asal}/api/callback/pembayaran`
  })
})

// ------------------------------------------------------------
//  Simpan / hapus kredensial gateway dari dashboard — KHUSUS OWNER
// ------------------------------------------------------------
bayarRoutes.put('/api/admin/bayar/kredensial', requireAuth(['owner']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const izin: Record<string, string> = {
    server_key: 'BAYAR_SERVER_KEY',
    client_key: 'BAYAR_CLIENT_KEY',
    callback_secret: 'BAYAR_CALLBACK_SECRET'
  }

  const stmts: any[] = []
  const diubah: string[] = []

  for (const [medan, namaEnv] of Object.entries(izin)) {
    if (body[medan] === undefined) continue
    const nilai = String(body[medan] ?? '').trim()
    const kunci = PETA_RAHASIA[namaEnv]

    if (nilai === '') {
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
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'bayar-kredensial', '-', diubah.join(', '))
  return c.json({ sukses: true, pesan: 'Kredensial disimpan. Tidak perlu restart server.' })
})

bayarRoutes.put('/api/admin/bayar/pengaturan', requireAuth(['owner']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const boolKunci = [
    'bayar_aktif', 'bayar_cash', 'bayar_qris', 'bayar_notif_menunggu',
    'bayar_notif_lunas', 'bayar_notif_internal', 'lacak_aktif', 'lacak_otp', 'terima_otp'
  ]
  const izin = [...KUNCI_BAYAR, 'bayar_notif_menunggu', 'bayar_notif_lunas', 'bayar_notif_internal',
    'lacak_aktif', 'lacak_otp', 'terima_otp']

  const stmts: any[] = []
  for (const [key, raw] of Object.entries(body)) {
    if (!izin.includes(key)) continue
    // Sabuk keamanan: kredensial tidak boleh lewat endpoint ini
    if (itiRahasia(key)) continue
    let value = String(raw ?? '').trim()

    if (boolKunci.includes(key)) {
      value = value === '1' || value === 'true' ? '1' : '0'
    } else if (key === 'bayar_provider') {
      if (!(PROVIDER_INFO as any)[value]) return c.json({ error: 'Provider pembayaran tidak dikenali.' }, 400)
    } else if (key === 'bayar_mode') {
      value = value === 'produksi' ? 'produksi' : 'sandbox'
    } else if (key === 'bayar_biaya_mode') {
      value = value === 'bebankan' ? 'bebankan' : 'serap'
    } else if (key === 'bayar_qris_gambar' && value) {
      try {
        const u = new URL(value)
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
      } catch {
        return c.json({ error: 'URL gambar QRIS tidak valid (harus http/https).' }, 400)
      }
    } else if (key === 'bayar_kedaluwarsa_menit') {
      const v = parseInt(value)
      if (isNaN(v) || v < 5 || v > 1440) return c.json({ error: 'Batas waktu bayar harus 5–1440 menit.' }, 400)
      value = String(v)
    } else if (['bayar_biaya_persen'].includes(key)) {
      const v = parseFloat(value)
      if (isNaN(v) || v < 0 || v > 10) return c.json({ error: 'Persentase biaya harus 0–10%.' }, 400)
      value = String(v)
    } else if (['bayar_biaya_tetap', 'bayar_min_qris', 'bayar_maks_qris', 'bayar_ongkir', 'bayar_ongkir_gratis_min'].includes(key)) {
      const v = parseInt(value || '0')
      if (isNaN(v) || v < 0 || v > 100000000) return c.json({ error: 'Nilai rupiah tidak valid.' }, 400)
      value = String(v)
    } else {
      value = value.slice(0, 500)
    }
    stmts.push(c.env.DB.prepare(
      'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(key, value))
  }
  if (!stmts.length) return c.json({ error: 'Tidak ada pengaturan yang dikenali.' }, 400)

  // Guard: QRIS lewat gateway tanpa kredensial hanya akan menggagalkan checkout
  if (body.bayar_qris === '1') {
    const provider = body.bayar_provider || (await cfgVal(c.env.DB, 'bayar_provider', 'manual'))
    const cfgCek = await getBayarConfig(c.env as BayarEnv)
    if (provider !== 'manual' && !cfgCek.serverKey) {
      return c.json({
        error: 'Kredensial gateway belum diisi. Isi kolom "Server Key" di halaman ini lalu simpan, baru aktifkan QRIS gateway.'
      }, 400)
    }
    if (provider === 'manual') {
      const gambar = body.bayar_qris_gambar ?? (await cfgVal(c.env.DB, 'bayar_qris_gambar', ''))
      if (!gambar) return c.json({ error: 'Provider QRIS statis butuh URL gambar QRIS Anda.' }, 400)
    }
  }

  await c.env.DB.batch(stmts)
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'bayar-pengaturan', '-', 'Ubah pengaturan pembayaran')
  return c.json({ sukses: true })
})

// ============================================================
//  H. ADMIN: DAFTAR & VERIFIKASI PEMBAYARAN
// ============================================================

bayarRoutes.get('/api/admin/bayar/transaksi', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const status = c.req.query('status') || ''
  const metode = c.req.query('metode') || ''
  const cari = c.req.query('cari') || ''

  const kondisi: string[] = []
  const nilai: any[] = []
  if (status) { kondisi.push('b.status = ?'); nilai.push(status) }
  if (metode) { kondisi.push('b.metode = ?'); nilai.push(metode) }
  if (cari) {
    kondisi.push('(b.kode LIKE ? OR ps.kode LIKE ? OR pl.nama LIKE ? OR pl.wa LIKE ?)')
    const p = `%${cari}%`; nilai.push(p, p, p, p)
  }
  const where = kondisi.length ? 'WHERE ' + kondisi.join(' AND ') : ''

  const { results } = await db.prepare(
    `SELECT b.id, b.kode, b.metode, b.provider, b.jumlah, b.biaya_admin, b.status,
            b.ref_id, b.expires_at, b.dibayar_at, b.created_at,
            ps.id AS pesanan_id, ps.kode AS pesanan_kode, ps.status AS pesanan_status,
            ps.diterima_at, pl.nama AS pelanggan, pl.wa, u.nama AS verifikator
     FROM pembayaran b
     JOIN pesanan ps ON ps.id = b.pesanan_id
     LEFT JOIN pelanggan pl ON pl.id = ps.pelanggan_id
     LEFT JOIN users u ON u.id = b.diverifikasi_oleh
     ${where} ORDER BY b.id DESC LIMIT 100`
  ).bind(...nilai).all()

  const stat = await db.prepare(
    `SELECT
       COUNT(*) total,
       COALESCE(SUM(CASE WHEN status='dibayar' THEN 1 ELSE 0 END),0) lunas,
       COALESCE(SUM(CASE WHEN status='menunggu' THEN 1 ELSE 0 END),0) menunggu,
       COALESCE(SUM(CASE WHEN status='dibayar' THEN jumlah ELSE 0 END),0) nilai_lunas,
       COALESCE(SUM(CASE WHEN status='dibayar' AND date(dibayar_at,'+7 hours')=date('now','+7 hours') THEN jumlah ELSE 0 END),0) nilai_hari
     FROM pembayaran`
  ).first<any>()

  return c.json({ transaksi: results, statistik: stat })
})

/** Verifikasi manual (QRIS statis / tunai diterima). */
bayarRoutes.post('/api/admin/bayar/:id/lunas', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const p = await db.prepare('SELECT id, pesanan_id, metode, status FROM pembayaran WHERE id = ?')
    .bind(c.req.param('id')).first<any>()
  if (!p) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404)
  if (p.status === 'dibayar') return c.json({ error: 'Transaksi sudah berstatus lunas.' }, 400)
  if (p.status !== 'menunggu') {
    return c.json({ error: `Transaksi berstatus "${p.status}" tidak bisa ditandai lunas. Minta pelanggan checkout ulang.` }, 400)
  }
  const user = c.get('user')
  const ok = await tandaiLunas(c, p.id, p.pesanan_id, p.metode, `verifikasi ${user.nama}`, user.id)
  if (!ok) return c.json({ error: 'Transaksi sudah diproses pihak lain.' }, 409)
  return c.json({ sukses: true })
})

/** Batalkan transaksi yang menggantung. */
bayarRoutes.post('/api/admin/bayar/:id/batal', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const p = await db.prepare('SELECT id, pesanan_id, status FROM pembayaran WHERE id = ?')
    .bind(c.req.param('id')).first<any>()
  if (!p) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404)
  if (p.status === 'dibayar') return c.json({ error: 'Transaksi lunas tidak bisa dibatalkan di sini.' }, 400)

  await db.batch([
    db.prepare("UPDATE pembayaran SET status='batal', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.id),
    db.prepare("UPDATE pesanan SET status_bayar='batal' WHERE id=? AND status_bayar != 'lunas'").bind(p.pesanan_id)
  ])
  await catatAudit(db, c.get('user'), 'ubah', 'pembayaran', String(p.id), 'Batalkan transaksi pembayaran')
  return c.json({ sukses: true })
})

/** Uji koneksi gateway: buat tagihan kecil lalu batalkan pencatatannya. */
bayarRoutes.post('/api/admin/bayar/uji', requireAuth(['owner']), async (c) => {
  const cfg = await getBayarConfig(c.env as BayarEnv)
  if (cfg.provider === 'manual') {
    return c.json(cfg.qrisGambar
      ? { sukses: true, pesan: 'Provider QRIS statis siap: gambar QRIS sudah diisi. Verifikasi pembayaran dilakukan manual oleh admin.' }
      : { error: 'Gambar QRIS belum diisi.' }, cfg.qrisGambar ? 200 : 400)
  }
  const siap = qrisSiap(cfg)
  if (!siap.ok) return c.json({ error: siap.alasan }, 400)

  const asal = new URL(c.req.url).origin
  const kodeUji = kodePembayaran()
  const t = await buatTagihan(cfg, {
    kodePembayaran: kodeUji, kodePesanan: 'UJI', jumlah: Math.max(1000, cfg.minQris),
    namaPelanggan: 'Uji Koneksi', waPelanggan: '628123456789',
    item: [{ nama: 'Uji koneksi gateway', harga: Math.max(1000, cfg.minQris), jumlah: 1 }],
    kedaluwarsaMenit: 5,
    urlKembali: `${asal}/bayar?kode=${kodeUji}`,
    urlCallback: `${asal}/api/callback/pembayaran`
  })
  if (!t.ok) return c.json({ error: t.error }, 400)
  await catatAudit(c.env.DB, c.get('user'), 'lihat', 'bayar-uji', kodeUji, `Uji gateway ${cfg.provider}`)
  return c.json({
    sukses: true,
    pesan: `Gateway ${PROVIDER_INFO[cfg.provider].nama} merespons dengan baik (mode ${cfg.mode}). Tagihan uji tidak disimpan.`,
    adaQr: !!(t.qrString || t.qrUrl || t.bayarUrl)
  })
})

export { batasWaktuTeks }
