// ============================================================
//  FASE 11 — Otomatisasi Pesanan (hasil audit alur)
//
//  Modul ini menutup dua "miss" besar yang ditemukan saat audit:
//
//  1. KODE PESANAN BENTROK
//     Sebelumnya kode PO dihitung dengan COUNT(*), sehingga pesanan
//     yang dihapus/dibatalkan atau dua checkout bersamaan menghasilkan
//     kode yang sama → kena UNIQUE constraint → checkout gagal (500).
//     Sekarang memakai nomor terakhir (MAX) + coba ulang otomatis.
//
//  2. UANG MASUK TIDAK TERCATAT
//     Pembayaran online yang lunas hanya mengubah status_bayar; baris
//     `penjualan` baru dibuat kalau admin menekan tombol "Selesai".
//     Kalau admin lupa → omzet, stok, dan laporan buta.
//     Selain itu ongkir & biaya admin yang sudah dibayar pelanggan
//     tidak pernah masuk buku kas sama sekali.
//     Sekarang semuanya otomatis dan idempoten (aman dipanggil berkali-kali).
// ============================================================
import { cfgVal, type OpenWAEnv } from './openwa'

// ------------------------------------------------------------
//  A. KODE PESANAN ANTI-BENTROK
// ------------------------------------------------------------

/**
 * Kode PO berikutnya untuk satu bulan, berbasis nomor TERBESAR yang sudah ada
 * (bukan COUNT), + `offset` untuk percobaan ulang saat bentrok.
 */
export async function kodePesananBaru(db: D1Database, bulan: string, offset = 0): Promise<string> {
  const last = await db.prepare(
    'SELECT kode FROM pesanan WHERE kode LIKE ? ORDER BY kode DESC LIMIT 1'
  ).bind(`PO-${bulan}-%`).first<{ kode: string }>()
  let urut = 1
  if (last?.kode) {
    const n = parseInt(String(last.kode).slice(-3), 10)
    if (!isNaN(n)) urut = n + 1
  }
  return `PO-${bulan}-${String(urut + offset).padStart(3, '0')}`
}

/**
 * Jalankan INSERT pesanan dengan kode unik; bila bentrok (dua orang checkout
 * pada detik yang sama) kode dinaikkan dan dicoba lagi — pelanggan tidak
 * pernah melihat error.
 */
export async function buatPesananDenganKode(
  db: D1Database,
  bulan: string,
  jalankan: (kode: string) => Promise<{ meta: { last_row_id: number } }>
): Promise<{ kode: string; id: number }> {
  const MAKS_COBA = 6
  for (let coba = 0; coba < MAKS_COBA; coba++) {
    const kode = await kodePesananBaru(db, bulan, coba)
    try {
      const res = await jalankan(kode)
      return { kode, id: Number(res.meta.last_row_id) }
    } catch (e: any) {
      const msg = String(e?.message || e)
      const bentrok = /UNIQUE|constraint failed/i.test(msg)
      if (!bentrok || coba === MAKS_COBA - 1) throw e
      // bentrok → ulangi dengan nomor berikutnya
    }
  }
  throw new Error('Gagal membuat kode pesanan unik.')
}

// ------------------------------------------------------------
//  B. PESANAN → PENJUALAN (otomatis & idempoten)
// ------------------------------------------------------------

export type HasilBuatPenjualan = {
  ok: boolean
  alasan?: string
  jumlahPenjualan: number
  ongkirDicatat: number
  biayaDicatat: number
}

/**
 * Ubah satu pesanan menjadi baris `penjualan` (satu per item) + catat
 * ongkir & biaya admin ke buku kas.
 *
 * IDEMPOTEN: memakai `UPDATE ... WHERE penjualan_dibuat = 0` sebagai kunci
 * atomik, jadi dipanggil dari callback gateway, tombol admin, maupun sapu
 * otomatis sekaligus tetap hanya menghasilkan satu set penjualan.
 *
 * @param tandaiSelesai true = sekalian set pesanan.status='selesai'
 *                      (dipakai tombol admin "Selesai + Jual").
 *                      false = status dimajukan ke 'diproses' saja
 *                      (dipakai otomatis saat pembayaran lunas — barang
 *                      belum tentu sudah dikirim).
 */
