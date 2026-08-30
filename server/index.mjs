// ============================================================
//  SERVER VPS — menjalankan aplikasi Hono ini di server sendiri
//
//  Aplikasi aslinya dibuat untuk Cloudflare Pages. File ini membuat
//  aplikasi yang SAMA bisa jalan di VPS biasa, dengan:
//    - `node:sqlite` sebagai pengganti D1  (lihat d1-sqlite.mjs)
//    - `@hono/node-server` sebagai pengganti runtime Workers
//    - shim `executionCtx.waitUntil` supaya otomatisasi (denyut) tetap jalan
//    - penyajian file statis dari folder `public/`
//    - backup otomatis file database
//
//  Jalankan:  node server/index.mjs
//  Atau lewat PM2: pm2 start server/index.mjs --name hiratake
// ============================================================

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bukaDB, jalankanMigrasi } from './d1-sqlite.mjs'

// ------------------------------------------------------------
//  Konfigurasi lewat environment variable
// ------------------------------------------------------------
// Akar proyek dihitung dari lokasi file ini, bukan dari cwd — supaya
// `node /path/ke/webapp/server/index.mjs` tetap benar dari folder mana saja.
const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dr = (p) => (p.startsWith('/') ? p : resolve(AKAR, p))
// serveStatic memakai path relatif terhadap cwd → pindahkan cwd ke akar proyek
// supaya server aman dijalankan dari folder mana saja.
process.chdir(AKAR)

const PORT = parseInt(process.env.PORT || '3000')
const HOST = process.env.HOST || '0.0.0.0'
const DB_FILE = dr(process.env.DB_FILE || 'data/hiratake.sqlite')
const MIGRASI_DIR = dr(process.env.MIGRASI_DIR || 'migrations')
const BACKUP_DIR = dr(process.env.BACKUP_DIR || 'data/backup')
const BACKUP_SIMPAN = parseInt(process.env.BACKUP_SIMPAN || '14') // jumlah file backup disimpan
const BACKUP_JAM = parseInt(process.env.BACKUP_JAM || '24')       // interval backup (jam)
const AUTO_MIGRASI = process.env.AUTO_MIGRASI !== '0'
const SEED_FILE = dr(process.env.SEED_FILE || 'seed.sql')
const AUTO_SEED = process.env.AUTO_SEED !== '0'

console.log('─'.repeat(58))
console.log('  Hiratake — server VPS')
console.log('─'.repeat(58))
console.log(`  Database : ${DB_FILE}`)
console.log(`  Migrasi  : ${MIGRASI_DIR}`)
console.log(`  Backup   : ${BACKUP_DIR} (simpan ${BACKUP_SIMPAN} file)`)

// ------------------------------------------------------------
//  1. Buka database & jalankan migrasi
// ------------------------------------------------------------
const DB = bukaDB(DB_FILE)
if (AUTO_MIGRASI) {
  try {
    jalankanMigrasi(DB, MIGRASI_DIR)
  } catch (e) {
    console.error('\n❌ Migrasi gagal, server dihentikan supaya data tidak rusak.')
    console.error(e)
    process.exit(1)
  }
} else {
  console.log('  [migrasi] dilewati (AUTO_MIGRASI=0)')
}

// ------------------------------------------------------------
//  1b. Seed awal — HANYA saat instalasi pertama (tabel users kosong).
//      seed.sql memakai INSERT OR IGNORE jadi aman, tapi tetap dibatasi
//      supaya data produksi tidak pernah tersentuh saat restart.
// ------------------------------------------------------------
if (AUTO_SEED) {
  try {
    const n = DB.db.prepare('SELECT COUNT(*) AS n FROM users').get().n
    if (Number(n) === 0 && existsSync(SEED_FILE)) {
      DB.db.exec(readFileSync(SEED_FILE, 'utf-8'))
      console.log(`  [seed] ✅ data awal dimasukkan dari ${SEED_FILE}`)
      console.log('  [seed] ⚠  SEGERA ganti password akun default lewat /admin')
    } else {
      console.log('  [seed] dilewati (sudah ada data pengguna)')
    }
  } catch (e) {
    console.error('  [seed] gagal:', e.message)
  }
}

