// ============================================================
//  FASE 11 — Panel Otomatisasi (hasil audit)
//
//    GET  /api/admin/otomatis            : status semua otomatisasi
//    PUT  /api/admin/otomatis            : ubah sakelar otomatisasi
//    POST /api/admin/otomatis/jalankan   : paksa jalan sekarang (uji)
//    GET  /api/admin/otomatis/periksa    : PEMERIKSA INTEGRITAS DATA
//    GET  /api/admin/libur               : daftar hari libur
//    POST /api/admin/libur               : tambah hari libur
//    DELETE /api/admin/libur/:tanggal    : hapus hari libur
//
//  Tujuan: owner bisa MELIHAT bahwa otomatisasi benar-benar hidup, dan
//  sistem bisa melaporkan sendiri kalau ada data yang tidak konsisten
//  (self-audit) — tidak perlu lagi memeriksa manual.
// ============================================================
import { Hono } from 'hono'
import { type Bindings as AuthBindings, type SessionUser, requireAuth, catatAudit } from './auth'
import { type OpenWAEnv, cfgVal, getWAConfig, siapKirim } from './openwa'
import {
  jalankanAutoAlpa, jalankanRingkasanHarian, jalankanBersihBersih,
  jalankanSusulPenjualan, jalankanSapuPesanan, jalankanIngatPesanan
} from './otomatis'
import { jalankanPengingatHarian } from './waNotifikasi'
import { bersihkanBayarKedaluwarsa } from './bayarNotifikasi'
import { buatPenjualanDariPesanan } from './pesananOtomatis'
import {
  jalankanTutupBuku, jalankanRekapBulanan, jalankanBiayaBaglog, jalankanRekonPiutang,
  hitungRekap, simpanTutupBuku, rekonsiliasiKas, bulanWIB
} from './pembukuan'
import {
  jalankanPenyusutan, jalankanIngatOpname, hitungSaldoKas, simpanOpname,
  ringkasanAset, susutPerBulan, eksporBukuCSV, hariWIB
} from './asetKas'

type Env = { Bindings: AuthBindings & { OPENWA_API_KEY?: string }; Variables: { user: SessionUser } }
export const otomatisRoutes = new Hono<Env>()

// Sakelar yang boleh diubah owner dari dashboard
const KUNCI_OTOMATIS = [
  'absen_auto_alpa',
  'openwa_notif_ringkasan',
  'openwa_notif_piutang',
  'openwa_jam_pengingat',
  'otomatis_jual_lunas',
  'otomatis_catat_ongkir',
  'otomatis_sapu_pesanan',
  'otomatis_sapu_hari',
  'otomatis_ingat_pesanan',
  'otomatis_ingat_jam',
  // Fase 12 — pembukuan
  'otomatis_tutup_buku',
  'otomatis_tutup_tanggal',
  'otomatis_baglog_biaya',
  'otomatis_rekap_bulanan',
  'otomatis_rekon_kas',
  // Fase 13 — aset & kas opname
  'otomatis_penyusutan',
  'otomatis_opname_ingat',
  'kas_opname_toleransi'
]

async function setCfg(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    'INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value).run()
}

