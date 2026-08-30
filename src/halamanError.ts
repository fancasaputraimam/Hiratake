// ============================================================
//  Halaman 404 bergaya Hiratake — pengunjung nyasar tetap diarahkan
//  ke beranda / produk / lacak pesanan, bukan hilang.
// ============================================================

import { asetCss, styleTema, warnaValid } from './tema'

const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))

export type Situs404 = {
  nama: string
  namaJp: string
  warna: string
  wa: string
  pesananOnline: boolean
}

export function halaman404(sRaw: Situs404, pathDiminta: string): string {
  const nama = esc(sRaw.nama || 'Hiratake')
  const namaJp = esc(sRaw.namaJp || '平茸')
  const warna = warnaValid(sRaw.warna)
  const wa = String(sRaw.wa || '').replace(/[^0-9]/g, '')
  const path = esc(String(pathDiminta || '/').slice(0, 80))
  const linkPesan = sRaw.pesananOnline ? '/#produk' : `https://wa.me/${wa}`

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Halaman Tidak Ditemukan (404) — ${nama} ${namaJp}</title>
  <meta name="robots" content="noindex, follow">
  <meta name="description" content="Halaman yang Anda cari tidak ditemukan di situs ${nama}. Kembali ke beranda atau lihat produk jamur tiram segar kami.">
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <meta name="theme-color" content="${warna}">
${asetCss}
  ${styleTema(warna)}
</head>
<body class="bg-washi font-sans text-sumi antialiased min-h-screen flex flex-col">

  <header class="bg-washi/95 backdrop-blur border-b border-sumi/10">
    <nav class="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
      <a href="/" class="flex items-center gap-3">
        <img src="/media/situs/logo" alt="Logo ${nama}" class="w-10 h-10 rounded-full object-cover ring-1 ring-sumi/10">
        <div>
          <span class="font-serifjp font-bold text-lg tracking-wide">${nama.toUpperCase()}</span>
          <span class="block text-[10px] text-vermillion tracking-[0.35em] -mt-1">${namaJp}</span>
        </div>
      </a>
      <a href="/" class="text-sm border border-sumi/20 hover:bg-white px-4 py-2 rounded-full transition">
        <i class="fas fa-house mr-1"></i>Beranda
      </a>
    </nav>
  </header>

  <main class="flex-1 flex items-center justify-center px-4 py-14 seigaiha-bg">
    <section class="max-w-2xl w-full text-center">

      <!-- Angka 404 gaya kanji + cincin enso -->
      <div class="relative mb-8">
        <div class="enso-ring mx-auto w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center">
          <div>
            <p class="font-serifjp text-6xl sm:text-7xl font-bold text-vermillion leading-none">404</p>
            <p class="font-serifjp text-sm text-sumi/50 tracking-[0.3em] mt-2">迷子</p>
          </div>
        </div>
        <span class="hidden sm:block absolute top-0 right-2 font-serifjp text-8xl text-vermillion/10 select-none">茸</span>
      </div>

      <h1 class="font-serifjp text-2xl sm:text-3xl font-bold mb-3">Halaman Tidak Ditemukan</h1>
      <p class="text-sumi/70 leading-relaxed mb-2">
        Sepertinya jamur yang Anda cari belum tumbuh di sini 🍄
      </p>
      <p class="text-sm text-sumi/50 mb-8">
        Alamat <code class="bg-white border border-sumi/10 rounded px-2 py-0.5 text-vermillion break-all">${path}</code> tidak tersedia.
      </p>

      <!-- Tombol aksi utama -->
      <div class="flex flex-wrap justify-center gap-3 mb-10">
        <a href="/" class="bg-vermillion text-white px-7 py-3 rounded-full font-semibold hover:bg-red-700 transition shadow-lg">
          <i class="fas fa-house mr-2"></i>Kembali ke Beranda
        </a>
        <a href="/#produk" class="border-2 border-sumi/20 px-7 py-3 rounded-full font-semibold hover:border-vermillion hover:text-vermillion transition">
          <i class="fas fa-basket-shopping mr-2"></i>Lihat Produk
        </a>
      </div>

      <!-- Tautan bantuan -->
      <div class="grid sm:grid-cols-3 gap-3 text-left">
        <a href="${esc(linkPesan)}" ${sRaw.pesananOnline ? '' : 'target="_blank" rel="noopener"'}
           class="bg-white border border-sumi/10 rounded-2xl p-4 hover:border-vermillion/40 hover:shadow-md transition">
          <i class="fas fa-cart-shopping text-vermillion mb-2"></i>
          <h2 class="font-semibold text-sm">Pesan Jamur</h2>
          <p class="text-xs text-sumi/50 mt-1">Jamur tiram segar, bayar tunai atau QRIS</p>
        </a>
        <a href="/lacak" class="bg-white border border-sumi/10 rounded-2xl p-4 hover:border-vermillion/40 hover:shadow-md transition">
          <i class="fas fa-magnifying-glass-location text-matcha mb-2"></i>
          <h2 class="font-semibold text-sm">Lacak Pesanan</h2>
          <p class="text-xs text-sumi/50 mt-1">Cek status pesanan Anda dengan kode PO</p>
        </a>
        <a href="https://wa.me/${wa}" target="_blank" rel="noopener"
           class="bg-white border border-sumi/10 rounded-2xl p-4 hover:border-green-500/50 hover:shadow-md transition">
          <i class="fab fa-whatsapp text-green-600 mb-2"></i>
          <h2 class="font-semibold text-sm">Tanya via WhatsApp</h2>
          <p class="text-xs text-sumi/50 mt-1">Kami balas cepat di jam operasional</p>
        </a>
      </div>

    </section>
  </main>

  <footer class="bg-sumi text-washi/60 py-6 text-center text-xs">
    <p>&copy; ${new Date().getFullYear()} ${nama} ${namaJp} — Jamur Tiram Segar ·
      <a href="/login" class="hover:text-vermillion underline underline-offset-2"><i class="fas fa-lock mr-1"></i>Login Pengelola</a>
    </p>
  </footer>

</body>
</html>`
}