export async function buatPenjualanDariPesanan(
  env: OpenWAEnv,
  pesananId: number | string,
  opsi: {
    bayar: 'lunas' | 'tempo'
    jatuhTempo?: string | null
    userId?: number | null
    sumber: string
    tandaiSelesai?: boolean
  }
): Promise<HasilBuatPenjualan> {
  const db = env.DB
  const kosong = { jumlahPenjualan: 0, ongkirDicatat: 0, biayaDicatat: 0 }

  const ps = await db.prepare('SELECT * FROM pesanan WHERE id = ?').bind(pesananId).first<any>()
  if (!ps) return { ok: false, alasan: 'Pesanan tidak ditemukan.', ...kosong }
  if (ps.status === 'batal') return { ok: false, alasan: 'Pesanan batal tidak bisa dijadikan penjualan.', ...kosong }

  const { results: items } = await db.prepare(
    'SELECT * FROM pesanan_item WHERE pesanan_id = ?'
  ).bind(ps.id).all<any>()
  if (!items.length) return { ok: false, alasan: 'Pesanan tidak punya item.', ...kosong }

  // ---- KUNCI ATOMIK: hanya satu pemanggil yang boleh lanjut ----
  const klaim = await db.prepare(
    "UPDATE pesanan SET penjualan_dibuat = 1 WHERE id = ? AND COALESCE(penjualan_dibuat,0) = 0 AND status != 'batal'"
  ).bind(ps.id).run()
  if (!klaim.meta.changes) {
    return { ok: false, alasan: 'Penjualan untuk pesanan ini sudah pernah dibuat.', ...kosong }
  }

  const pl = ps.pelanggan_id
    ? await db.prepare('SELECT nama FROM pelanggan WHERE id = ?').bind(ps.pelanggan_id).first<any>()
    : null
  const tanggal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10) // WIB
  const bayar = opsi.bayar === 'tempo' ? 'tempo' : 'lunas'
  const jatuhTempo = bayar === 'tempo' ? (opsi.jatuhTempo || null) : null

  const stmts: D1PreparedStatement[] = []
  for (const it of items as any[]) {
    const p = await db.prepare('SELECT berat_kg FROM produk WHERE id = ?').bind(it.produk_id).first<any>()
    stmts.push(db.prepare(
      `INSERT INTO penjualan
         (tanggal, produk_id, nama_produk, jumlah, total, pembeli, pelanggan_id,
          status_bayar, jatuh_tempo, tanggal_lunas, berat_kg, user_id, pesanan_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      tanggal, it.produk_id, it.nama_produk, it.jumlah, it.subtotal,
      pl?.nama || ps.nama_pembeli || '', ps.pelanggan_id || null,
      bayar, jatuhTempo, bayar === 'lunas' ? tanggal : null,
      (p?.berat_kg || 0) * it.jumlah, opsi.userId ?? null, ps.id
    ))
  }

  // ---- ANTI-BOCOR: ongkir & biaya admin masuk buku kas ----
  // Tanpa ini, `pembayaran.jumlah` (subtotal + ongkir + biaya) tidak akan
  // pernah sama dengan omzet yang tercatat → selisih uang tak terlacak.
  const catatOngkir = (await cfgVal(db, 'otomatis_catat_ongkir', '1')) === '1'
  const ongkir = Math.max(0, parseInt(ps.ongkir || 0, 10) || 0)
  const biaya = Math.max(0, parseInt(ps.biaya_admin || 0, 10) || 0)
  let ongkirDicatat = 0
  let biayaDicatat = 0

  if (catatOngkir && bayar === 'lunas') {
    if (ongkir > 0) {
      stmts.push(db.prepare(
        `INSERT INTO pemasukan_lain (tanggal, jumlah, keterangan, user_id, no_bukti, sumber, kategori)
         VALUES (?, ?, ?, ?, ?, 'auto:ongkir', 'ongkir')`
      ).bind(tanggal, ongkir, `Ongkir pesanan ${ps.kode}`, opsi.userId ?? null, ps.kode))
      ongkirDicatat = ongkir
    }
    if (biaya > 0) {
      // Biaya admin gateway: uangnya masuk dari pelanggan, lalu dipotong
      // provider. Dicatat dua sisi agar saldo kas cocok dengan mutasi bank.
      stmts.push(db.prepare(
        `INSERT INTO pemasukan_lain (tanggal, jumlah, keterangan, user_id, no_bukti, sumber, kategori)
         VALUES (?, ?, ?, ?, ?, 'auto:biaya_admin', 'biaya_admin')`
      ).bind(tanggal, biaya, `Biaya admin dibayar pelanggan — pesanan ${ps.kode}`, opsi.userId ?? null, ps.kode))
      stmts.push(db.prepare(
        `INSERT INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id, no_bukti, sumber)
         VALUES (?, 'lainnya', ?, ?, ?, ?, 'auto:gateway')`
      ).bind(tanggal, biaya, `Biaya payment gateway — pesanan ${ps.kode}`, opsi.userId ?? null, ps.kode))
      biayaDicatat = biaya
    }
  }

  // Status pesanan: 'selesai' hanya bila memang diselesaikan admin.
  if (opsi.tandaiSelesai) {
    stmts.push(db.prepare("UPDATE pesanan SET status = 'selesai' WHERE id = ?").bind(ps.id))
  } else if (ps.status === 'baru') {
    // Sudah dibayar → majukan otomatis supaya tidak nyangkut di 'baru'
    stmts.push(db.prepare("UPDATE pesanan SET status = 'diproses' WHERE id = ?").bind(ps.id))
  }

  try {
    await db.batch(stmts)
  } catch (e: any) {
    // Gagal → lepas kunci supaya bisa dicoba ulang (tidak menghilangkan data)
    await db.prepare('UPDATE pesanan SET penjualan_dibuat = 0 WHERE id = ?').bind(ps.id).run().catch(() => {})
    return { ok: false, alasan: `Gagal mencatat penjualan: ${e?.message || e}`, ...kosong }
  }

  await db.prepare(
    `INSERT INTO audit_log (user_id, nama, aksi, entitas, entitas_id, detail)
     VALUES (?, ?, 'tambah', 'penjualan', ?, ?)`
  ).bind(
    opsi.userId ?? null,
    opsi.userId ? 'PENGGUNA' : 'SISTEM',
    ps.kode,
    `Pesanan ${ps.kode} → ${items.length} penjualan (${bayar}, ${opsi.sumber})` +
    (ongkirDicatat ? ` +ongkir ${ongkirDicatat}` : '') +
    (biayaDicatat ? ` +biaya ${biayaDicatat}` : '')
  ).run().catch(() => {})

  return { ok: true, jumlahPenjualan: items.length, ongkirDicatat, biayaDicatat }
}