// ------------------------------------------------------------
//  A. STATUS OTOMATISASI
// ------------------------------------------------------------
otomatisRoutes.get('/api/admin/otomatis', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT key, value FROM pengaturan
     WHERE key LIKE 'otomatis_%' OR key LIKE 'absen_auto%' OR key LIKE 'openwa_notif%'
        OR key LIKE 'kas_opname%'
        OR key = 'openwa_jam_pengingat' OR key = 'openwa_pengingat_terakhir'`
  ).all<any>()
  const m: Record<string, string> = {}
  for (const r of results as any[]) m[r.key] = r.value

  const waCfg = await getWAConfig(c.env as OpenWAEnv)
  const waSiap = siapKirim(waCfg)
  const denyut = m.otomatis_denyut_terakhir || ''
  const umurMenit = denyut ? Math.round((Date.now() - Date.parse(denyut)) / 60000) : null

  return c.json({
    // Denyut = bukti otomatisasi hidup (pengganti cron)
    denyut: {
      terakhir: denyut,
      sumber: m.otomatis_denyut_sumber || '',
      umurMenit,
      sehat: umurMenit !== null && umurMenit < 60 * 24
    },
    waSiap,
    tugas: [
      {
        kode: 'alpa', nama: 'Tandai alpa otomatis',
        jelas: 'Karyawan yang tidak absen kemarin ditandai alpa (Minggu & hari libur dilewati).',
        aktif: (m.absen_auto_alpa ?? '1') !== '0', butuhWA: false,
        terakhir: m.otomatis_alpa_terakhir || ''
      },
      {
        kode: 'ringkasan', nama: 'Ringkasan pagi ke WhatsApp',
        jelas: 'Panen, omzet, pengeluaran, absensi, dan pesanan dikirim ke owner setiap pagi.',
        aktif: m.openwa_notif_ringkasan === '1', butuhWA: true,
        terakhir: m.otomatis_ringkasan_terakhir || ''
      },
      {
        kode: 'piutang', nama: 'Tagih piutang otomatis',
        jelas: 'Pelanggan dengan piutang jatuh tempo ditagih lewat WhatsApp.',
        aktif: (m.openwa_notif_piutang ?? '1') !== '0', butuhWA: true,
        terakhir: m.openwa_pengingat_terakhir || ''
      },
      {
        kode: 'jual', nama: 'Catat penjualan saat lunas',
        jelas: 'Pesanan online yang dibayar langsung jadi baris penjualan — omzet tidak pernah terlewat.',
        aktif: (m.otomatis_jual_lunas ?? '1') !== '0', butuhWA: false, terakhir: 'setiap saat'
      },
      {
        kode: 'ongkir', nama: 'Catat ongkir & biaya admin',
        jelas: 'Ongkir dan biaya admin yang dibayar pelanggan masuk buku kas otomatis.',
        aktif: (m.otomatis_catat_ongkir ?? '1') !== '0', butuhWA: false, terakhir: 'setiap saat'
      },
      {
        kode: 'sapu', nama: 'Batalkan pesanan mandek',
        jelas: `Pesanan web yang tidak dibayar lebih dari ${m.otomatis_sapu_hari || '3'} hari dibatalkan otomatis.`,
        aktif: (m.otomatis_sapu_pesanan ?? '1') !== '0', butuhWA: false,
        terakhir: m.otomatis_sapu_terakhir || ''
      },
      {
        kode: 'ingat', nama: 'Ingatkan pesanan belum digarap',
        jelas: `Pesanan yang sudah dibayar tapi diam lebih dari ${m.otomatis_ingat_jam || '6'} jam dilaporkan ke owner.`,
        aktif: (m.otomatis_ingat_pesanan ?? '1') !== '0', butuhWA: true,
        terakhir: m.otomatis_ingat_terakhir || ''
      },
      {
        kode: 'bersih', nama: 'Bersihkan data usang',
        jelas: 'Sesi kedaluwarsa, OTP, dan foto absen lama dihapus agar database tetap ringan.',
        aktif: true, butuhWA: false, terakhir: m.otomatis_bersih_terakhir || ''
      },
      // ---- Fase 12: pembukuan otomatis ----
      {
        kode: 'baglog', nama: 'Bukukan biaya baglog',
        jelas: 'Setiap batch baglog baru otomatis jadi baris pengeluaran — laba/rugi tidak lagi terlihat lebih besar dari kenyataan.',
        aktif: (m.otomatis_baglog_biaya ?? '1') !== '0', butuhWA: false, terakhir: 'setiap saat'
      },
      {
        kode: 'rekonpiutang', nama: 'Lunaskan piutang penuh',
        jelas: 'Piutang yang cicilannya sudah menutup total otomatis ditandai LUNAS.',
        aktif: true, butuhWA: false, terakhir: 'setiap saat'
      },
      {
        kode: 'tutupbuku', nama: 'Tutup buku bulanan',
        jelas: `Setiap tanggal ${m.otomatis_tutup_tanggal || '5'}, buku bulan lalu dikunci agar laporan historis tidak berubah lagi.`,
        aktif: (m.otomatis_tutup_buku ?? '1') !== '0', butuhWA: false,
        terakhir: m.otomatis_tutup_terakhir || ''
      },
      {
        kode: 'rekap', nama: 'Rekap laba/rugi ke WhatsApp',
        jelas: 'Awal bulan, laporan laba/rugi bulan lalu dikirim otomatis ke owner.',
        aktif: (m.otomatis_rekap_bulanan ?? '1') !== '0', butuhWA: true,
        terakhir: m.otomatis_rekap_terakhir || ''
      },
      // ---- Fase 13: aset tetap & kas opname ----
      {
        kode: 'penyusutan', nama: 'Bukukan penyusutan aset',
        jelas: 'Biaya rak, mesin, dan kumbung disebar tiap bulan sesuai umur pakai — bulan pembelian tidak lagi terlihat rugi besar.',
        aktif: (m.otomatis_penyusutan ?? '1') !== '0', butuhWA: false,
        terakhir: m.otomatis_penyusutan_terakhir || ''
      },
      {
        kode: 'opname', nama: 'Ingatkan kas opname',
        jelas: 'Sore hari owner diingatkan menghitung uang fisik; kalau selisihnya di luar batas wajar langsung diberi tahu.',
        aktif: (m.otomatis_opname_ingat ?? '1') !== '0', butuhWA: true,
        terakhir: m.otomatis_opname_terakhir || ''
      }
    ],
    pengaturan: {
      jamPengingat: parseInt(m.openwa_jam_pengingat || '8') || 8,
      sapuHari: parseInt(m.otomatis_sapu_hari || '3') || 3,
      ingatJam: parseInt(m.otomatis_ingat_jam || '6') || 6,
      tutupTanggal: parseInt(m.otomatis_tutup_tanggal || '5') || 5,
      rekonKas: (m.otomatis_rekon_kas ?? '1') !== '0',
      opnameToleransi: parseInt(m.kas_opname_toleransi || '5000') || 0
    }
  })
})

otomatisRoutes.put('/api/admin/otomatis', requireAuth(['owner', 'admin']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const diubah: string[] = []
  for (const [k, v] of Object.entries(body)) {
    if (!KUNCI_OTOMATIS.includes(k)) continue
    let nilai = String(v)
    // Batas aman agar angka tidak bikin sistem aneh
    if (k === 'otomatis_sapu_hari') nilai = String(Math.min(30, Math.max(1, parseInt(nilai) || 3)))
    if (k === 'otomatis_ingat_jam') nilai = String(Math.min(72, Math.max(1, parseInt(nilai) || 6)))
    if (k === 'openwa_jam_pengingat') nilai = String(Math.min(23, Math.max(0, parseInt(nilai) || 8)))
    if (k === 'otomatis_tutup_tanggal') nilai = String(Math.min(28, Math.max(1, parseInt(nilai) || 5)))
    if (k === 'kas_opname_toleransi') nilai = String(Math.max(0, parseInt(nilai) || 0))
    await setCfg(c.env.DB, k, nilai)
    diubah.push(k)
  }
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'otomatisasi', '-', diubah.join(', '))
  return c.json({ sukses: true, diubah })
})

// ------------------------------------------------------------
//  B. PAKSA JALAN (untuk uji, tanpa menunggu jadwal)
// ------------------------------------------------------------
otomatisRoutes.post('/api/admin/otomatis/jalankan', requireAuth(['owner']), async (c) => {
  const env = c.env as OpenWAEnv
  const tugas = String((await c.req.json().catch(() => ({}))).tugas || 'semua')

  const peta: Record<string, () => Promise<any>> = {
    alpa: () => jalankanAutoAlpa(env),
    ringkasan: () => jalankanRingkasanHarian(env),
    bersih: () => jalankanBersihBersih(env),
    jual: () => jalankanSusulPenjualan(env),
    sapu: () => jalankanSapuPesanan(env),
    ingat: () => jalankanIngatPesanan(env),
    piutang: () => jalankanPengingatHarian(env, true),
    kedaluwarsa: () => bersihkanBayarKedaluwarsa(env),
    // Fase 12 — pembukuan
    baglog: () => jalankanBiayaBaglog(env),
    rekonpiutang: () => jalankanRekonPiutang(env),
    tutupbuku: () => jalankanTutupBuku(env),
    rekap: () => jalankanRekapBulanan(env),
    // Fase 13 — aset & kas
    penyusutan: () => jalankanPenyusutan(env),
    opname: () => jalankanIngatOpname(env)
  }

  const daftar = tugas === 'semua' ? Object.keys(peta) : [tugas]
  const hasil: Record<string, any> = {}
  for (const k of daftar) {
    if (!peta[k]) { hasil[k] = { error: 'Tugas tidak dikenal.' }; continue }
    hasil[k] = await peta[k]().catch((e: any) => ({ error: String(e?.message || e) }))
  }
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'otomatisasi', '-', `Jalankan manual: ${daftar.join(', ')}`)
  return c.json({ sukses: true, hasil })
})

// ------------------------------------------------------------
//  C. PEMERIKSA INTEGRITAS (self-audit otomatis)
//     Sistem memeriksa dirinya sendiri dan melaporkan yang tidak wajar,
//     lengkap dengan tombol perbaiki.
// ------------------------------------------------------------
otomatisRoutes.get('/api/admin/otomatis/periksa', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const aman = <T,>(p: Promise<T>, def: T) => p.catch(() => def)

  const [
    lunasTanpaJual, mandek, bayarNgambang, piutangMinus,
    stokMinus, poTanpaItem, kodeKembar, waGagal, callbackGagal, absenGantung,
    // Fase 12 — pemeriksaan pembukuan
    jualYatim, baglogBelumBuku, kasSelisih, gajiTanpaBiaya, notaTanpaBerat,
    // Fase 13 — aset & kas opname
    susutTertinggal, opnameSelisih, opnameLama
  ] = await Promise.all([
    // Uang masuk tapi belum tercatat sebagai penjualan → paling berbahaya
    aman(db.prepare(`SELECT COUNT(*) n FROM pesanan
      WHERE status_bayar='lunas' AND COALESCE(penjualan_dibuat,0)=0 AND status!='batal'`).first<any>(), { n: 0 }),
    // Pesanan lama yang tidak bergerak
    aman(db.prepare(`SELECT COUNT(*) n FROM pesanan
      WHERE status IN ('baru','diproses') AND date(tanggal_pesan) < date('now','+7 hours','-7 days')`).first<any>(), { n: 0 }),
    // Tagihan menunggu yang sudah lewat waktu tapi belum disapu
    aman(db.prepare(`SELECT COUNT(*) n FROM pembayaran
      WHERE status='menunggu' AND expires_at < datetime('now')`).first<any>(), { n: 0 }),
    // Cicilan melebihi total penjualan (salah input)
    aman(db.prepare(`SELECT COUNT(*) n FROM penjualan j
      WHERE (SELECT COALESCE(SUM(jumlah),0) FROM pembayaran_piutang WHERE penjualan_id=j.id) > j.total`).first<any>(), { n: 0 }),
    // Saldo stok total minus = terjual lebih banyak daripada yang pernah dipanen.
    // Rumus disamakan dengan endpoint /api/admin/stok (stok dikelola sebagai
    // satu kolam kg, bukan per produk).
    aman(db.prepare(`SELECT CASE WHEN (
        (SELECT COALESCE(SUM(jumlah_kg),0) FROM panen)
      - (SELECT COALESCE(SUM(berat_kg),0) FROM penjualan)
      + (SELECT COALESCE(SUM(CASE WHEN arah='masuk' THEN jumlah_kg ELSE -jumlah_kg END),0) FROM stok_penyesuaian)
      ) < 0 THEN 1 ELSE 0 END AS n`).first<any>(), { n: 0 }),
    // Pesanan tanpa item (data rusak)
    aman(db.prepare(`SELECT COUNT(*) n FROM pesanan ps
      WHERE NOT EXISTS (SELECT 1 FROM pesanan_item WHERE pesanan_id=ps.id)`).first<any>(), { n: 0 }),
    // Kode pesanan kembar (tidak mungkin lagi, tapi tetap diperiksa)
    aman(db.prepare(`SELECT COUNT(*) n FROM (
      SELECT kode FROM pesanan GROUP BY kode HAVING COUNT(*) > 1)`).first<any>(), { n: 0 }),
    // Notifikasi WA gagal 2 hari terakhir
    aman(db.prepare(`SELECT COUNT(*) n FROM wa_pesan
      WHERE status='gagal' AND created_at > datetime('now','-2 days')`).first<any>(), { n: 0 }),
    // Callback gateway dengan tanda tangan tidak sah
    aman(db.prepare(`SELECT COUNT(*) n FROM pembayaran_callback
      WHERE tanda_tangan_sah=0 AND created_at > datetime('now','-7 days')`).first<any>(), { n: 0 }),
    // Absen masuk tanpa pulang di hari yang sudah lewat
    aman(db.prepare(`SELECT COUNT(*) n FROM absensi
      WHERE jam_masuk IS NOT NULL AND jam_masuk != '' AND (jam_pulang IS NULL OR jam_pulang='')
        AND tanggal < date('now','+7 hours')`).first<any>(), { n: 0 }),

    // ---- Fase 12: PEMBUKUAN ----
    // Pesanan bertanda `penjualan_dibuat=1` tapi baris penjualannya sudah hilang
    // (mis. dihapus manual) → pesanan terkunci, omzetnya hilang dari laporan.
    aman(db.prepare(`SELECT COUNT(*) n FROM pesanan ps
      WHERE ps.penjualan_dibuat = 1
        AND NOT EXISTS (SELECT 1 FROM penjualan j WHERE j.pesanan_id = ps.id)
        AND ps.status != 'batal'`).first<any>(), { n: 0 }),
    // Batch baglog yang biayanya belum masuk pengeluaran → laba terlihat lebih besar
    aman(db.prepare(`SELECT COUNT(*) n FROM baglog_batch b
      WHERE b.biaya_per_baglog > 0 AND b.jumlah > 0
        AND NOT EXISTS (SELECT 1 FROM pengeluaran p WHERE p.sumber='auto:baglog' AND p.no_bukti=b.kode)`).first<any>(), { n: 0 }),
    // Selisih kas: uang yang diterima gateway vs yang terbukukan (bulan ini)
    aman(db.prepare(`
      SELECT COUNT(*) n FROM (
        SELECT ps.id,
          COALESCE((SELECT SUM(pb.jumlah) FROM pembayaran pb
                    WHERE pb.pesanan_id=ps.id AND pb.status='dibayar'),0) diterima,
          COALESCE((SELECT SUM(j.total) FROM penjualan j WHERE j.pesanan_id=ps.id),0)
          + COALESCE((SELECT SUM(pl.jumlah) FROM pemasukan_lain pl WHERE pl.no_bukti=ps.kode),0) buku
        FROM pesanan ps WHERE ps.status_bayar='lunas'
      ) WHERE diterima > 0 AND diterima != buku`).first<any>(), { n: 0 }),
    // Gaji dibayar tapi tidak ada baris pengeluarannya → biaya gaji tidak terhitung
    aman(db.prepare(`SELECT COUNT(*) n FROM gaji g
      WHERE g.total > 0 AND (g.pengeluaran_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM pengeluaran p WHERE p.id = g.pengeluaran_id))`).first<any>(), { n: 0 }),
    // Nota penjualan tanpa berat kg → rekonsiliasi stok tidak akurat
    aman(db.prepare(`SELECT COUNT(*) n FROM penjualan
      WHERE COALESCE(berat_kg,0) <= 0 AND produk_id IS NOT NULL`).first<any>(), { n: 0 }),

    // ---- Fase 13: ASET & KAS ----
    // Aset aktif yang penyusutan bulan lalunya belum dibukukan
    aman(db.prepare(`SELECT COUNT(*) n FROM aset_tetap a
      WHERE a.status='aktif' AND a.harga_beli > a.nilai_residu
        AND strftime('%Y-%m', a.tanggal_beli) <= strftime('%Y-%m','now','+7 hours','-1 month')
        AND NOT EXISTS (SELECT 1 FROM aset_penyusutan s WHERE s.aset_id = a.id
          AND s.periode = strftime('%Y-%m','now','+7 hours','-1 month'))`).first<any>(), { n: 0 }),
    // Opname dengan selisih di luar batas wajar (30 hari terakhir)
    aman(db.prepare(`SELECT COUNT(*) n FROM kas_opname
      WHERE ABS(selisih) > CAST((SELECT COALESCE(value,'5000') FROM pengaturan
                                 WHERE key='kas_opname_toleransi') AS INTEGER)
        AND tanggal > date('now','+7 hours','-30 days')`).first<any>(), { n: 0 }),
    // Sudah lebih dari 7 hari tidak ada kas opname sama sekali
    aman(db.prepare(`SELECT CASE WHEN (
        SELECT COUNT(*) FROM kas_opname WHERE tanggal > date('now','+7 hours','-7 days')
      ) = 0 THEN 1 ELSE 0 END AS n`).first<any>(), { n: 0 })
  ])

  type Temuan = { kode: string; tingkat: 'kritis' | 'peringatan' | 'info'; jumlah: number; pesan: string; saran: string; autoPerbaiki?: boolean }
  const semua: Temuan[] = [
    {
      kode: 'lunas_tanpa_jual', tingkat: 'kritis', jumlah: lunasTanpaJual?.n ?? 0,
      pesan: 'Pesanan sudah dibayar tapi belum tercatat sebagai penjualan.',
      saran: 'Klik "Perbaiki otomatis" — sistem akan mencatat penjualannya.', autoPerbaiki: true
    },
    {
      kode: 'po_tanpa_item', tingkat: 'kritis', jumlah: poTanpaItem?.n ?? 0,
      pesan: 'Ada pesanan tanpa item (data tidak lengkap).',
      saran: 'Periksa di tab Pesanan lalu batalkan atau lengkapi.'
    },
    {
      kode: 'kode_kembar', tingkat: 'kritis', jumlah: kodeKembar?.n ?? 0,
      pesan: 'Ada kode pesanan kembar.',
      saran: 'Hubungi teknis — seharusnya tidak mungkin terjadi.'
    },
    {
      kode: 'piutang_minus', tingkat: 'peringatan', jumlah: piutangMinus?.n ?? 0,
      pesan: 'Cicilan tercatat lebih besar dari nilai penjualan.',
      saran: 'Periksa riwayat cicilan pada nota tersebut.'
    },
    {
      kode: 'stok_minus', tingkat: 'peringatan', jumlah: stokMinus?.n ?? 0,
      pesan: 'Saldo stok total minus — penjualan melebihi panen yang tercatat.',
      saran: 'Catat panen yang belum diinput, atau buat penyesuaian stok di tab Stok.'
    },
    {
      kode: 'bayar_ngambang', tingkat: 'peringatan', jumlah: bayarNgambang?.n ?? 0,
      pesan: 'Tagihan sudah lewat batas waktu tapi belum ditutup.',
      saran: 'Klik "Perbaiki otomatis" untuk menutupnya.', autoPerbaiki: true
    },
    {
      kode: 'mandek', tingkat: 'peringatan', jumlah: mandek?.n ?? 0,
      pesan: 'Pesanan lebih dari 7 hari belum selesai.',
      saran: 'Proses atau batalkan di tab Pesanan.'
    },
    {
      kode: 'callback_gagal', tingkat: 'peringatan', jumlah: callbackGagal?.n ?? 0,
      pesan: 'Ada callback pembayaran dengan tanda tangan tidak sah.',
      saran: 'Periksa kredensial gateway di tab Pembayaran (bisa juga percobaan penipuan).'
    },
    {
      kode: 'wa_gagal', tingkat: 'info', jumlah: waGagal?.n ?? 0,
      pesan: 'Notifikasi WhatsApp gagal terkirim.',
      saran: 'Cek status sesi di tab WhatsApp, lalu kirim ulang dari log.'
    },
    {
      kode: 'absen_gantung', tingkat: 'info', jumlah: absenGantung?.n ?? 0,
      pesan: 'Absen masuk tanpa absen pulang.',
      saran: 'Ingatkan karyawan untuk absen pulang; tidak mempengaruhi gaji harian.'
    },
    // ---- Fase 12: PEMBUKUAN ----
    {
      kode: 'jual_yatim', tingkat: 'kritis', jumlah: jualYatim?.n ?? 0,
      pesan: 'Pesanan terkunci tapi baris penjualannya sudah tidak ada — omzetnya hilang dari laporan.',
      saran: 'Klik "Perbaiki otomatis" — kunci dilepas lalu penjualan dicatat ulang.', autoPerbaiki: true
    },
    {
      kode: 'kas_selisih', tingkat: 'kritis', jumlah: kasSelisih?.n ?? 0,
      pesan: 'Uang yang diterima tidak sama dengan yang terbukukan (subtotal + ongkir + biaya admin).',
      saran: 'Buka Rekonsiliasi Kas di tab Otomatisasi untuk melihat pesanan mana yang selisih.'
    },
    {
      kode: 'gaji_tanpa_biaya', tingkat: 'kritis', jumlah: gajiTanpaBiaya?.n ?? 0,
      pesan: 'Gaji sudah dibayar tapi tidak ada baris pengeluarannya — biaya gaji tidak terhitung di laba/rugi.',
      saran: 'Klik "Perbaiki otomatis" untuk membukukan ulang biaya gajinya.', autoPerbaiki: true
    },
    {
      kode: 'baglog_belum_buku', tingkat: 'peringatan', jumlah: baglogBelumBuku?.n ?? 0,
      pesan: 'Biaya batch baglog belum masuk pengeluaran — laba terlihat lebih besar dari kenyataan.',
      saran: 'Klik "Perbaiki otomatis" atau tunggu denyut berikutnya membukukannya.', autoPerbaiki: true
    },
    {
      kode: 'nota_tanpa_berat', tingkat: 'info', jumlah: notaTanpaBerat?.n ?? 0,
      pesan: 'Ada nota penjualan tanpa berat kg — rekonsiliasi stok jadi kurang akurat.',
      saran: 'Isi berat_kg pada produk terkait di tab Produk, lalu catat penyesuaian stok bila perlu.'
    },
    // ---- Fase 13 ----
    {
      kode: 'susut_tertinggal', tingkat: 'peringatan', jumlah: susutTertinggal?.n ?? 0,
      pesan: 'Penyusutan aset bulan lalu belum dibukukan — biaya pemakaian aset belum masuk laba/rugi.',
      saran: 'Klik "Perbaiki otomatis" atau tunggu denyut berikutnya. Kalau bukunya sudah ditutup, buka dulu periodenya.',
      autoPerbaiki: true
    },
    {
      kode: 'opname_selisih', tingkat: 'kritis', jumlah: opnameSelisih?.n ?? 0,
      pesan: 'Ada hari dengan selisih kas di luar batas wajar — kemungkinan uang diterima tapi tidak dicatat.',
      saran: 'Buka Kas Opname, periksa hari yang selisih, lalu cocokkan nota dengan uang fisik.'
    },
    {
      kode: 'opname_lama', tingkat: 'info', jumlah: opnameLama?.n ?? 0,
      pesan: 'Sudah lebih dari 7 hari tidak ada kas opname — uang hilang di luar sistem tidak akan terdeteksi.',
      saran: 'Hitung uang fisik lalu catat di Kas Opname, minimal sekali seminggu.'
    }
  ]

  const temuan = semua.filter((t) => t.jumlah > 0)
  const kritis = temuan.filter((t) => t.tingkat === 'kritis').length
  const peringatan = temuan.filter((t) => t.tingkat === 'peringatan').length

  return c.json({
    diperiksa: semua.length,
    temuan,
    ringkas: { kritis, peringatan, info: temuan.length - kritis - peringatan },
    sehat: temuan.length === 0,
    nilai: Math.max(0, 100 - kritis * 25 - peringatan * 10 - (temuan.length - kritis - peringatan) * 3),
    waktu: new Date().toISOString()
  })
})

// Perbaiki otomatis temuan yang bisa diperbaiki sistem sendiri
otomatisRoutes.post('/api/admin/otomatis/perbaiki', requireAuth(['owner', 'admin']), async (c) => {
  const env = c.env as OpenWAEnv
  const db = c.env.DB
  const hasil: Record<string, number> = {
    penjualanDicatat: 0, tagihanDitutup: 0,
    kunciDilepas: 0, baglogDibukukan: 0, gajiDibukukan: 0, piutangDilunaskan: 0,
    penyusutanDibukukan: 0
  }

  // 0. Lepas kunci pesanan yang penjualannya sudah hilang, supaya langkah 1
  //    bisa mencatatnya ulang. Tanpa ini omzetnya hilang selamanya.
  const yatim = await db.prepare(`
    SELECT ps.id FROM pesanan ps
    WHERE ps.penjualan_dibuat = 1 AND ps.status != 'batal'
      AND NOT EXISTS (SELECT 1 FROM penjualan j WHERE j.pesanan_id = ps.id)
    ORDER BY ps.id LIMIT 25
  `).all<any>().catch(() => ({ results: [] as any[] }))
  for (const r of yatim.results as any[]) {
    const u = await db.prepare('UPDATE pesanan SET penjualan_dibuat = 0 WHERE id = ?')
      .bind(r.id).run().catch(() => null)
    if (u?.meta?.changes) hasil.kunciDilepas++
  }

  // 1. Catat penjualan yang tertinggal (maks 25 sekali jalan)
  const { results } = await db.prepare(`
    SELECT id FROM pesanan
    WHERE status_bayar='lunas' AND COALESCE(penjualan_dibuat,0)=0 AND status!='batal'
    ORDER BY id LIMIT 25
  `).all<any>().catch(() => ({ results: [] as any[] }))
  for (const r of results as any[]) {
    const h = await buatPenjualanDariPesanan(env, r.id, {
      bayar: 'lunas', userId: c.get('user').id, sumber: 'perbaiki-manual'
    }).catch(() => null)
    if (h?.ok) hasil.penjualanDicatat++
  }

  // 2. Tutup tagihan kedaluwarsa
  const k = await bersihkanBayarKedaluwarsa(env).catch(() => ({ kedaluwarsa: 0 }))
  hasil.tagihanDitutup = k.kedaluwarsa || 0

  // ---- Fase 12: PEMBUKUAN ----
  // 3. Bukukan biaya baglog yang belum masuk pengeluaran
  const bl = await jalankanBiayaBaglog(env).catch(() => ({ dicatat: 0 }))
  hasil.baglogDibukukan = (bl as any).dicatat || 0

  // 4. Lunaskan piutang yang cicilannya sudah penuh
  const rp = await jalankanRekonPiutang(env).catch(() => ({ diperbaiki: 0 }))
  hasil.piutangDilunaskan = (rp as any).diperbaiki || 0

  // 5. Bukukan ulang gaji yang pengeluarannya hilang — biaya gaji harus
  //    tetap muncul di laba/rugi, kalau tidak laba terlihat lebih besar.
  const gj = await db.prepare(`
    SELECT g.id, g.user_id, g.periode, g.total, g.hari_hadir, g.tanggal_bayar, u.nama
    FROM gaji g JOIN users u ON u.id = g.user_id
    WHERE g.total > 0 AND (g.pengeluaran_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM pengeluaran p WHERE p.id = g.pengeluaran_id))
    LIMIT 25
  `).all<any>().catch(() => ({ results: [] as any[] }))
  for (const g of gj.results as any[]) {
    const tgl = g.tanggal_bayar || `${g.periode}-28`
    const ins = await db.prepare(`
      INSERT INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id, no_bukti, sumber)
      VALUES (?, 'gaji', ?, ?, ?, ?, 'auto:gaji')
    `).bind(
      tgl, g.total,
      `Gaji ${g.nama} periode ${g.periode} (${g.hari_hadir} hari) — dibukukan ulang otomatis`,
      c.get('user').id, `GAJI-${g.periode}-${g.user_id}`
    ).run().catch(() => null)
    if (ins?.meta?.last_row_id) {
      await db.prepare('UPDATE gaji SET pengeluaran_id = ? WHERE id = ?')
        .bind(ins.meta.last_row_id, g.id).run().catch(() => {})
      hasil.gajiDibukukan++
    }
  }

  // ---- Fase 13 ----
  // 6. Bukukan penyusutan aset bulan lalu yang tertinggal
  const ps = await jalankanPenyusutan(env).catch(() => ({ dibukukan: 0 }))
  hasil.penyusutanDibukukan = (ps as any).dibukukan || 0

  await catatAudit(db, c.get('user'), 'ubah', 'otomatisasi', '-',
    `Perbaiki otomatis: ${hasil.penjualanDicatat} penjualan, ${hasil.tagihanDitutup} tagihan, ` +
    `${hasil.kunciDilepas} kunci dilepas, ${hasil.baglogDibukukan} baglog, ` +
    `${hasil.gajiDibukukan} gaji, ${hasil.piutangDilunaskan} piutang, ` +
    `${hasil.penyusutanDibukukan} penyusutan`)
  return c.json({ sukses: true, ...hasil })
})

// ------------------------------------------------------------
//  D. HARI LIBUR (agar auto-alpa tidak salah tuduh)
// ------------------------------------------------------------
otomatisRoutes.get('/api/admin/libur', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT tanggal, keterangan FROM hari_libur WHERE tanggal >= date('now','+7 hours','-90 days') ORDER BY tanggal DESC"
  ).all().catch(() => ({ results: [] }))
  return c.json({ libur: results })
})

otomatisRoutes.post('/api/admin/libur', requireAuth(['owner', 'admin']), async (c) => {
  const { tanggal, keterangan } = await c.req.json()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || ''))) {
    return c.json({ error: 'Tanggal wajib format YYYY-MM-DD.' }, 400)
  }
  await c.env.DB.prepare(
    `INSERT INTO hari_libur (tanggal, keterangan) VALUES (?, ?)
     ON CONFLICT(tanggal) DO UPDATE SET keterangan = excluded.keterangan`
  ).bind(tanggal, String(keterangan || '').slice(0, 100)).run()

  // Bila hari itu sudah sempat ditandai alpa otomatis, batalkan (jangan
  // sampai karyawan dirugikan karena libur didaftarkan belakangan).
  const r = await c.env.DB.prepare(
    "DELETE FROM absensi WHERE tanggal = ? AND status = 'alpa' AND catatan = 'Otomatis: tidak absen'"
  ).bind(tanggal).run().catch(() => ({ meta: { changes: 0 } } as any))

  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'hari-libur', tanggal,
    `${keterangan || 'Libur'}${r.meta?.changes ? ` (batalkan ${r.meta.changes} alpa otomatis)` : ''}`)
  return c.json({ sukses: true, alpaDibatalkan: r.meta?.changes || 0 })
})

otomatisRoutes.delete('/api/admin/libur/:tanggal', requireAuth(['owner', 'admin']), async (c) => {
  const t = c.req.param('tanggal')
  await c.env.DB.prepare('DELETE FROM hari_libur WHERE tanggal = ?').bind(t).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'hari-libur', t)
  return c.json({ sukses: true })
})

// ============================================================
//  D. FASE 12 — PEMBUKUAN: TUTUP BUKU & REKONSILIASI KAS
// ============================================================

// Daftar periode yang sudah ditutup + rekap bulan berjalan
otomatisRoutes.get('/api/admin/buku', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(`
    SELECT t.*, u.nama AS oleh FROM buku_tutup t
    LEFT JOIN users u ON u.id = t.ditutup_oleh
    ORDER BY t.periode DESC LIMIT 24
  `).all<any>().catch(() => ({ results: [] as any[] }))

  const berjalan = bulanWIB(0)
  const lalu = bulanWIB(1)
  const [rekapBerjalan, rekapLalu] = await Promise.all([
    hitungRekap(db, berjalan).catch(() => null),
    hitungRekap(db, lalu).catch(() => null)
  ])
  const lalususahTutup = (results as any[]).some((r) => r.periode === lalu)

  return c.json({
    ditutup: results,
    berjalan: rekapBerjalan,
    lalu: rekapLalu,
    lalususahTutup,
    // Peringatan: bulan lalu sudah punya transaksi tapi belum dikunci
    perluTutup: !lalususahTutup && !!rekapLalu && (rekapLalu.omzet > 0 || rekapLalu.pengeluaran > 0)
  })
})

// Tutup buku manual (owner) — mengunci periode agar laporan historis final
otomatisRoutes.post('/api/admin/buku/tutup', requireAuth(['owner']), async (c) => {
  const db = c.env.DB
  const { periode } = await c.req.json().catch(() => ({}))
  const p = String(periode || '')
  if (!/^\d{4}-\d{2}$/.test(p)) return c.json({ error: 'Format periode harus YYYY-MM.' }, 400)
  if (p >= bulanWIB(0)) return c.json({ error: 'Bulan yang masih berjalan belum boleh ditutup.' }, 400)

  const r = await hitungRekap(db, p)
  await simpanTutupBuku(db, r, c.get('user').id, false)
  return c.json({ sukses: true, rekap: r })
})

// Buka kembali periode (owner) — diperlukan bila ada koreksi susulan
otomatisRoutes.delete('/api/admin/buku/:periode', requireAuth(['owner']), async (c) => {
  const p = c.req.param('periode')
  if (!/^\d{4}-\d{2}$/.test(p)) return c.json({ error: 'Format periode harus YYYY-MM.' }, 400)
  const r = await c.env.DB.prepare('DELETE FROM buku_tutup WHERE periode = ?').bind(p).run()
  if (!r.meta.changes) return c.json({ error: 'Periode itu tidak dalam keadaan tertutup.' }, 404)
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'buku-tutup', p, 'Buku dibuka kembali untuk koreksi')
  return c.json({ sukses: true })
})

// Rekonsiliasi kas: uang diterima gateway vs yang terbukukan
otomatisRoutes.get('/api/admin/buku/rekonsiliasi', requireAuth(['owner', 'admin']), async (c) => {
  const periode = c.req.query('periode') || bulanWIB(0)
  if (!/^\d{4}-\d{2}$/.test(periode)) return c.json({ error: 'Format periode harus YYYY-MM.' }, 400)
  const h = await rekonsiliasiKas(c.env.DB, periode)
  return c.json(h)
})

// ============================================================
//  FASE 13 — KAS OPNAME, ASET TETAP, EKSPOR PEMBUKUAN
// ============================================================

// ------------------------------------------------------------
//  A. KAS OPNAME — deteksi uang hilang di luar sistem
// ------------------------------------------------------------

// Saldo yang SEHARUSNYA ada menurut sistem + riwayat opname
otomatisRoutes.get('/api/admin/kas/opname', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const tanggal = c.req.query('tanggal') || hariWIB()
  const [saldo, riwayat, hariIni] = await Promise.all([
    hitungSaldoKas(db, tanggal),
    db.prepare(`SELECT o.*, u.nama AS oleh FROM kas_opname o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.tanggal DESC LIMIT 30`).all<any>().catch(() => ({ results: [] as any[] })),
    db.prepare('SELECT * FROM kas_opname WHERE tanggal = ?').bind(tanggal).first<any>().catch(() => null)
  ])
  const toleransi = parseInt(await cfgVal(db, 'kas_opname_toleransi', '5000')) || 0
  return c.json({
    tanggal,
    saldo,
    toleransi,
    hariIni,
    riwayat: (riwayat as any).results ?? []
  })
})

// Catat hasil hitung uang fisik
otomatisRoutes.post('/api/admin/kas/opname', requireAuth(['owner', 'admin']), async (c) => {
  const { tanggal, saldo_fisik, catatan } = await c.req.json().catch(() => ({} as any))
  const tgl = String(tanggal || hariWIB())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return c.json({ error: 'Format tanggal harus YYYY-MM-DD.' }, 400)
  if (tgl > hariWIB()) return c.json({ error: 'Tidak bisa opname untuk tanggal yang belum terjadi.' }, 400)

  const fisik = Math.round(parseFloat(saldo_fisik))
  if (!Number.isFinite(fisik) || fisik < 0) return c.json({ error: 'Saldo fisik harus angka >= 0.' }, 400)

  const user = c.get('user')
  const h = await simpanOpname(c.env.DB, tgl, fisik, String(catatan || ''), user.id)
  await catatAudit(c.env.DB, user, 'tambah', 'kas-opname', tgl,
    `Opname ${tgl}: fisik ${fisik}, sistem ${h.saldoSistem}, selisih ${h.selisih}`)
  return c.json({ sukses: true, ...h })
})

// ------------------------------------------------------------
//  B. ASET TETAP & PENYUSUTAN
// ------------------------------------------------------------

otomatisRoutes.get('/api/admin/aset', requireAuth(['owner', 'admin']), async (c) => {
  const r = await ringkasanAset(c.env.DB)
  const { results: susut } = await c.env.DB.prepare(`
    SELECT s.periode, COALESCE(SUM(s.jumlah),0) jumlah, COUNT(*) n
    FROM aset_penyusutan s GROUP BY s.periode ORDER BY s.periode DESC LIMIT 12
  `).all<any>().catch(() => ({ results: [] as any[] }))
  return c.json({ ...r, riwayatSusut: susut })
})

otomatisRoutes.post('/api/admin/aset', requireAuth(['owner', 'admin']), async (c) => {
  const b = await c.req.json().catch(() => ({} as any))
  const nama = String(b.nama || '').trim().slice(0, 100)
  const kategori = ['bangunan', 'peralatan', 'mesin', 'kendaraan', 'lainnya'].includes(b.kategori)
    ? b.kategori : 'peralatan'
  const harga = Math.round(parseFloat(b.harga_beli) || 0)
  const residu = Math.round(parseFloat(b.nilai_residu) || 0)
  const umur = Math.min(600, Math.max(1, parseInt(b.umur_bulan) || 60))
  const tanggal = String(b.tanggal_beli || '')

  if (!nama) return c.json({ error: 'Nama aset wajib diisi.' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return c.json({ error: 'Tanggal beli wajib diisi.' }, 400)
  if (harga <= 0) return c.json({ error: 'Harga beli harus lebih dari 0.' }, 400)
  if (residu >= harga) return c.json({ error: 'Nilai residu harus lebih kecil dari harga beli.' }, 400)

  const user = c.get('user')
  const r = await c.env.DB.prepare(`
    INSERT INTO aset_tetap (nama, kategori, tanggal_beli, harga_beli, nilai_residu, umur_bulan, catatan, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(nama, kategori, tanggal, harga, residu, umur, String(b.catatan || '').slice(0, 300), user.id).run()

  await catatAudit(c.env.DB, user, 'tambah', 'aset', String(r.meta.last_row_id),
    `${nama} ${harga} / ${umur} bulan`)
  return c.json({
    sukses: true, id: r.meta.last_row_id,
    susutPerBulan: susutPerBulan({ harga_beli: harga, nilai_residu: residu, umur_bulan: umur })
  })
})