// ------------------------------------------------------------
//  2. Backup otomatis file database
//     SQLite = satu file, jadi backup cukup copy. Dijalankan saat
//     start dan setiap 24 jam. File lama dibuang otomatis.
// ------------------------------------------------------------
function backupDB() {
  try {
    if (!existsSync(DB_FILE)) return
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
    const cap = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const tujuan = join(BACKUP_DIR, `hiratake-${cap}.sqlite`)
    copyFileSync(DB_FILE, tujuan)
    console.log(`[backup] ✅ ${tujuan}`)

    // Buang backup paling lama bila sudah melebihi jumlah simpan
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('hiratake-') && f.endsWith('.sqlite'))
      .map((f) => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const x of files.slice(BACKUP_SIMPAN)) {
      unlinkSync(join(BACKUP_DIR, x.f))
      console.log(`[backup] 🗑  buang lama: ${x.f}`)
    }
  } catch (e) {
    console.error('[backup] gagal:', e.message)
  }
}
backupDB()
setInterval(backupDB, Math.max(1, BACKUP_JAM) * 3600 * 1000).unref?.()

// ------------------------------------------------------------
//  3. Muat aplikasi hasil build
// ------------------------------------------------------------
const WORKER_FILE = dr(process.env.WORKER_FILE || 'dist/_worker.js')
if (!existsSync(WORKER_FILE)) {
  console.error(`\n❌ Hasil build tidak ditemukan: ${WORKER_FILE}`)
  console.error('   Jalankan dulu:  npm run build')
  process.exit(1)
}
const modul = await import(pathToFileURL(WORKER_FILE).href)
const aplikasi = modul.default
if (!aplikasi || typeof aplikasi.fetch !== 'function') {
  console.error('\n❌ dist/_worker.js tidak mengekspor aplikasi Hono yang valid.')
  process.exit(1)
}

// ------------------------------------------------------------
//  4. Bungkus: sajikan statis + shim env & waitUntil
// ------------------------------------------------------------
const app = new Hono()

// File statis dari public/ (CSS, JS, gambar).
// robots.txt & sitemap.xml TIDAK disajikan di sini karena dibuat dinamis
// oleh aplikasi (src/seo.ts) — biar tetap ikut domain yang dipakai.
const PUBLIC_DIR = process.env.PUBLIC_DIR || './public'
app.use('/static/*', serveStatic({ root: PUBLIC_DIR }))

// Semua request lain diteruskan ke aplikasi asli
app.all('*', async (c) => {
  // env: gabungkan DB shim dengan variabel dari sistem
  const env = { ...process.env, DB }

  // Workers punya executionCtx.waitUntil untuk pekerjaan latar.
  // Node tidak punya, jadi ditiru: promise tetap dijalankan, error ditelan
  // supaya tidak menjatuhkan proses.
  const tunggu = []
  const ctx = {
    waitUntil: (p) => { tunggu.push(Promise.resolve(p).catch(() => {})) },
    passThroughOnException: () => {}
  }

  try {
    return await aplikasi.fetch(c.req.raw, env, ctx)
  } catch (e) {
    console.error('[error]', e)
    return c.json({ error: 'Terjadi kesalahan di server.' }, 500)
  }
})

// ------------------------------------------------------------
//  5. Nyalakan
// ------------------------------------------------------------
serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`\n  ✅ Jalan di http://${HOST}:${info.port}`)
  console.log(`     Admin: http://${HOST}:${info.port}/admin`)
  console.log('─'.repeat(58))
})

// Tutup database rapi saat proses dimatikan (Ctrl+C / pm2 restart)
for (const sinyal of ['SIGINT', 'SIGTERM']) {
  process.on(sinyal, () => {
    console.log(`\n[${sinyal}] menutup database…`)
    try { backupDB() } catch {}
    process.exit(0)
  })
}

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e))
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e))
