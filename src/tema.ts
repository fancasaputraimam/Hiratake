// ============================================================
//  Tema & <head> bersama — dipakai landing, halaman publik, dashboard
//  Tailwind kini dibangun statis (public/static/tailwind.css), bukan CDN.
// ============================================================

/** Konversi hex (#C73E3A) → "199 62 58" untuk CSS variable rgb(). */
export function hexKeRgb(hex: string): string {
  const h = /^#([0-9A-Fa-f]{6})$/.exec(String(hex || '')) ? hex.slice(1) : 'C73E3A'
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`
}

/** Validasi warna tema; kembalikan default bila tidak valid. */
export function warnaValid(warna?: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(String(warna || '')) ? String(warna) : '#C73E3A'
}

/**
 * Blok <style> yang menetapkan warna tema.
 * Karena Tailwind statis memakai rgb(var(--vermillion-rgb) / <alpha>),
 * owner tetap bisa mengganti warna dari dashboard tanpa build ulang.
 */
export function styleTema(warnaRaw?: string): string {
  const w = warnaValid(warnaRaw)
  return `<style>:root{--vermillion:${w};--vermillion-rgb:${hexKeRgb(w)}}</style>`
}

/**
 * Aset CSS bersama: Tailwind statis + Font Awesome + font + gaya kustom.
 * `preload` pada CSS kritis agar render cepat.
 */
export const asetCss = `
  <link href="/static/tailwind.css" rel="stylesheet">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">`

export type MetaSosial = {
  url: string          // URL kanonik halaman
  judul: string
  deskripsi: string
  gambar: string       // URL absolut gambar share (1200x630)
  situsNama: string
  tipe?: string        // 'website' | 'article' | 'product'
}

/**
 * Meta Open Graph + Twitter Card — agar link yang dibagikan di
 * WhatsApp / Facebook / Telegram / X memunculkan gambar & deskripsi.
 * WhatsApp membutuhkan og:image dengan URL ABSOLUT (https://...).
 */
export function metaSosial(m: MetaSosial): string {
  const e = (s: any) => String(s ?? '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
  return `
  <link rel="canonical" href="${e(m.url)}">
  <meta property="og:type" content="${e(m.tipe || 'website')}">
  <meta property="og:site_name" content="${e(m.situsNama)}">
  <meta property="og:locale" content="id_ID">
  <meta property="og:url" content="${e(m.url)}">
  <meta property="og:title" content="${e(m.judul)}">
  <meta property="og:description" content="${e(m.deskripsi)}">
  <meta property="og:image" content="${e(m.gambar)}">
  <meta property="og:image:secure_url" content="${e(m.gambar)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${e(m.judul)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${e(m.url)}">
  <meta name="twitter:title" content="${e(m.judul)}">
  <meta name="twitter:description" content="${e(m.deskripsi)}">
  <meta name="twitter:image" content="${e(m.gambar)}">
  <meta name="twitter:image:alt" content="${e(m.judul)}">`
}

/** Ambil origin absolut dari request (dipakai untuk og:image & sitemap). */
export function originDari(c: any): string {
  try {
    const u = new URL(c.req.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return 'https://webapp-a9l.pages.dev'
  }
}