otomatisRoutes.delete('/api/admin/aset/:id', requireAuth(['owner']), async (c) => {
  const id = parseInt(c.req.param('id'))
  const db = c.env.DB
  const a = await db.prepare('SELECT nama FROM aset_tetap WHERE id = ?').bind(id).first<any>()
  if (!a) return c.json({ error: 'Aset tidak ditemukan.' }, 404)

  // Penyusutan yang sudah dibukukan tidak boleh hilang diam-diam
  const s = await db.prepare('SELECT COUNT(*) n FROM aset_penyusutan WHERE aset_id = ?')
    .bind(id).first<any>()
  if ((s?.n ?? 0) > 0) {
    return c.json({
      error: `Aset ini sudah punya ${s.n} bulan penyusutan yang terbukukan. `
        + 'Hapus akan merusak laporan lama. Ubah statusnya jadi "dijual" atau "rusak" saja.'
    }, 400)
  }
  await db.prepare('DELETE FROM aset_tetap WHERE id = ?').bind(id).run()
  await catatAudit(db, c.get('user'), 'hapus', 'aset', String(id), a.nama)
  return c.json({ sukses: true })
})

// Ubah status aset (dijual / rusak / aktif kembali)
otomatisRoutes.put('/api/admin/aset/:id/status', requireAuth(['owner']), async (c) => {
  const id = parseInt(c.req.param('id'))
  const { status } = await c.req.json().catch(() => ({} as any))
  if (!['aktif', 'lunas_susut', 'dijual', 'rusak'].includes(status)) {
    return c.json({ error: 'Status tidak valid.' }, 400)
  }
  const r = await c.env.DB.prepare('UPDATE aset_tetap SET status = ? WHERE id = ?').bind(status, id).run()
  if (!r.meta.changes) return c.json({ error: 'Aset tidak ditemukan.' }, 404)
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'aset', String(id), `status → ${status}`)
  return c.json({ sukses: true })
})

