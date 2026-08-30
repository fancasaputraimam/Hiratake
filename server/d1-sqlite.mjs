// ============================================================
//  SHIM D1 → SQLite lokal (untuk VPS sendiri)
//
//  Aplikasi ini aslinya dibuat untuk Cloudflare D1. Di VPS tidak ada D1,
//  jadi file ini meniru API D1 (`prepare/bind/first/all/run/batch/exec`)
//  di atas `node:sqlite` yang sudah built-in di Node 22+.
//
//  Keuntungan: TIDAK perlu compiler / better-sqlite3 / node-gyp.
//  Database = satu file .sqlite, mudah dibackup (cukup copy filenya).
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** Satu statement D1 yang sudah/belum di-bind */
class Stmt {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.args = []
  }

  bind(...args) {
    const s = new Stmt(this.db, this.sql)
    // node:sqlite hanya menerima tipe primitif — boolean & undefined dinormalkan
    s.args = args.map((v) => {
      if (v === undefined) return null
      if (typeof v === 'boolean') return v ? 1 : 0
      return v
    })
    return s
  }

  #siap() {
    return this.db.prepare(this.sql)
  }

  async first(kolom) {
    const r = this.#siap().get(...this.args)
    if (!r) return null
    const obj = { ...r }
    return kolom === undefined ? obj : obj[kolom]
  }

  async all() {
    const rows = this.#siap().all(...this.args).map((r) => ({ ...r }))
    return { results: rows, success: true, meta: { rows_read: rows.length } }
  }

  async raw() {
    const rows = this.#siap().all(...this.args)
    return rows.map((r) => Object.values(r))
  }

  async run() {
    const info = this.#siap().run(...this.args)
    return {
      success: true,
      meta: {
        changes: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
        duration: 0
      }
    }
  }
}

/** Objek yang bentuknya sama seperti D1Database */
class D1Lokal {
  constructor(file) {
    const dir = dirname(file)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.db = new DatabaseSync(file)
    // WAL = jauh lebih tahan terhadap tulis bersamaan
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec('PRAGMA busy_timeout = 5000')
  }

  prepare(sql) {
    return new Stmt(this.db, sql)
  }

  async exec(sql) {
    this.db.exec(sql)
    return { count: 0, duration: 0 }
  }

  /**
   * D1 `batch` bersifat atomik. node:sqlite tidak punya batch, jadi
   * dibungkus transaksi manual supaya sifat "semua atau tidak ada" tetap.
   */
  async batch(stmts) {
    const hasil = []
    this.db.exec('BEGIN')
    try {
      for (const s of stmts) {
        const info = this.db.prepare(s.sql).run(...s.args)
        hasil.push({
          success: true,
          results: [],
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0)
          }
        })
      }
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
    return hasil
  }
}

/**
 * Jalankan semua file migrasi yang belum pernah dijalankan.
 * Meniru cara kerja `wrangler d1 migrations apply`, termasuk tabel
 * pencatat migrasi supaya tidak dijalankan dua kali.
 */
export function jalankanMigrasi(d1, folder) {
  const db = d1.db
  db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  const sudah = new Set(
    db.prepare('SELECT name FROM d1_migrations').all().map((r) => r.name)
  )

  if (!existsSync(folder)) {
    console.warn(`[migrasi] folder tidak ada: ${folder}`)
    return { dijalankan: 0, dilewati: 0 }
  }

  const files = readdirSync(folder).filter((f) => f.endsWith('.sql')).sort()
  let dijalankan = 0
  let dilewati = 0

  for (const f of files) {
    if (sudah.has(f)) { dilewati++; continue }
    const sql = readFileSync(join(folder, f), 'utf-8')
    try {
      db.exec('BEGIN')
      db.exec(sql)
      db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(f)
      db.exec('COMMIT')
      console.log(`[migrasi] ✅ ${f}`)
      dijalankan++
    } catch (e) {
      db.exec('ROLLBACK')
      console.error(`[migrasi] ❌ ${f}: ${e.message}`)
      throw e
    }
  }

  console.log(`[migrasi] selesai — ${dijalankan} baru, ${dilewati} sudah ada`)
  return { dijalankan, dilewati }
}

export function bukaDB(file) {
  return new D1Lokal(file)
}