// ------------------------------------------------------------
//  C. EKSPOR PEMBUKUAN (CSV, bisa dibuka di Excel)
// ------------------------------------------------------------
otomatisRoutes.get('/api/admin/buku/ekspor', requireAuth(['owner', 'admin']), async (c) => {
  const periode = c.req.query('periode') || bulanWIB(0)
  if (!/^\d{4}-\d{2}$/.test(periode)) return c.json({ error: 'Format periode harus YYYY-MM.' }, 400)

  const { csv, baris } = await eksporBukuCSV(c.env.DB, periode)
  const user = c.get('user')
  await c.env.DB.prepare(
    'INSERT INTO buku_ekspor (periode, format, baris, user_id, otomatis) VALUES (?, ?, ?, ?, 0)'
  ).bind(periode, 'csv', baris, user.id).run().catch(() => {})
  await catatAudit(c.env.DB, user, 'lihat', 'buku-ekspor', periode, `${baris} baris`)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="buku-besar-${periode}.csv"`
    }
  })
})

// Riwayat ekspor — bukti pembukuan sudah diarsipkan
otomatisRoutes.get('/api/admin/buku/ekspor/riwayat', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*, u.nama AS oleh FROM buku_ekspor e
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC LIMIT 20
  `).all<any>().catch(() => ({ results: [] as any[] }))
  return c.json({ riwayat: results })
})
