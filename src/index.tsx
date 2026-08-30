import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { loginPage, adminPage } from './adminPages'
import {
  type Bindings as AuthBindings, type SessionUser,
  verifyPassword, hashPassword, needsRehash, generateToken, getSessionUser, requireAuth, catatAudit
} from './auth'
// ===== Integrasi OpenWA (WhatsApp API Gateway) =====
import { waRoutes } from './waRoutes'
import { getWAConfig, siapKirim, type OpenWAEnv } from './openwa'
import {
  notifPesananBaru, notifStatusPesanan, notifNota,
  notifCicilan, notifGaji, jalankanPengingatHarian
} from './waNotifikasi'
// ===== Checkout & Pembayaran (Cash / QRIS + gateway universal) =====
import { bayarRoutes } from './bayarRoutes'
import { checkoutPage, bayarPage, lacakPage, type IdentitasSitus } from './publicPages'
import { bersihkanBayarKedaluwarsa } from './bayarNotifikasi'
// ===== Fase 9: Absensi selfie+GPS & otomatisasi harian =====
import { absensiRoutes } from './absensiRoutes'
import { jalankanOtomatisasi } from './otomatis'
// ===== Fase 11: Denyut otomatisasi & pesanan otomatis (hasil audit) =====
import { middlewareDenyut } from './denyut'
import { buatPesananDenganKode, buatPenjualanDariPesanan } from './pesananOtomatis'
import { otomatisRoutes } from './otomatisRoutes'
// ===== Fase 10: SEO, share preview, 404, backup, testimoni =====
import { asetCss, styleTema, metaSosial, warnaValid, originDari } from './tema'
import { jsonLdSitus, robotsTxt, sitemapXml } from './seo'
import { halaman404 } from './halamanError'
import { blokTestimoni, blokPeta } from './blokLanding'
import { backupRoutes } from './backupRoutes'
import { testimoniRoutes } from './testimoniRoutes'

// Binding: D1 + secret OpenWA & payment gateway
// (semua kredensial TIDAK pernah dikirim ke frontend)
type Bindings = AuthBindings & {
  OPENWA_API_KEY?: string
  OPENWA_WEBHOOK_SECRET?: string
  BAYAR_SERVER_KEY?: string
  BAYAR_CLIENT_KEY?: string
  BAYAR_CALLBACK_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

// Escape HTML untuk nilai yang dirender ke halaman (anti-XSS)
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))

// Security headers dasar untuk semua respons HTML
app.use('*', async (c, next) => {
  await next()
  const ct = c.res.headers.get('Content-Type') || ''
  if (ct.includes('text/html')) {
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')
  }
})

// FASE 11 (hasil audit): pengganti cron.
// Setiap request GET yang wajar ikut memicu otomatisasi harian di belakang
// layar. Sebelumnya hanya dashboard yang memicu, sehingga bila sehari tidak
// ada yang login maka auto-alpa, ringkasan pagi, pengingat piutang, dan
// pembersihan TIDAK jalan sama sekali.
app.use('*', middlewareDenyut())

// Semua rute WhatsApp (admin, webhook, OTP) dipasang dari modul terpisah
app.route('/', waRoutes)
// Rute checkout, pembayaran, callback gateway, lacak pesanan
app.route('/', bayarRoutes)
// Rute absensi selfie + GPS (menggantikan absen sederhana)
app.route('/', absensiRoutes)
// Rute backup database lengkap (khusus owner)
app.route('/', backupRoutes)
// Rute testimoni pelanggan (owner/admin)
app.route('/', testimoniRoutes)
// Rute panel otomatisasi, pemeriksa integritas, & hari libur (Fase 11)
app.route('/', otomatisRoutes)

// Helper: ambil semua pengaturan sebagai objek
async function getPengaturan(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM pengaturan').all<{ key: string; value: string }>()
  const map: Record<string, string> = {}
  for (const r of results) map[r.key] = r.value
  return map
}

app.get('/', async (c) => {
  const db = c.env.DB
  // Statistik ASLI dari database (otomatis sinkron dengan dashboard)
  const [cfg, baglogAktif, panenRata, pelangganCount, produkSEO, testimoniList, shareKustom] = await Promise.all([
    getPengaturan(db),
    db.prepare(`
      SELECT COALESCE(SUM(b.jumlah),0) - COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k JOIN baglog_batch bb ON bb.id=k.batch_id WHERE bb.status != 'afkir'),0) AS v
      FROM baglog_batch b WHERE b.status != 'afkir'
    `).first<any>(),
    db.prepare("SELECT COALESCE(ROUND(AVG(t.total),1),0) v FROM (SELECT tanggal, SUM(jumlah_kg) total FROM panen WHERE tanggal >= date('now','+7 hours','-30 days') GROUP BY tanggal) t").first<any>(),
    db.prepare('SELECT COUNT(*) v FROM pelanggan WHERE aktif = 1').first<any>(),
    // Produk untuk structured data (JSON-LD) — mesin pencari butuh HTML, bukan hasil fetch JS
    db.prepare('SELECT nama, deskripsi, harga, satuan FROM produk WHERE aktif = 1 ORDER BY urutan, id').all<any>().catch(() => ({ results: [] })),
    // Testimoni pelanggan yang ditampilkan (dikelola dari dashboard)
    db.prepare('SELECT nama, asal, rating, isi FROM testimoni WHERE tampil = 1 ORDER BY urutan, id DESC LIMIT 6').all<any>().catch(() => ({ results: [] })),
    // Apakah owner sudah mengunggah gambar share sendiri?
    db.prepare("SELECT 1 AS ada FROM situs_media WHERE key = 'share'").first<any>().catch(() => null)
  ])
  const waNomor = cfg.wa_nomor || '6281234567890'
  const waTampil = '+' + waNomor.replace(/^(\d{2})(\d{3})(\d{4})(\d+)$/, '$1 $2-$3-$4')
  const statBaglog = Math.max(0, baglogAktif?.v ?? 0)
  const statPanen = panenRata?.v ?? 0
  const statPelanggan = pelangganCount?.v ?? 0
  // Identitas situs (diatur owner di tab Situs)
  const situsNama = esc(cfg.situs_nama || 'Hiratake')
  const situsNamaJp = esc(cfg.situs_nama_jp || '平茸')
  const situsTagline = esc(cfg.situs_tagline || 'Jamur Tiram Segar Berkualitas')
  const situsDeskripsi = esc(cfg.situs_deskripsi || 'Budidaya jamur tiram segar, higienis, dan berkualitas.')
  const situsWarna = warnaValid(cfg.situs_warna)
  const pesananOnlineAktif = cfg.situs_pesanan_online !== '0'

  // ===== Open Graph / share preview (WhatsApp, Facebook, Telegram, X) =====
  const origin = originDari(c)
  // Gambar share: pakai unggahan owner bila ada, kalau tidak banner bawaan.
  // Penting: crawler WhatsApp/Facebook kurang andal mengikuti redirect, jadi
  // bila belum ada unggahan kustom kita tunjuk LANGSUNG ke file statisnya.
  // Query ?v= memaksa cache preview diperbarui saat gambar diganti owner.
  const ogVersi = encodeURIComponent(cfg.og_versi || '1')
  const ogGambar = shareKustom
    ? `${origin}/media/situs/share?v=${ogVersi}`
    : `${origin}/static/og-hiratake.jpg?v=${ogVersi}`
  const ogJudul = `${situsNama} — ${situsTagline}`
  const ogDeskripsi = cfg.situs_deskripsi || 'Budidaya jamur tiram segar, higienis, dan berkualitas. Pesan online, bayar tunai atau QRIS.'

  // ===== Structured data (JSON-LD): LocalBusiness + Product + Testimoni =====
  const daftarProduk = (produkSEO?.results || []) as any[]
  const daftarTestimoni = (testimoniList?.results || []) as any[]
  const jsonLd = jsonLdSitus({
    origin, nama: cfg.situs_nama || 'Hiratake', deskripsi: ogDeskripsi, gambar: ogGambar,
    telepon: waNomor, alamat: cfg.alamat || '', jam: cfg.jam_operasional || '',
    lat: cfg.peta_lat || '', lng: cfg.peta_lng || '',
    produk: daftarProduk, testimoni: daftarTestimoni
  })

  return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${situsNama} — ${situsTagline} | ${situsNamaJp}</title>
  <meta name="description" content="${esc(ogDeskripsi)}">
  <meta name="keywords" content="jamur tiram, jamur tiram segar, ${situsNama}, budidaya jamur, jual jamur tiram, baglog jamur">
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <link rel="manifest" href="/static/manifest.json">
  <meta name="theme-color" content="${situsWarna}">
  <link rel="apple-touch-icon" href="/static/logo-hiratake.png">
${metaSosial({ url: origin + '/', judul: ogJudul, deskripsi: ogDeskripsi, gambar: ogGambar, situsNama: cfg.situs_nama || 'Hiratake' })}
${asetCss}
  ${styleTema(situsWarna)}
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body class="bg-washi font-sans text-sumi antialiased">

  <!-- Navbar -->
  <header id="navbar" class="fixed top-0 left-0 right-0 z-50 bg-washi/90 backdrop-blur border-b border-sumi/10 transition-shadow">
    <nav class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
      <a href="#hero-section" class="flex items-center gap-3">
        <img src="/media/situs/logo" alt="Logo Hiratake" class="w-11 h-11 rounded-full object-cover ring-1 ring-sumi/10">
        <div>
          <span class="font-serifjp font-bold text-lg tracking-wide">${situsNama.toUpperCase()}</span>
          <span class="block text-[10px] text-vermillion tracking-[0.35em] -mt-1">${situsNamaJp}</span>
        </div>
      </a>
      <ul class="hidden md:flex items-center gap-7 text-sm font-medium">
        <li><a href="#tentang" class="nav-link hover:text-vermillion transition">Tentang</a></li>
        <li><a href="#produk" class="nav-link hover:text-vermillion transition">Produk</a></li>
        <li><a href="#keunggulan" class="nav-link hover:text-vermillion transition">Keunggulan</a></li>
        <li><a href="#proses" class="nav-link hover:text-vermillion transition">Proses</a></li>
        <li><a href="#galeri" class="nav-link hover:text-vermillion transition">Galeri</a></li>
        <li>
          <a href="${pesananOnlineAktif ? '/checkout' : '#kontak'}" class="bg-vermillion text-white px-5 py-2 rounded-full hover:bg-red-700 transition shadow">
            <i class="fas fa-shopping-basket mr-1"></i> Pesan
          </a>
        </li>
      </ul>
      <button id="menu-toggle" class="md:hidden text-2xl" aria-label="Buka menu">
        <i class="fas fa-bars"></i>
      </button>
    </nav>
    <div id="mobile-menu" class="hidden md:hidden bg-washi border-t border-sumi/10 px-4 pb-4">
      <a href="#tentang" class="block py-2 hover:text-vermillion">Tentang</a>
      <a href="#produk" class="block py-2 hover:text-vermillion">Produk</a>
      <a href="#keunggulan" class="block py-2 hover:text-vermillion">Keunggulan</a>
      <a href="#proses" class="block py-2 hover:text-vermillion">Proses</a>
      <a href="#galeri" class="block py-2 hover:text-vermillion">Galeri</a>
      <a href="${pesananOnlineAktif ? '/checkout' : '#kontak'}" class="block py-2 text-vermillion font-semibold">Pesan Sekarang</a>
    </div>
  </header>

  <!-- Hero -->
  <section id="hero-section" class="relative pt-28 pb-20 overflow-hidden seigaiha-bg">
    <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
      <div class="fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] mb-3 text-sm">ヒラタケ — JAMUR TIRAM</p>
        <h1 class="font-serifjp text-4xl md:text-5xl font-bold leading-tight mb-5">
          Jamur Tiram Segar,<br>
          <span class="text-vermillion">Cita Rasa Alami</span><br>
          Setiap Hari
        </h1>
        <p class="text-sumi/70 mb-8 leading-relaxed">${situsDeskripsi}</p>
        <div class="flex flex-wrap gap-4">
          <a href="${pesananOnlineAktif ? '/checkout' : '#kontak'}" class="bg-vermillion text-white px-7 py-3 rounded-full font-semibold hover:bg-red-700 transition shadow-lg">
            <i class="fas fa-basket-shopping mr-2"></i>Pesan Sekarang
          </a>
          <a href="#produk" class="border-2 border-sumi/20 px-7 py-3 rounded-full font-semibold hover:border-vermillion hover:text-vermillion transition">
            Lihat Produk
          </a>
        </div>
        <div class="flex gap-8 mt-10">
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="${statBaglog}">0</p><p class="text-xs text-sumi/60">Baglog Aktif</p></div>
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="${statPanen}">0</p><p class="text-xs text-sumi/60">Kg / Hari (rata-rata)</p></div>
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="${statPelanggan}">0</p><p class="text-xs text-sumi/60">Pelanggan Aktif</p></div>
        </div>
      </div>
      <div class="relative fade-up">
        <div class="enso-ring mx-auto w-72 h-72 md:w-96 md:h-96 flex items-center justify-center">
          <img src="/media/situs/logo" alt="Logo Hiratake - Jamur Tiram" class="w-60 md:w-80 rounded-full shadow-2xl float-anim">
        </div>
        <span class="hidden md:block absolute top-4 right-4 font-serifjp text-6xl text-vermillion/10 select-none vertical-text">平茸農園</span>
      </div>
    </div>
  </section>

  <!-- Tentang -->
  <section id="tentang" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">私たちについて</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Tentang ${situsNama}</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <div class="grid md:grid-cols-2 gap-10 items-center">
        <figure class="fade-up">
          <img src="/media/situs/tentang"
               alt="Kumbung budidaya jamur tiram Hiratake" class="rounded-2xl shadow-xl w-full object-cover h-80" loading="lazy">
          <figcaption class="text-xs text-sumi/50 mt-2 text-center">Kumbung budidaya jamur tiram kami</figcaption>
        </figure>
        <div class="fade-up">
          <h3 class="font-serifjp text-2xl font-semibold mb-4">Filosofi <span class="text-vermillion">"Hiratake"</span> 平茸</h3>
          <p class="text-sumi/70 leading-relaxed mb-4">
            Nama <strong>Hiratake</strong> kami ambil dari bahasa Jepang yang berarti <em>jamur tiram</em>.
            Seperti filosofi Jepang <strong>Kodawari</strong> (こだわり) — dedikasi tanpa kompromi terhadap kualitas —
            kami merawat setiap baglog dengan teliti demi menghasilkan jamur tiram terbaik.
          </p>
          <p class="text-sumi/70 leading-relaxed mb-6">
            Berawal dari kumbung kecil, kini Hiratake melayani kebutuhan rumah tangga, warung makan,
            hingga restoran dengan jamur tiram segar yang dipanen setiap hari.
          </p>
          <ul class="space-y-3">
            <li class="flex items-center gap-3"><i class="fas fa-circle-check text-matcha"></i> 100% alami tanpa bahan pengawet</li>
            <li class="flex items-center gap-3"><i class="fas fa-circle-check text-matcha"></i> Dipanen segar setiap pagi</li>
            <li class="flex items-center gap-3"><i class="fas fa-circle-check text-matcha"></i> Kumbung higienis & terawat</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Produk -->
  <section id="produk" class="py-20 seigaiha-bg">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">商品</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Produk Kami</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <div id="product-list" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
        <!-- Diisi oleh app.js -->
      </div>
    </div>
  </section>

  <!-- Keunggulan -->
  <section id="keunggulan" class="py-20 bg-sumi text-washi relative overflow-hidden">
    <span class="absolute -right-6 top-6 font-serifjp text-[10rem] leading-none text-white/5 select-none">茸</span>
    <div class="max-w-6xl mx-auto px-4 relative">
      <div class="text-center mb-12 fade-up">
        <p class="text-kin font-serifjp tracking-[0.3em] text-sm mb-2">強み</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Mengapa Memilih ${situsNama}?</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <article class="feature-card fade-up"><i class="fas fa-leaf"></i><h3>Segar & Alami</h3><p>Dipanen setiap pagi tanpa pengawet, langsung dari kumbung ke tangan Anda.</p></article>
        <article class="feature-card fade-up"><i class="fas fa-heart-pulse"></i><h3>Bergizi Tinggi</h3><p>Kaya protein, serat, dan vitamin B — rendah kalori serta bebas kolesterol.</p></article>
        <article class="feature-card fade-up"><i class="fas fa-truck-fast"></i><h3>Antar Cepat</h3><p>Pengiriman same-day untuk area sekitar, jamur tiba dalam kondisi prima.</p></article>
        <article class="feature-card fade-up"><i class="fas fa-hand-holding-dollar"></i><h3>Harga Bersahabat</h3><p>Harga langsung dari petani. Diskon khusus untuk pembelian grosir & langganan.</p></article>
      </div>
    </div>
  </section>

  <!-- Proses -->
  <section id="proses" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">栽培過程</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Proses Budidaya Kami</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <ol class="grid md:grid-cols-4 gap-6">
        <li class="process-step fade-up"><span class="step-num">一</span><h3>Persiapan Baglog</h3><p>Media serbuk kayu steril dicampur dedak & kapur, lalu diinokulasi bibit unggul.</p></li>
        <li class="process-step fade-up"><span class="step-num">二</span><h3>Inkubasi</h3><p>Baglog disimpan 30–40 hari hingga miselium putih memenuhi media.</p></li>
        <li class="process-step fade-up"><span class="step-num">三</span><h3>Perawatan</h3><p>Kelembapan & suhu kumbung dijaga optimal dengan penyiraman rutin.</p></li>
        <li class="process-step fade-up"><span class="step-num">四</span><h3>Panen Segar</h3><p>Jamur dipanen setiap pagi saat tudung mekar sempurna, langsung dikemas.</p></li>
      </ol>
    </div>
  </section>

  <!-- Galeri -->
  <section id="galeri" class="py-20 seigaiha-bg">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">ギャラリー</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Galeri Kumbung</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <img src="/media/situs/galeri1" alt="Budidaya jamur tiram di kumbung" class="gallery-img" loading="lazy">
        <img src="/media/situs/galeri2" alt="Rak baglog jamur tiram" class="gallery-img" loading="lazy">
        <img src="/media/situs/galeri3" alt="Pengemasan jamur tiram" class="gallery-img" loading="lazy">
        <img src="/media/situs/galeri4" alt="Jamur tiram segar hasil panen" class="gallery-img" loading="lazy">
        <img src="/media/situs/galeri5" alt="Jamur tiram putih segar" class="gallery-img" loading="lazy">
        <img src="/media/situs/galeri6" alt="Jamur tiram di keranjang panen" class="gallery-img" loading="lazy">
      </div>
    </div>
  </section>

  ${blokTestimoni(daftarTestimoni)}

  <!-- Kontak / Pemesanan -->
  <section id="kontak" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">ご注文</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Pesan Sekarang</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
        <p class="text-sumi/60 mt-4">${pesananOnlineAktif ? 'Klik <a href="#produk" class="text-vermillion font-semibold hover:underline">produk yang Anda inginkan</a> — pesanan <strong>langsung tercatat di sistem kami</strong>. Bayar tunai atau QRIS.' : 'Silakan hubungi kami langsung via WhatsApp untuk pemesanan.'}</p>
        ${pesananOnlineAktif ? `
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/lacak" class="border border-sumi/20 hover:bg-washi px-7 py-3 rounded-full transition">
            <i class="fas fa-magnifying-glass-location mr-2"></i>Lacak Pesanan
          </a>
        </div>` : ''}
      </div>
      <div class="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto fade-up">
        <div class="contact-card"><i class="fab fa-whatsapp text-green-600"></i><div><h3>WhatsApp</h3><p>${waTampil}</p></div></div>
        <div class="contact-card"><i class="fas fa-location-dot text-vermillion"></i><div><h3>Lokasi Kumbung</h3><p>${cfg.alamat || '-'}</p></div></div>
        <div class="contact-card"><i class="fas fa-clock text-kin"></i><div><h3>Jam Operasional</h3><p>${cfg.jam_operasional || '-'}</p></div></div>
        <div class="bg-vermillion/5 border border-vermillion/20 rounded-2xl p-6">
          <h3 class="font-serifjp font-semibold text-lg mb-2"><i class="fas fa-store mr-2 text-vermillion"></i>Kemitraan & Grosir</h3>
          <p class="text-sm text-sumi/70">Kami membuka kerja sama untuk warung, restoran, katering, dan reseller. Hubungi kami untuk harga khusus grosir dan pasokan rutin.</p>
        </div>
      </div>

      ${blokPeta(cfg, situsNama)}
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-sumi text-washi/70 py-10">
    <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
      <div>
        <div class="flex items-center gap-3 mb-3">
          <img src="/media/situs/logo" alt="Logo Hiratake" class="w-10 h-10 rounded-full">
          <span class="font-serifjp font-bold text-lg text-washi">${situsNama.toUpperCase()} <span class="text-vermillion text-xs">${situsNamaJp}</span></span>
        </div>
        <p class="text-sm">Jamur tiram segar berkualitas premium, dibudidayakan dengan dedikasi ala Jepang — <em>Kodawari</em>.</p>
      </div>
      <div>
        <h3 class="font-semibold text-washi mb-3">Navigasi</h3>
        <ul class="text-sm space-y-2">
          <li><a href="#tentang" class="hover:text-vermillion">Tentang Kami</a></li>
          <li><a href="#produk" class="hover:text-vermillion">Produk</a></li>
          <li><a href="#proses" class="hover:text-vermillion">Proses Budidaya</a></li>
          <li><a href="#kontak" class="hover:text-vermillion">Pemesanan</a></li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-washi mb-3">Ikuti Kami</h3>
        <div class="flex gap-3">
          <a href="#" class="social-btn" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
          <a href="#" class="social-btn" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
          <a href="#" class="social-btn" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
          <a href="#" class="social-btn" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
        </div>
      </div>
    </div>
    <p class="text-center text-xs mt-8 text-washi/40">© 2026 ${situsNama} — ${situsTagline}. いただきます！ · <a href="/login" class="hover:text-vermillion underline underline-offset-2"><i class="fas fa-lock mr-1"></i>Login Pengelola</a></p>
  </footer>

  <!-- Tombol WhatsApp mengambang -->
  <a href="https://wa.me/${waNomor}?text=Halo%20Hiratake%2C%20saya%20mau%20pesan%20jamur%20tiram"
     target="_blank" rel="noopener" id="wa-float" aria-label="Chat WhatsApp"
     class="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-xl z-50 transition hover:scale-110">
    <i class="fab fa-whatsapp"></i>
  </a>

  <script>window.HIRATAKE_CONFIG = { wa: "${waNomor}", pesanOnline: ${pesananOnlineAktif ? 'true' : 'false'} };</script>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

// ============ HALAMAN PUBLIK: CHECKOUT, BAYAR, LACAK ============

/** Identitas situs untuk halaman-halaman publik tambahan. */
async function identitasSitus(db: D1Database): Promise<IdentitasSitus> {
  const cfg = await getPengaturan(db)
  return {
    nama: cfg.situs_nama || 'Hiratake',
    namaJp: cfg.situs_nama_jp || '平茸',
    warna: /^#[0-9A-Fa-f]{6}$/.test(cfg.situs_warna || '') ? cfg.situs_warna : '#C73E3A',
    wa: cfg.wa_nomor || '6281234567890',
    alamat: cfg.alamat || '-',
    jam: cfg.jam_operasional || '-'
  }
}

app.get('/checkout', async (c) => {
  return c.html(checkoutPage(await identitasSitus(c.env.DB)))
})

app.get('/bayar', async (c) => {
  // Lazy-cron: bereskan tagihan lewat batas waktu setiap ada kunjungan
  c.executionCtx?.waitUntil?.(
    bersihkanBayarKedaluwarsa(c.env as OpenWAEnv).then(() => {}).catch(() => {})
  )
  return c.html(bayarPage(await identitasSitus(c.env.DB)))
})

app.get('/lacak', async (c) => {
  return c.html(lacakPage(await identitasSitus(c.env.DB)))
})

// ============ SEO: robots.txt & sitemap.xml ============

app.get('/robots.txt', (c) =>
  c.text(robotsTxt(originDari(c)), 200, { 'Cache-Control': 'public, max-age=86400' }))

app.get('/sitemap.xml', async (c) => {
  // lastmod = tanggal panen/produk terakhir diperbarui (konten paling dinamis)
  const row = await c.env.DB
    .prepare("SELECT MAX(tanggal) AS t FROM panen")
    .first<any>()
    .catch(() => null)
  const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(String(row?.t || ''))
    ? row.t
    : new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  return c.body(sitemapXml(originDari(c), lastmod), 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600'
  })
})

// ============ HALAMAN LOGIN & ADMIN ============

app.get('/login', async (c) => {
  const user = await getSessionUser(c)
  if (user) return c.redirect('/admin')
  return c.html(loginPage())
})

// Halaman nota cetak (wajib login — data via API)
app.get('/nota/:jenis/:id', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.redirect('/login')
  const { jenis, id } = c.req.param()
  // Validasi ketat: param masuk ke template JS — tolak nilai aneh (anti-injeksi)
  if (!['penjualan', 'pesanan'].includes(jenis) || !/^\d{1,10}$/.test(id)) return c.notFound()
  return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota — Hiratake</title>
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #eee; color: #2B2B2B; padding: 1rem; }
    .nota { max-width: 420px; margin: 0 auto; background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
    .kepala { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: .75rem; margin-bottom: .75rem; }
    .kepala img { width: 56px; height: 56px; border-radius: 50%; }
    .kepala h1 { font-size: 1.1rem; letter-spacing: .1em; color: #C73E3A; }
    .kepala p { font-size: .7rem; color: #777; }
    .baris { display: flex; justify-content: space-between; font-size: .8rem; padding: .15rem 0; }
    table { width: 100%; border-collapse: collapse; margin: .6rem 0; font-size: .8rem; }
    th { text-align: left; border-bottom: 1px solid #ddd; padding: .3rem 0; font-size: .7rem; color: #888; }
    td { padding: .3rem 0; border-bottom: 1px dotted #eee; }
    td.angka, th.angka { text-align: right; }
    .total { display: flex; justify-content: space-between; font-weight: 700; font-size: .95rem; border-top: 2px dashed #ccc; padding-top: .6rem; margin-top: .3rem; }
    .kaki { text-align: center; font-size: .65rem; color: #999; margin-top: 1rem; }
    .aksi { max-width: 420px; margin: 1rem auto; display: flex; gap: .5rem; }
    .aksi button, .aksi a { flex: 1; padding: .7rem; border: 0; border-radius: 99px; font-size: .85rem; cursor: pointer; text-align: center; text-decoration: none; }
    .cetak { background: #C73E3A; color: #fff; }
    .kembali { background: #2B2B2B; color: #fff; }
    @media print { body { background: #fff; padding: 0; } .aksi { display: none; } .nota { box-shadow: none; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="nota" id="nota"><p style="text-align:center;padding:2rem 0;color:#999">Memuat nota…</p></div>
  <div class="aksi">
    <a href="/admin" class="kembali">← Kembali</a>
    <button class="cetak" onclick="window.print()">🖨 Cetak / Simpan PDF</button>
  </div>
  <script>
    const rp = (n) => 'Rp ' + Number(n||0).toLocaleString('id-ID');
    fetch('/api/admin/nota/${jenis}/${id}').then(r => r.json()).then(({ nota, cfg, error }) => {
      if (error) { document.getElementById('nota').innerHTML = '<p style="text-align:center;padding:2rem 0;color:#C73E3A">' + error + '</p>'; return; }
      document.getElementById('nota').innerHTML = \`
        <div class="kepala">
          <img src="/static/logo-hiratake.png" alt="Hiratake">
          <h1>HIRATAKE 平茸</h1>
          <p>Jamur Tiram Segar Berkualitas</p>
          <p>\${(cfg && cfg.alamat) || ''}</p>
          <p>WA: +\${(cfg && cfg.wa_nomor) || ''}</p>
        </div>
        <div class="baris"><span>No. Nota</span><strong>\${nota.kode}</strong></div>
        <div class="baris"><span>Tanggal</span><span>\${nota.tanggal}</span></div>
        \${nota.tanggal_kirim ? '<div class="baris"><span>Tgl Kirim</span><span>' + nota.tanggal_kirim + '</span></div>' : ''}
        <div class="baris"><span>Pembeli</span><span>\${nota.pembeli || '-'}</span></div>
        \${nota.alamat ? '<div class="baris"><span>Alamat</span><span style="text-align:right;max-width:60%">' + nota.alamat + '</span></div>' : ''}
        <table>
          <thead><tr><th>Item</th><th class="angka">Qty</th><th class="angka">Harga</th><th class="angka">Subtotal</th></tr></thead>
          <tbody>\${nota.item.map(i => '<tr><td>' + i.nama + '</td><td class="angka">' + i.jumlah + '</td><td class="angka">' + rp(i.harga) + '</td><td class="angka">' + rp(i.subtotal) + '</td></tr>').join('')}</tbody>
        </table>
        <div class="total"><span>TOTAL</span><span>\${rp(nota.total)}</span></div>
        \${nota.status_bayar === 'tempo' ? '<div class="baris" style="color:#C73E3A;margin-top:.4rem"><span>Status</span><strong>TEMPO — jatuh tempo ' + (nota.jatuh_tempo || '') + '</strong></div>' : ''}
        <p class="kaki">Terima kasih telah berbelanja 🍄<br>ご購入ありがとうございます</p>\`;
    });
  </script>
</body>
</html>`)
})

app.get('/admin', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.redirect('/login')
  return c.html(adminPage())
})

// ============ API AUTENTIKASI ============

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  if (!username || !password) return c.json({ error: 'Username dan kata sandi wajib diisi.' }, 400)
  const uname = username.toLowerCase()

  // Rate limit: maksimal 5 percobaan gagal per username dalam 5 menit (anti brute-force)
  const gagal = await c.env.DB.prepare(
    "SELECT COUNT(*) v FROM login_attempts WHERE username = ? AND sukses = 0 AND created_at > datetime('now','-5 minutes')"
  ).bind(uname).first<any>()
  if ((gagal?.v ?? 0) >= 5) {
    return c.json({ error: 'Terlalu banyak percobaan gagal. Tunggu 5 menit lalu coba lagi.' }, 429)
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash, nama, role, aktif FROM users WHERE username = ?'
  ).bind(uname).first<any>()

  if (!user || !user.aktif || !(await verifyPassword(password, user.password_hash))) {
    await c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 0)').bind(uname).run()
    return c.json({ error: 'Username atau kata sandi salah.' }, 401)
  }

  // Upgrade otomatis: hash lama (SHA-256 1x) di-rehash ke PBKDF2 saat login berhasil
  if (needsRehash(user.password_hash)) {
    try {
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(await hashPassword(password), user.id).run()
    } catch { /* rehash gagal tidak boleh menggagalkan login */ }
  }

  const token = generateToken()
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))").bind(token, user.id),
    c.env.DB.prepare('INSERT INTO login_attempts (username, sukses) VALUES (?, 1)').bind(uname),
    // Housekeeping ringan: bersihkan sesi kedaluwarsa & catatan login lama
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    c.env.DB.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now','-1 day')")
  ])
  await catatAudit(c.env.DB, { id: user.id, nama: user.nama }, 'login', 'auth', user.id, 'Login berhasil')

  setCookie(c, 'hiratake_session', token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 7
  })
  return c.json({ sukses: true, user: { id: user.id, username: user.username, nama: user.nama, role: user.role } })
})

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'hiratake_session')
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  deleteCookie(c, 'hiratake_session', { path: '/' })
  return c.json({ sukses: true })
})

app.get('/api/auth/me', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Belum login' }, 401)
  return c.json({ user })
})

// Ganti kata sandi sendiri (semua role)
app.put('/api/auth/password', requireAuth(), async (c) => {
  const { sandi_lama, sandi_baru } = await c.req.json()
  if (!sandi_lama || !sandi_baru) return c.json({ error: 'Sandi lama dan baru wajib diisi.' }, 400)
  if (String(sandi_baru).length < 6) return c.json({ error: 'Sandi baru minimal 6 karakter.' }, 400)
  const me = c.get('user')
  const u = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(me.id).first<any>()
  if (!u || !(await verifyPassword(sandi_lama, u.password_hash))) {
    return c.json({ error: 'Kata sandi lama salah.' }, 400)
  }
  const tokenIni = getCookie(c, 'hiratake_session') || ''
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(sandi_baru), me.id),
    // Keamanan: logout dari semua perangkat lain, sesi ini tetap aktif
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(me.id, tokenIni)
  ])
  await catatAudit(c.env.DB, me, 'ubah', 'auth', me.id, 'Ganti kata sandi sendiri')
  return c.json({ sukses: true })
})

// ============ API PUBLIK ============

// Daftar produk aktif (dipakai halaman depan)
app.get('/api/produk', async (c) => {
  const { results } = await c.env.DB.prepare(
    // FASE 11 (audit): urutan diselaraskan dengan JSON-LD landing agar
    // daftar produk di halaman depan dan di API selalu sama susunannya.
    'SELECT id, nama, jp, harga, satuan, deskripsi, ikon, badge FROM produk WHERE aktif = 1 ORDER BY urutan, id'
  ).all()
  return c.json({ produk: results })
})

// Endpoint pemesanan lama sudah digantikan alur checkout tunggal (/api/checkout).
// Ditutup permanen agar tidak jadi jalur bypass OTP/metode bayar.
app.post('/api/pesan-online', (c) =>
  c.json({ error: 'Endpoint ini sudah tidak digunakan. Silakan pesan lewat halaman /checkout.' }, 410))

// ============ API PENGELOLAAN (WAJIB LOGIN) ============

// --- Ringkasan dashboard (semua role) ---
app.get('/api/admin/ringkasan', requireAuth(), async (c) => {
  const db = c.env.DB
  const [panenHariIni, panenBulanIni, jualHariIni, jualBulanIni, panen7, jual7, totalProduk] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE tanggal = date('now','+7 hours')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now','+7 hours')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE tanggal = date('now','+7 hours')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now','+7 hours')").first<any>(),
    db.prepare("SELECT tanggal, SUM(jumlah_kg) v FROM panen WHERE tanggal >= date('now','+7 hours','-6 days') GROUP BY tanggal ORDER BY tanggal").all(),
    db.prepare("SELECT tanggal, SUM(total) v FROM penjualan WHERE tanggal >= date('now','+7 hours','-6 days') GROUP BY tanggal ORDER BY tanggal").all(),
    db.prepare('SELECT COUNT(*) v FROM produk WHERE aktif = 1').first<any>()
  ])
  // Metrik Fase 1: baglog, kontaminasi, susut, piutang
  const [baglog, piutang, susutBulan, kpiBatch] = await Promise.all([
    db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status != 'afkir' THEN jumlah ELSE 0 END),0) AS total_aktif,
        COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k JOIN baglog_batch b2 ON b2.id=k.batch_id WHERE b2.status != 'afkir'),0) AS hilang,
        COALESCE(SUM(jumlah),0) AS total_semua,
        COALESCE((SELECT SUM(jumlah) FROM baglog_kejadian WHERE jenis='kontaminasi'),0) AS kontaminasi_semua
      FROM baglog_batch
    `).first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM penjualan WHERE status_bayar='tempo'").first<any>(),
    db.prepare("SELECT COALESCE(SUM(susut_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now','+7 hours')").first<any>(),
    db.prepare(`
      SELECT COALESCE(SUM(p.jumlah_kg),0) AS total_kg, COALESCE((SELECT SUM(jumlah) FROM baglog_batch WHERE status='produktif'),0) AS baglog_produktif
      FROM panen p WHERE p.batch_id IS NOT NULL
    `).first<any>()
  ])
  const targetCfg = await db.prepare("SELECT value FROM pengaturan WHERE key='target_kg_bulanan'").first<any>()
  const targetKg = parseFloat(targetCfg?.value || '0') || 0

  // Lazy-cron: Cloudflare hosted deploy tidak mendukung cron trigger, jadi semua
  // tugas harian "menempel" pada request dashboard pertama tiap hari:
  // pengingat piutang, auto-alpa absensi, ringkasan pagi WA, housekeeping, tagihan kedaluwarsa.
  c.executionCtx?.waitUntil?.(
    Promise.allSettled([
      jalankanPengingatHarian(c.env as OpenWAEnv),
      bersihkanBayarKedaluwarsa(c.env as OpenWAEnv),
      jalankanOtomatisasi(c.env as OpenWAEnv)
    ]).then(() => {})
  )
  return c.json({
    targetKg,
    panenHariIni: panenHariIni.v, panenBulanIni: panenBulanIni.v,
    jualHariIni: jualHariIni.v, jualBulanIni: jualBulanIni.v,
    grafikPanen: panen7.results, grafikPenjualan: jual7.results,
    totalProduk: totalProduk.v,
    baglogAktif: Math.max(0, (baglog?.total_aktif ?? 0) - (baglog?.hilang ?? 0)),
    kontaminasiPersen: baglog?.total_semua > 0 ? Math.round((baglog.kontaminasi_semua / baglog.total_semua) * 1000) / 10 : 0,
    piutangTotal: piutang?.v ?? 0, piutangJumlah: piutang?.n ?? 0,
    susutBulanIni: susutBulan?.v ?? 0,
    kgPerBaglog: kpiBatch?.baglog_produktif > 0 ? Math.round((kpiBatch.total_kg / kpiBatch.baglog_produktif) * 100) / 100 : 0
  })
})

// --- Notifikasi (badge sidebar: piutang telat, PO baru dari web, batch tua) ---
app.get('/api/admin/notifikasi', requireAuth(), async (c) => {
  const db = c.env.DB
  const [telat, jatuhTempoDekat, poWeb, batchTua] = await Promise.all([
    db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) v FROM penjualan WHERE status_bayar='tempo' AND jatuh_tempo < date('now','+7 hours')").first<any>(),
    db.prepare("SELECT COUNT(*) n FROM penjualan WHERE status_bayar='tempo' AND jatuh_tempo BETWEEN date('now','+7 hours') AND date('now','+7 hours','+3 days')").first<any>(),
    db.prepare("SELECT COUNT(*) n FROM pesanan WHERE sumber='web' AND status='baru'").first<any>(),
    db.prepare(`SELECT kode, tanggal, CAST(julianday('now','+7 hours') - julianday(tanggal) AS INTEGER) AS umur_hari
      FROM baglog_batch WHERE status='produktif' AND julianday('now','+7 hours') - julianday(tanggal) > 100 ORDER BY tanggal LIMIT 5`).all()
  ])
  // Status integrasi WhatsApp + pesan gagal kirim (agar tidak ada notifikasi hilang tanpa disadari)
  const waCfgN = await getWAConfig(c.env as OpenWAEnv)
  const waGagal = await db.prepare(
    "SELECT COUNT(*) n FROM wa_pesan WHERE status='gagal' AND created_at > datetime('now','-2 days')"
  ).first<any>().catch(() => ({ n: 0 }))

  // Pembayaran QRIS/tunai yang menunggu verifikasi atau menunggu bayar
  const bayarMenunggu = await db.prepare(
    "SELECT COUNT(*) n FROM pembayaran WHERE status='menunggu'"
  ).first<any>().catch(() => ({ n: 0 }))
  const bayarHariIni = await db.prepare(
    "SELECT COALESCE(SUM(jumlah),0) v FROM pembayaran WHERE status='dibayar' AND date(dibayar_at,'+7 hours')=date('now','+7 hours')"
  ).first<any>().catch(() => ({ v: 0 }))

  // FASE 13: temuan integritas & pembukuan ikut ke lonceng, supaya masalah
  // tidak hanya terlihat kalau tab Otomatisasi sengaja dibuka.
  const bulanIni = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
  const bulanLalu = (() => {
    const d = new Date(Date.now() + 7 * 3600 * 1000)
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()
  const [bukuLalu, adaTransaksiLalu, baglogBelum, gajiBelum, opnameHariIni] = await Promise.all([
    db.prepare('SELECT periode FROM buku_tutup WHERE periode = ?').bind(bulanLalu).first<any>().catch(() => null),
    db.prepare(`SELECT (
        (SELECT COUNT(*) FROM penjualan WHERE strftime('%Y-%m',tanggal)=?)
      + (SELECT COUNT(*) FROM pengeluaran WHERE strftime('%Y-%m',tanggal)=?)
    ) AS n`).bind(bulanLalu, bulanLalu).first<any>().catch(() => ({ n: 0 })),
    db.prepare(`SELECT COUNT(*) n FROM baglog_batch b
      WHERE b.biaya_per_baglog > 0 AND b.jumlah > 0
        AND NOT EXISTS (SELECT 1 FROM pengeluaran p WHERE p.sumber='auto:baglog' AND p.no_bukti=b.kode)`)
      .first<any>().catch(() => ({ n: 0 })),
    db.prepare(`SELECT COUNT(*) n FROM gaji g
      WHERE g.total > 0 AND (g.pengeluaran_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM pengeluaran p WHERE p.id = g.pengeluaran_id))`)
      .first<any>().catch(() => ({ n: 0 })),
    db.prepare("SELECT selisih FROM kas_opname WHERE tanggal = date('now','+7 hours')")
      .first<any>().catch(() => null)
  ])

  const perluTutupBuku = !bukuLalu && (adaTransaksiLalu?.n ?? 0) > 0

  return c.json({
    piutangTelat: { jumlah: telat?.n ?? 0, total: telat?.v ?? 0 },
    piutangDekat: jatuhTempoDekat?.n ?? 0,
    pesananWebBaru: poWeb?.n ?? 0,
    batchTua: batchTua.results,
    waAktif: siapKirim(waCfgN),
    waGagal: waGagal?.n ?? 0,
    bayarMenunggu: bayarMenunggu?.n ?? 0,
    bayarHariIni: bayarHariIni?.v ?? 0,
    // --- pembukuan ---
    pembukuan: {
      periodeBerjalan: bulanIni,
      perluTutupBuku,
      periodeBelumTutup: perluTutupBuku ? bulanLalu : '',
      baglogBelumDibukukan: baglogBelum?.n ?? 0,
      gajiBelumDibukukan: gajiBelum?.n ?? 0,
      opnameHariIni: opnameHariIni ? Number(opnameHariIni.selisih) : null,
      opnameBelumIsi: !opnameHariIni
    }
  })
})

// --- Panen (semua role bisa catat & lihat) ---
app.get('/api/admin/panen', requireAuth(), async (c) => {
  const bulan = c.req.query('bulan') // opsional YYYY-MM
  const base = `
    SELECT p.id, p.tanggal, p.jumlah_kg, p.grade_a, p.grade_b, p.grade_c, p.susut_kg, p.catatan,
           u.nama AS pencatat, b.kode AS batch_kode
    FROM panen p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN baglog_batch b ON b.id = p.batch_id`
  const q = bulan && /^\d{4}-\d{2}$/.test(bulan)
    ? c.env.DB.prepare(base + " WHERE strftime('%Y-%m', p.tanggal) = ? ORDER BY p.tanggal DESC, p.id DESC").bind(bulan)
    : c.env.DB.prepare(base + ' ORDER BY p.tanggal DESC, p.id DESC LIMIT 100')
  const { results } = await q.all()
  return c.json({ panen: results })
})

app.post('/api/admin/panen', requireAuth(), async (c) => {
  const { tanggal, batch_id, grade_a, grade_b, grade_c, susut_kg, catatan } = await c.req.json()
  const ga = parseFloat(grade_a) || 0, gb = parseFloat(grade_b) || 0, gc = parseFloat(grade_c) || 0
  const susut = parseFloat(susut_kg) || 0
  const total = Math.round((ga + gb + gc) * 100) / 100
  if (!tanggal || total <= 0) return c.json({ error: 'Tanggal dan minimal satu grade (A/B/C) wajib diisi.' }, 400)
  const tutupPanen = await periodeTertutup(c.env.DB, tanggal)
  if (tutupPanen) return c.json({ error: `Buku periode ${tutupPanen} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  if (batch_id) {
    const b = await c.env.DB.prepare("SELECT id, status FROM baglog_batch WHERE id = ?").bind(batch_id).first<any>()
    if (!b) return c.json({ error: 'Batch tidak ditemukan.' }, 404)
    // Batch yang dipanen otomatis jadi produktif
    if (b.status === 'inkubasi') {
      await c.env.DB.prepare("UPDATE baglog_batch SET status = 'produktif' WHERE id = ?").bind(batch_id).run()
    }
  }
  const res = await c.env.DB.prepare(
    'INSERT INTO panen (tanggal, jumlah_kg, grade_a, grade_b, grade_c, susut_kg, batch_id, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, total, ga, gb, gc, susut, batch_id || null, catatan || '', c.get('user').id).run()
  const id = res.meta.last_row_id
  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'panen', id, `${total} kg (${tanggal})`)
  return c.json({ sukses: true, id, total })
})

// Hapus panen — DIJAGA: tidak boleh membuat stok jadi minus, dan tidak boleh
// menyentuh periode yang bukunya sudah ditutup.
app.delete('/api/admin/panen/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const p = await db.prepare('SELECT id, tanggal, jumlah_kg FROM panen WHERE id = ?').bind(id).first<any>()
  if (!p) return c.json({ error: 'Data panen tidak ditemukan.' }, 404)

  const tutup = await db.prepare('SELECT periode FROM buku_tutup WHERE periode = ?')
    .bind(String(p.tanggal).slice(0, 7)).first<any>().catch(() => null)
  if (tutup) {
    return c.json({ error: `Buku periode ${tutup.periode} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  }

  const stok = await db.prepare(`
    SELECT (
        (SELECT COALESCE(SUM(jumlah_kg),0) FROM panen)
      - (SELECT COALESCE(SUM(berat_kg),0) FROM penjualan)
      + (SELECT COALESCE(SUM(CASE WHEN arah='masuk' THEN jumlah_kg ELSE -jumlah_kg END),0) FROM stok_penyesuaian)
    ) AS v`).first<any>()
  const sisaSetelahHapus = Math.round(((stok?.v ?? 0) - (p.jumlah_kg || 0)) * 100) / 100
  if (sisaSetelahHapus < 0) {
    return c.json({
      error: `Tidak bisa dihapus: stok akan minus ${sisaSetelahHapus} kg. Panen ${p.jumlah_kg} kg ini sudah terjual/terpakai. Pakai Penyesuaian Stok bila mau koreksi.`
    }, 400)
  }

  await db.prepare('DELETE FROM panen WHERE id = ?').bind(id).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'panen', id, `${p.jumlah_kg} kg (${p.tanggal})`)
  return c.json({ sukses: true })
})

// --- Penjualan (semua role bisa catat & lihat) ---
app.get('/api/admin/penjualan', requireAuth(), async (c) => {
  const bulan = c.req.query('bulan') // opsional YYYY-MM
  const base = `
    SELECT j.id, j.tanggal, j.nama_produk, j.jumlah, j.total, j.pembeli, j.status_bayar, j.jatuh_tempo, j.tanggal_lunas,
           u.nama AS pencatat, pl.nama AS pelanggan_nama, pl.tipe AS pelanggan_tipe
    FROM penjualan j LEFT JOIN users u ON u.id = j.user_id LEFT JOIN pelanggan pl ON pl.id = j.pelanggan_id`
  const q = bulan && /^\d{4}-\d{2}$/.test(bulan)
    ? c.env.DB.prepare(base + " WHERE strftime('%Y-%m', j.tanggal) = ? ORDER BY j.tanggal DESC, j.id DESC").bind(bulan)
    : c.env.DB.prepare(base + ' ORDER BY j.tanggal DESC, j.id DESC LIMIT 100')
  const { results } = await q.all()
  return c.json({ penjualan: results })
})

app.post('/api/admin/penjualan', requireAuth(), async (c) => {
  const { tanggal, produk_id, jumlah, pelanggan_id, pembeli, status_bayar, jatuh_tempo } = await c.req.json()
  if (!tanggal || !produk_id || !jumlah || jumlah <= 0) return c.json({ error: 'Data penjualan tidak lengkap.' }, 400)
  const tutupJual = await periodeTertutup(c.env.DB, tanggal)
  if (tutupJual) return c.json({ error: `Buku periode ${tutupJual} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  const bayar = status_bayar === 'tempo' ? 'tempo' : 'lunas'
  if (bayar === 'tempo' && !jatuh_tempo) return c.json({ error: 'Penjualan tempo wajib diisi tanggal jatuh tempo.' }, 400)
  if (bayar === 'tempo' && !pelanggan_id) return c.json({ error: 'Penjualan tempo wajib pilih pelanggan terdaftar (untuk penagihan).' }, 400)
  const p = await c.env.DB.prepare('SELECT nama, harga, berat_kg FROM produk WHERE id = ?').bind(produk_id).first<any>()
  if (!p) return c.json({ error: 'Produk tidak ditemukan.' }, 404)
  let namaPembeli = pembeli || ''
  if (pelanggan_id) {
    const pl = await c.env.DB.prepare('SELECT nama FROM pelanggan WHERE id = ? AND aktif = 1').bind(pelanggan_id).first<any>()
    if (!pl) return c.json({ error: 'Pelanggan tidak ditemukan.' }, 404)
    namaPembeli = pl.nama
  }
  const res = await c.env.DB.prepare(
    'INSERT INTO penjualan (tanggal, produk_id, nama_produk, jumlah, total, pembeli, pelanggan_id, status_bayar, jatuh_tempo, tanggal_lunas, berat_kg, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, produk_id, p.nama, jumlah, p.harga * jumlah, namaPembeli, pelanggan_id || null, bayar,
    bayar === 'tempo' ? jatuh_tempo : null, bayar === 'lunas' ? tanggal : null, (p.berat_kg || 0) * jumlah, c.get('user').id).run()
  const id = res.meta.last_row_id
  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'penjualan', id, `${p.nama} x${jumlah} = Rp${p.harga * jumlah} (${bayar})`)
  return c.json({ sukses: true, id })
})

// Tandai piutang lunas
app.put('/api/admin/penjualan/:id/lunas', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE penjualan SET status_bayar='lunas', tanggal_lunas=date('now','+7 hours') WHERE id = ? AND status_bayar='tempo'")
    .bind(id).run()
  await catatAudit(c.env.DB, c.get('user'), 'bayar', 'piutang', id, 'Ditandai lunas penuh')
  return c.json({ sukses: true })
})

// Hapus penjualan — DIJAGA: buku yang sudah ditutup tidak boleh diubah, dan
// kunci `pesanan.penjualan_dibuat` dilepas agar pesanannya tidak yatim/terkunci.
app.delete('/api/admin/penjualan/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const j = await db.prepare('SELECT id, tanggal, total, pesanan_id FROM penjualan WHERE id = ?').bind(id).first<any>()
  if (!j) return c.json({ error: 'Penjualan tidak ditemukan.' }, 404)

  const tutup = await db.prepare('SELECT periode FROM buku_tutup WHERE periode = ?')
    .bind(String(j.tanggal).slice(0, 7)).first<any>().catch(() => null)
  if (tutup) {
    return c.json({ error: `Buku periode ${tutup.periode} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  }

  const stmts = [
    db.prepare('DELETE FROM penjualan WHERE id = ?').bind(id),
    db.prepare('DELETE FROM pembayaran_piutang WHERE penjualan_id = ?').bind(id)
  ]
  let pesananDilepas: number | null = null
  if (j.pesanan_id) {
    // Lepas kunci hanya kalau tidak ada baris penjualan lain dari pesanan yang sama
    const sisa = await db.prepare('SELECT COUNT(*) n FROM penjualan WHERE pesanan_id = ? AND id != ?')
      .bind(j.pesanan_id, id).first<any>()
    if ((sisa?.n ?? 0) === 0) {
      pesananDilepas = Number(j.pesanan_id)
      stmts.push(db.prepare("UPDATE pesanan SET penjualan_dibuat = 0, status = CASE WHEN status='selesai' THEN 'diproses' ELSE status END WHERE id = ?").bind(j.pesanan_id))
    }
  }
  await db.batch(stmts)
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'penjualan', id,
    `Rp${j.total} (${j.tanggal})${pesananDilepas ? ` — kunci pesanan #${pesananDilepas} dilepas` : ''}`)
  return c.json({ sukses: true, pesananDilepas })
})

// --- Cicilan piutang (pembayaran parsial) ---
app.get('/api/admin/penjualan/:id/pembayaran', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT b.*, u.nama AS pencatat FROM pembayaran_piutang b LEFT JOIN users u ON u.id = b.user_id
    WHERE b.penjualan_id = ? ORDER BY b.tanggal, b.id
  `).bind(c.req.param('id')).all()
  return c.json({ pembayaran: results })
})

app.post('/api/admin/penjualan/:id/pembayaran', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  const { tanggal, jumlah, catatan } = await c.req.json()
  const bayar = parseInt(jumlah)
  if (!tanggal || !bayar || bayar <= 0) return c.json({ error: 'Tanggal dan jumlah pembayaran wajib diisi.' }, 400)
  const j = await c.env.DB.prepare('SELECT id, total, status_bayar FROM penjualan WHERE id = ?').bind(id).first<any>()
  if (!j) return c.json({ error: 'Penjualan tidak ditemukan.' }, 404)
  if (j.status_bayar !== 'tempo') return c.json({ error: 'Penjualan ini sudah lunas.' }, 400)
  const sudah = await c.env.DB.prepare('SELECT COALESCE(SUM(jumlah),0) v FROM pembayaran_piutang WHERE penjualan_id = ?').bind(id).first<any>()
  const sisa = j.total - (sudah?.v ?? 0)
  if (bayar > sisa) return c.json({ error: `Jumlah melebihi sisa piutang (sisa: Rp ${sisa.toLocaleString('id-ID')}).` }, 400)
  await c.env.DB.prepare('INSERT INTO pembayaran_piutang (penjualan_id, tanggal, jumlah, catatan, user_id) VALUES (?, ?, ?, ?, ?)')
    .bind(id, tanggal, bayar, catatan || '', c.get('user').id).run()
  const lunasSekarang = bayar >= sisa
  if (lunasSekarang) {
    await c.env.DB.prepare("UPDATE penjualan SET status_bayar='lunas', tanggal_lunas=? WHERE id = ?").bind(tanggal, id).run()
  }
  await catatAudit(c.env.DB, c.get('user'), 'bayar', 'piutang', id, `Cicilan Rp${bayar}${lunasSekarang ? ' (LUNAS)' : ` (sisa Rp${sisa - bayar})`}`)
  // Konfirmasi pembayaran ke pelanggan via WhatsApp
  c.executionCtx?.waitUntil?.(
    notifCicilan(c.env as OpenWAEnv, id, bayar, sisa - bayar, c.get('user').id)
  )
  return c.json({ sukses: true, lunas: lunasSekarang, sisa: sisa - bayar })
})

// --- Produk (owner & admin) ---
app.get('/api/admin/produk', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM produk ORDER BY id').all()
  return c.json({ produk: results })
})

app.post('/api/admin/produk', requireAuth(['owner', 'admin']), async (c) => {
  const { nama, jp, harga, satuan, deskripsi, badge, berat_kg } = await c.req.json()
  if (!nama || harga == null || !satuan) return c.json({ error: 'Nama, harga, dan satuan wajib diisi.' }, 400)
  await c.env.DB.prepare(
    'INSERT INTO produk (nama, jp, harga, satuan, deskripsi, badge, berat_kg) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(nama, jp || '', harga, satuan, deskripsi || '', badge || null, berat_kg || 0).run()
  return c.json({ sukses: true })
})

app.put('/api/admin/produk/:id', requireAuth(['owner', 'admin']), async (c) => {
  const { nama, jp, harga, satuan, deskripsi, badge, aktif, berat_kg } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE produk SET nama=?, jp=?, harga=?, satuan=?, deskripsi=?, badge=?, aktif=?, berat_kg=? WHERE id=?'
  ).bind(nama, jp || '', harga, satuan, deskripsi || '', badge || null, aktif ? 1 : 0, berat_kg || 0, c.req.param('id')).run()
  return c.json({ sukses: true })
})

app.delete('/api/admin/produk/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('UPDATE produk SET aktif = 0 WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ sukses: true })
})

// Ubah harga saja (dipakai kalkulator harga jual)
app.put('/api/admin/produk/:id/harga', requireAuth(['owner', 'admin']), async (c) => {
  const user = c.get('user')
  const { harga } = await c.req.json()
  const h = parseInt(harga)
  if (!h || h <= 0) return c.json({ error: 'Harga tidak valid.' }, 400)
  const id = c.req.param('id')
  const lama = await c.env.DB.prepare('SELECT nama, harga FROM produk WHERE id=?').bind(id).first<any>()
  if (!lama) return c.json({ error: 'Produk tidak ditemukan.' }, 404)
  await c.env.DB.prepare('UPDATE produk SET harga=? WHERE id=?').bind(h, id).run()
  await catatAudit(c.env.DB, user, 'ubah', 'produk', parseInt(id), `Harga "${lama.nama}": ${lama.harga} → ${h} (via kalkulator)`)
  return c.json({ sukses: true })
})

// --- Pengguna (hanya owner) ---
app.get('/api/admin/users', requireAuth(['owner']), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, username, nama, role, aktif, created_at, COALESCE(wa, \'\') AS wa FROM users ORDER BY id'
  ).all()
  return c.json({ users: results })
})

app.post('/api/admin/users', requireAuth(['owner']), async (c) => {
  const { username, nama, password, role } = await c.req.json()
  if (!username || !nama || !password || !role) return c.json({ error: 'Semua kolom wajib diisi.' }, 400)
  if (password.length < 6) return c.json({ error: 'Kata sandi minimal 6 karakter.' }, 400)
  if (!['owner', 'admin', 'karyawan'].includes(role)) return c.json({ error: 'Peran tidak valid.' }, 400)
  const ada = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username.toLowerCase()).first()
  if (ada) return c.json({ error: 'Username sudah terpakai.' }, 409)
  await c.env.DB.prepare('INSERT INTO users (username, password_hash, nama, role) VALUES (?, ?, ?, ?)')
    .bind(username.toLowerCase(), await hashPassword(password), nama, role).run()
  return c.json({ sukses: true })
})

app.put('/api/admin/users/:id/status', requireAuth(['owner']), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (id === c.get('user').id) return c.json({ error: 'Tidak bisa menonaktifkan akun sendiri.' }, 400)
  const { aktif } = await c.req.json()
  await c.env.DB.prepare('UPDATE users SET aktif = ? WHERE id = ?').bind(aktif ? 1 : 0, id).run()
  if (!aktif) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  return c.json({ sukses: true })
})

app.put('/api/admin/users/:id/password', requireAuth(['owner']), async (c) => {
  const { password } = await c.req.json()
  if (!password || password.length < 6) return c.json({ error: 'Kata sandi minimal 6 karakter.' }, 400)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(password), c.req.param('id')).run()
  return c.json({ sukses: true })
})

// ============ FASE 1: BATCH BAGLOG ============

// Daftar batch + agregat panen & kejadian (semua role bisa lihat)
app.get('/api/admin/baglog', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT b.*,
      COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k WHERE k.batch_id = b.id AND k.jenis='kontaminasi'),0) AS kontaminasi,
      COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k WHERE k.batch_id = b.id AND k.jenis IN ('rusak','afkir')),0) AS rusak_afkir,
      COALESCE((SELECT SUM(p.jumlah_kg) FROM panen p WHERE p.batch_id = b.id),0) AS total_panen_kg
    FROM baglog_batch b ORDER BY b.tanggal DESC, b.id DESC LIMIT 100
  `).all()
  return c.json({ batch: results })
})

// Buat batch baru (owner & admin) — kode otomatis BG-YYYY-MM-XXX
app.post('/api/admin/baglog', requireAuth(['owner', 'admin']), async (c) => {
  const { tanggal, jumlah, sumber, biaya_per_baglog, lokasi, tanggal_masuk_kumbung, catatan } = await c.req.json()
  if (!tanggal || !jumlah || jumlah <= 0) return c.json({ error: 'Tanggal dan jumlah baglog wajib diisi.' }, 400)
  const bulan = tanggal.slice(0, 7) // YYYY-MM
  const last = await c.env.DB.prepare(
    "SELECT kode FROM baglog_batch WHERE kode LIKE ? ORDER BY kode DESC LIMIT 1"
  ).bind(`BG-${bulan}-%`).first<any>()
  const urut = last ? parseInt(last.kode.slice(-3)) + 1 : 1
  const kode = `BG-${bulan}-${String(urut).padStart(3, '0')}`
  await c.env.DB.prepare(
    'INSERT INTO baglog_batch (kode, tanggal, jumlah, sumber, biaya_per_baglog, lokasi, tanggal_masuk_kumbung, status, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(kode, tanggal, jumlah, sumber || 'produksi sendiri', biaya_per_baglog || 0, lokasi || '',
    tanggal_masuk_kumbung || null, tanggal_masuk_kumbung ? 'produktif' : 'inkubasi', catatan || '', c.get('user').id).run()
  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'baglog', kode, `${jumlah} baglog`)
  return c.json({ sukses: true, kode })
})

// Ubah status batch (owner & admin)
app.put('/api/admin/baglog/:id/status', requireAuth(['owner', 'admin']), async (c) => {
  const { status } = await c.req.json()
  if (!['inkubasi', 'produktif', 'afkir'].includes(status)) return c.json({ error: 'Status tidak valid.' }, 400)
  await c.env.DB.prepare(
    `UPDATE baglog_batch SET status = ?, tanggal_afkir = ${status === 'afkir' ? "date('now','+7 hours')" : 'NULL'},
     tanggal_masuk_kumbung = CASE WHEN ? = 'produktif' AND tanggal_masuk_kumbung IS NULL THEN date('now','+7 hours') ELSE tanggal_masuk_kumbung END
     WHERE id = ?`
  ).bind(status, status, c.req.param('id')).run()
  return c.json({ sukses: true })
})

// Catat kejadian: kontaminasi/rusak/afkir sebagian (semua role — karyawan yang lihat di lapangan)
app.post('/api/admin/baglog/:id/kejadian', requireAuth(), async (c) => {
  const batchId = c.req.param('id')
  const { tanggal, jenis, jumlah, catatan } = await c.req.json()
  if (!tanggal || !jenis || !jumlah || jumlah <= 0) return c.json({ error: 'Tanggal, jenis, dan jumlah wajib diisi.' }, 400)
  if (!['kontaminasi', 'rusak', 'afkir'].includes(jenis)) return c.json({ error: 'Jenis tidak valid.' }, 400)
  const b = await c.env.DB.prepare(`
    SELECT b.jumlah, COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k WHERE k.batch_id = b.id),0) AS sudah_hilang
    FROM baglog_batch b WHERE b.id = ?
  `).bind(batchId).first<any>()
  if (!b) return c.json({ error: 'Batch tidak ditemukan.' }, 404)
  // VALIDASI ANTI-MISS: tidak boleh melebihi sisa baglog
  const sisa = b.jumlah - b.sudah_hilang
  if (jumlah > sisa) return c.json({ error: `Jumlah melebihi sisa baglog batch ini (sisa: ${sisa}).` }, 400)
  await c.env.DB.prepare(
    'INSERT INTO baglog_kejadian (batch_id, tanggal, jenis, jumlah, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(batchId, tanggal, jenis, jumlah, catatan || '', c.get('user').id).run()
  return c.json({ sukses: true, sisa: sisa - jumlah })
})

// Riwayat kejadian per batch
app.get('/api/admin/baglog/:id/kejadian', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT k.*, u.nama AS pencatat FROM baglog_kejadian k LEFT JOIN users u ON u.id = k.user_id
    WHERE k.batch_id = ? ORDER BY k.tanggal DESC, k.id DESC
  `).bind(c.req.param('id')).all()
  return c.json({ kejadian: results })
})

// ============ FASE 1: PELANGGAN ============

app.get('/api/admin/pelanggan', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT pl.*,
      COALESCE((SELECT SUM(j.total) FROM penjualan j WHERE j.pelanggan_id = pl.id),0) AS total_belanja,
      COALESCE((SELECT SUM(j.total) FROM penjualan j WHERE j.pelanggan_id = pl.id AND j.status_bayar='tempo'),0) AS piutang
    FROM pelanggan pl ORDER BY total_belanja DESC, pl.id
  `).all()
  return c.json({ pelanggan: results })
})

app.post('/api/admin/pelanggan', requireAuth(), async (c) => {
  const { nama, tipe, wa, alamat, catatan } = await c.req.json()
  if (!nama) return c.json({ error: 'Nama pelanggan wajib diisi.' }, 400)
  if (tipe && !['eceran', 'warung', 'resto', 'reseller'].includes(tipe)) return c.json({ error: 'Tipe tidak valid.' }, 400)
  await c.env.DB.prepare(
    'INSERT INTO pelanggan (nama, tipe, wa, alamat, catatan) VALUES (?, ?, ?, ?, ?)'
  ).bind(nama, tipe || 'eceran', wa || '', alamat || '', catatan || '').run()
  return c.json({ sukses: true })
})

app.put('/api/admin/pelanggan/:id', requireAuth(['owner', 'admin']), async (c) => {
  const { nama, tipe, wa, alamat, catatan, aktif } = await c.req.json()
  if (!nama) return c.json({ error: 'Nama pelanggan wajib diisi.' }, 400)
  await c.env.DB.prepare(
    'UPDATE pelanggan SET nama=?, tipe=?, wa=?, alamat=?, catatan=?, aktif=? WHERE id=?'
  ).bind(nama, tipe || 'eceran', wa || '', alamat || '', catatan || '', aktif ? 1 : 0, c.req.param('id')).run()
  return c.json({ sukses: true })
})

// ============ FASE 1: PIUTANG ============

app.get('/api/admin/piutang', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT j.id, j.tanggal, j.nama_produk, j.jumlah, j.total, j.jatuh_tempo, j.pembeli,
      pl.nama AS pelanggan_nama, pl.wa AS pelanggan_wa,
      COALESCE((SELECT SUM(b.jumlah) FROM pembayaran_piutang b WHERE b.penjualan_id = j.id),0) AS terbayar,
      CASE WHEN j.jatuh_tempo < date('now','+7 hours') THEN 1 ELSE 0 END AS terlambat
    FROM penjualan j LEFT JOIN pelanggan pl ON pl.id = j.pelanggan_id
    WHERE j.status_bayar = 'tempo'
    ORDER BY j.jatuh_tempo ASC
  `).all()
  return c.json({ piutang: results })
})

// ============ FASE 2: KEUANGAN (owner & admin) ============

// Fase 12 — penjaga tutup buku: periode yang sudah dikunci tidak boleh
// menerima transaksi baru maupun diubah, supaya laporan historis tetap final.
async function periodeTertutup(db: D1Database, tanggal: string): Promise<string | null> {
  if (!tanggal || tanggal.length < 7) return null
  const r = await db.prepare('SELECT periode FROM buku_tutup WHERE periode = ?')
    .bind(String(tanggal).slice(0, 7)).first<any>().catch(() => null)
  return r?.periode || null
}

const KATEGORI_PENGELUARAN = ['bahan_baku', 'bibit', 'gas_sterilisasi', 'listrik_air', 'gaji', 'transport', 'kemasan', 'perawatan', 'lainnya']

app.get('/api/admin/pengeluaran', requireAuth(['owner', 'admin']), async (c) => {
  const bulan = c.req.query('bulan') // opsional YYYY-MM
  const q = bulan
    ? c.env.DB.prepare(`SELECT p.*, u.nama AS pencatat FROM pengeluaran p LEFT JOIN users u ON u.id=p.user_id WHERE strftime('%Y-%m',p.tanggal)=? ORDER BY p.tanggal DESC, p.id DESC`).bind(bulan)
    : c.env.DB.prepare(`SELECT p.*, u.nama AS pencatat FROM pengeluaran p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.tanggal DESC, p.id DESC LIMIT 100`)
  const { results } = await q.all()
  return c.json({ pengeluaran: results })
})

app.post('/api/admin/pengeluaran', requireAuth(['owner', 'admin']), async (c) => {
  const { tanggal, kategori, jumlah, keterangan, no_bukti } = await c.req.json()
  if (!tanggal || !kategori || !jumlah || jumlah <= 0) return c.json({ error: 'Tanggal, kategori, dan jumlah wajib diisi.' }, 400)
  if (!KATEGORI_PENGELUARAN.includes(kategori)) return c.json({ error: 'Kategori tidak valid.' }, 400)
  const tutup = await periodeTertutup(c.env.DB, tanggal)
  if (tutup) return c.json({ error: `Buku periode ${tutup} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  const res = await c.env.DB.prepare(
    'INSERT INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id, no_bukti, sumber) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, kategori, jumlah, keterangan || '', c.get('user').id,
    String(no_bukti || '').slice(0, 40), 'manual').run()
  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'pengeluaran', res.meta.last_row_id, `${kategori} Rp${jumlah} (${tanggal})`)
  return c.json({ sukses: true, id: res.meta.last_row_id })
})

app.delete('/api/admin/pengeluaran/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT tanggal, kategori, jumlah, sumber FROM pengeluaran WHERE id = ?').bind(id).first<any>()
  if (!row) return c.json({ error: 'Data tidak ditemukan.' }, 404)
  const tutup = await periodeTertutup(c.env.DB, row.tanggal)
  if (tutup) return c.json({ error: `Buku periode ${tutup} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  if (String(row.sumber || '').startsWith('auto:')) {
    return c.json({ error: 'Baris ini dibuat otomatis oleh sistem (baglog/gaji/gateway). Hapus sumbernya, bukan barisnya.' }, 400)
  }
  await c.env.DB.prepare('DELETE FROM pengeluaran WHERE id = ?').bind(id).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'pengeluaran', id, `${row.kategori} Rp${row.jumlah} (${row.tanggal})`)
  return c.json({ sukses: true })
})

app.get('/api/admin/pemasukan-lain', requireAuth(['owner', 'admin']), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, u.nama AS pencatat FROM pemasukan_lain p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.tanggal DESC, p.id DESC LIMIT 100`
  ).all()
  return c.json({ pemasukan: results })
})

app.post('/api/admin/pemasukan-lain', requireAuth(['owner', 'admin']), async (c) => {
  const { tanggal, jumlah, keterangan } = await c.req.json()
  if (!tanggal || !jumlah || jumlah <= 0) return c.json({ error: 'Tanggal dan jumlah wajib diisi.' }, 400)
  const tutup = await periodeTertutup(c.env.DB, tanggal)
  if (tutup) return c.json({ error: `Buku periode ${tutup} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  const res = await c.env.DB.prepare(
    'INSERT INTO pemasukan_lain (tanggal, jumlah, keterangan, user_id, sumber, kategori) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, jumlah, keterangan || '', c.get('user').id, 'manual', 'lainnya').run()
  await catatAudit(c.env.DB, c.get('user'), 'tambah', 'pemasukan-lain', res.meta.last_row_id, `Rp${jumlah} (${tanggal})`)
  return c.json({ sukses: true, id: res.meta.last_row_id })
})

app.delete('/api/admin/pemasukan-lain/:id', requireAuth(['owner', 'admin']), async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT tanggal, jumlah, sumber FROM pemasukan_lain WHERE id = ?').bind(id).first<any>()
  if (!row) return c.json({ error: 'Data tidak ditemukan.' }, 404)
  const tutup = await periodeTertutup(c.env.DB, row.tanggal)
  if (tutup) return c.json({ error: `Buku periode ${tutup} sudah ditutup. Buka kembali dulu di tab Otomatisasi.` }, 400)
  if (String(row.sumber || '').startsWith('auto:')) {
    return c.json({ error: 'Baris ini dibuat otomatis dari pesanan (ongkir/biaya admin). Batalkan pesanannya, bukan barisnya.' }, 400)
  }
  await c.env.DB.prepare('DELETE FROM pemasukan_lain WHERE id = ?').bind(id).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'pemasukan-lain', id, `Rp${row.jumlah} (${row.tanggal})`)
  return c.json({ sukses: true })
})

// Laporan laba/rugi + HPP per bulan (?bulan=YYYY-MM, default bulan berjalan)
app.get('/api/admin/laporan', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const bulan = c.req.query('bulan') || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(bulan)) return c.json({ error: 'Format bulan harus YYYY-MM.' }, 400)

  // Fase 12 — kalau periode sudah DITUTUP, sajikan angka snapshot supaya
  // laporan historis tidak ikut berubah bila ada input mundur.
  const snapshot = await db.prepare('SELECT * FROM buku_tutup WHERE periode = ?')
    .bind(bulan).first<any>().catch(() => null)

  const [omzet, omzetLunas, pemasukanLain, pengeluaranPerKategori, panenKg, susutKg, baglogBaru, kontaminasi] = await Promise.all([
    // Omzet akrual: semua penjualan tercatat bulan itu
    db.prepare(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM penjualan WHERE strftime('%Y-%m',tanggal)=?`).bind(bulan).first<any>(),
    // Kas masuk dari penjualan: yang lunas (tanggal_lunas di bulan itu)
    db.prepare(`SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE status_bayar='lunas' AND strftime('%Y-%m',tanggal_lunas)=?`).bind(bulan).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(jumlah),0) v FROM pemasukan_lain WHERE strftime('%Y-%m',tanggal)=?`).bind(bulan).first<any>(),
    db.prepare(`SELECT kategori, SUM(jumlah) v FROM pengeluaran WHERE strftime('%Y-%m',tanggal)=? GROUP BY kategori ORDER BY v DESC`).bind(bulan).all(),
    db.prepare(`SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal)=?`).bind(bulan).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(susut_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal)=?`).bind(bulan).first<any>(),
    // Investasi baglog bulan itu (jumlah x biaya per baglog)
    // Investasi baglog yang BELUM dibukukan sebagai pengeluaran (agar tidak
    // dihitung dua kali sejak biaya baglog dibukukan otomatis — Fase 12)
    db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN NOT EXISTS (
                 SELECT 1 FROM pengeluaran p WHERE p.sumber='auto:baglog' AND p.no_bukti=b.kode
               ) THEN b.jumlah * b.biaya_per_baglog ELSE 0 END),0) v,
             COALESCE(SUM(b.jumlah),0) n
      FROM baglog_batch b WHERE strftime('%Y-%m',b.tanggal)=?`).bind(bulan).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(k.jumlah),0) v FROM baglog_kejadian k WHERE k.jenis='kontaminasi' AND strftime('%Y-%m',k.tanggal)=?`).bind(bulan).first<any>()
  ])

  const totalPengeluaran = (pengeluaranPerKategori.results as any[]).reduce((s, r) => s + r.v, 0)
  const totalPemasukan = (omzet?.v ?? 0) + (pemasukanLain?.v ?? 0)
  const labaRugi = totalPemasukan - totalPengeluaran
  const kg = panenKg?.v ?? 0
  // HPP per kg = (pengeluaran operasional + investasi baglog bulan itu) / kg panen
  const totalBiaya = totalPengeluaran + (baglogBaru?.v ?? 0)
  const hppPerKg = kg > 0 ? Math.round(totalBiaya / kg) : 0
  const kasMasuk = (omzetLunas?.v ?? 0) + (pemasukanLain?.v ?? 0)

  return c.json({
    bulan,
    // Status tutup buku: bila terkunci, angka utama diambil dari snapshot
    tutupBuku: snapshot ? {
      ditutup: true, ditutupAt: snapshot.ditutup_at, otomatis: !!snapshot.otomatis,
      omzet: snapshot.omzet, pengeluaran: snapshot.pengeluaran, laba: snapshot.laba,
      kasMasuk: snapshot.kas_masuk, piutangAkhir: snapshot.piutang_akhir,
      // Peringatan bila data hidup sudah berbeda dari yang dikunci
      berubah: snapshot.omzet !== (omzet?.v ?? 0) || snapshot.pengeluaran !== totalPengeluaran
    } : { ditutup: false },
    omzet: omzet?.v ?? 0, jumlahNota: omzet?.n ?? 0,
    pemasukanLain: pemasukanLain?.v ?? 0,
    totalPemasukan,
    pengeluaranPerKategori: pengeluaranPerKategori.results,
    totalPengeluaran,
    labaRugi,
    kasMasuk,                                  // basis kas (yang benar-benar diterima)
    piutangBulanIni: (omzet?.v ?? 0) - (omzetLunas?.v ?? 0) > 0 ? (omzet?.v ?? 0) - (omzetLunas?.v ?? 0) : 0,
    panenKg: kg, susutKg: susutKg?.v ?? 0,
    susutPersen: kg + (susutKg?.v ?? 0) > 0 ? Math.round(((susutKg?.v ?? 0) / (kg + (susutKg?.v ?? 0))) * 1000) / 10 : 0,
    investasiBaglog: baglogBaru?.v ?? 0, baglogBaruJumlah: baglogBaru?.n ?? 0,
    kontaminasiBulanIni: kontaminasi?.v ?? 0,
    hppPerKg,
    rataHargaJualPerKg: kg > 0 && (omzet?.v ?? 0) > 0 ? Math.round((omzet.v) / kg) : 0
  })
})

// Tren antar-bulan: omzet, pengeluaran, laba, panen kg, HPP/kg — 12 bulan terakhir
app.get('/api/admin/tren', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const jumlahBulan = Math.min(Math.max(parseInt(c.req.query('bulan') || '12') || 12, 3), 24)

  // Daftar bulan (YYYY-MM) dari sekarang mundur
  const bulanList: string[] = []
  const kini = new Date()
  for (let i = jumlahBulan - 1; i >= 0; i--) {
    const d = new Date(kini.getFullYear(), kini.getMonth() - i, 1)
    bulanList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const awal = bulanList[0]

  const [omzet, keluar, masukLain, panen, baglog] = await Promise.all([
    db.prepare(`SELECT strftime('%Y-%m',tanggal) b, SUM(total) v FROM penjualan WHERE strftime('%Y-%m',tanggal)>=? GROUP BY b`).bind(awal).all(),
    db.prepare(`SELECT strftime('%Y-%m',tanggal) b, SUM(jumlah) v FROM pengeluaran WHERE strftime('%Y-%m',tanggal)>=? GROUP BY b`).bind(awal).all(),
    db.prepare(`SELECT strftime('%Y-%m',tanggal) b, SUM(jumlah) v FROM pemasukan_lain WHERE strftime('%Y-%m',tanggal)>=? GROUP BY b`).bind(awal).all(),
    db.prepare(`SELECT strftime('%Y-%m',tanggal) b, SUM(jumlah_kg) v FROM panen WHERE strftime('%Y-%m',tanggal)>=? GROUP BY b`).bind(awal).all(),
    db.prepare(`
      SELECT strftime('%Y-%m',b.tanggal) b,
        SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM pengeluaran p WHERE p.sumber='auto:baglog' AND p.no_bukti=b.kode
        ) THEN b.jumlah*b.biaya_per_baglog ELSE 0 END) v
      FROM baglog_batch b WHERE strftime('%Y-%m',b.tanggal)>=? GROUP BY b`).bind(awal).all()
  ])
  const petakan = (rs: any) => Object.fromEntries((rs.results as any[]).map(r => [r.b, r.v || 0]))
  const mOmzet = petakan(omzet), mKeluar = petakan(keluar), mLain = petakan(masukLain), mPanen = petakan(panen), mBaglog = petakan(baglog)

  const data = bulanList.map(b => {
    const o = mOmzet[b] || 0, k = mKeluar[b] || 0, l = mLain[b] || 0, p = mPanen[b] || 0, inv = mBaglog[b] || 0
    return {
      bulan: b,
      omzet: o,
      pemasukanLain: l,
      pengeluaran: k,
      laba: o + l - k,
      panenKg: Math.round(p * 100) / 100,
      hppPerKg: p > 0 ? Math.round((k + inv) / p) : 0
    }
  })
  return c.json({ data })
})

// Kalkulator harga jual: HPP per kg (rata N bulan terakhir yang ada panen) + margin %
app.get('/api/admin/kalkulator-harga', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const marginPersen = Math.min(Math.max(parseFloat(c.req.query('margin') || '15') || 15, 0), 500)

  // HPP dihitung dari 3 bulan terakhir yang punya panen (agar stabil, bukan cuma bulan berjalan)
  const baris = await db.prepare(`
    SELECT b, kg, biaya FROM (
      SELECT strftime('%Y-%m', p.tanggal) b,
        SUM(p.jumlah_kg) kg,
        (SELECT COALESCE(SUM(jumlah),0) FROM pengeluaran WHERE strftime('%Y-%m',tanggal)=strftime('%Y-%m',p.tanggal)) +
        (SELECT COALESCE(SUM(CASE WHEN NOT EXISTS (
            SELECT 1 FROM pengeluaran pg WHERE pg.sumber='auto:baglog' AND pg.no_bukti=b.kode
          ) THEN b.jumlah*b.biaya_per_baglog ELSE 0 END),0)
         FROM baglog_batch b WHERE strftime('%Y-%m',b.tanggal)=strftime('%Y-%m',p.tanggal)) biaya
      FROM panen p GROUP BY b ORDER BY b DESC LIMIT 3
    )`).all()
  const rows = baris.results as any[]
  const totalKg = rows.reduce((s, r) => s + (r.kg || 0), 0)
  const totalBiaya = rows.reduce((s, r) => s + (r.biaya || 0), 0)
  const hppPerKg = totalKg > 0 ? Math.round(totalBiaya / totalKg) : 0

  // Rekomendasi harga per produk = HPP x berat + margin, dibulatkan ke atas per Rp500
  const produk = await db.prepare(`SELECT id, nama, harga, satuan, berat_kg FROM produk WHERE aktif=1 ORDER BY id`).all()
  const rekomendasi = (produk.results as any[]).map(p => {
    const modal = p.berat_kg > 0 ? Math.round(hppPerKg * p.berat_kg) : 0
    const hargaIdeal = modal > 0 ? Math.ceil((modal * (1 + marginPersen / 100)) / 500) * 500 : null
    const marginSaatIni = modal > 0 ? Math.round(((p.harga - modal) / modal) * 1000) / 10 : null
    return {
      id: p.id, nama: p.nama, satuan: p.satuan, beratKg: p.berat_kg,
      hargaSaatIni: p.harga,
      modalPerUnit: modal || null,
      marginSaatIniPersen: marginSaatIni,      // margin aktual dengan harga sekarang
      hargaRekomendasi: hargaIdeal,            // HPP + margin target, dibulatkan Rp500
      selisih: hargaIdeal != null ? hargaIdeal - p.harga : null
    }
  })

  return c.json({
    hppPerKg,
    dasarBulan: rows.map(r => r.b),
    totalKg: Math.round(totalKg * 100) / 100,
    totalBiaya,
    marginPersen,
    hargaJualPerKg: hppPerKg > 0 ? Math.ceil((hppPerKg * (1 + marginPersen / 100)) / 500) * 500 : 0,
    rekomendasi
  })
})

// ============ FASE 3: STOK HARIAN + REKONSILIASI ============

const JENIS_PENYESUAIAN = ['rusak', 'bonus', 'sampel', 'konsumsi', 'koreksi', 'lainnya']

// Rekonsiliasi stok per hari dalam 1 bulan: panen vs terjual (kg) vs penyesuaian
app.get('/api/admin/stok', requireAuth(), async (c) => {
  const db = c.env.DB
  const bulan = c.req.query('bulan') || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(bulan)) return c.json({ error: 'Format bulan harus YYYY-MM.' }, 400)

  const [panen, jual, sesuai, saldoAwal] = await Promise.all([
    db.prepare(`SELECT tanggal, SUM(jumlah_kg) v FROM panen WHERE strftime('%Y-%m',tanggal)=? GROUP BY tanggal`).bind(bulan).all(),
    db.prepare(`SELECT tanggal, SUM(berat_kg) v FROM penjualan WHERE strftime('%Y-%m',tanggal)=? GROUP BY tanggal`).bind(bulan).all(),
    db.prepare(`SELECT tanggal,
        SUM(CASE WHEN arah='masuk' THEN jumlah_kg ELSE 0 END) masuk,
        SUM(CASE WHEN arah='keluar' THEN jumlah_kg ELSE 0 END) keluar
      FROM stok_penyesuaian WHERE strftime('%Y-%m',tanggal)=? GROUP BY tanggal`).bind(bulan).all(),
    // Saldo stok sebelum bulan ini (akumulasi semua riwayat)
    db.prepare(`SELECT
        (SELECT COALESCE(SUM(jumlah_kg),0) FROM panen WHERE strftime('%Y-%m',tanggal)<?)
      - (SELECT COALESCE(SUM(berat_kg),0) FROM penjualan WHERE strftime('%Y-%m',tanggal)<?)
      + (SELECT COALESCE(SUM(CASE WHEN arah='masuk' THEN jumlah_kg ELSE -jumlah_kg END),0) FROM stok_penyesuaian WHERE strftime('%Y-%m',tanggal)<?)
      AS v`).bind(bulan, bulan, bulan).first<any>()
  ])

  const peta = new Map<string, any>()
  const ambil = (t: string) => {
    if (!peta.has(t)) peta.set(t, { tanggal: t, panenKg: 0, terjualKg: 0, penyesuaianMasuk: 0, penyesuaianKeluar: 0 })
    return peta.get(t)
  }
  for (const r of panen.results as any[]) ambil(r.tanggal).panenKg = r.v
  for (const r of jual.results as any[]) ambil(r.tanggal).terjualKg = r.v
  for (const r of sesuai.results as any[]) { const x = ambil(r.tanggal); x.penyesuaianMasuk = r.masuk; x.penyesuaianKeluar = r.keluar }

  const hari = [...peta.values()].sort((a, b) => a.tanggal < b.tanggal ? -1 : 1)
  let saldo = Math.round((saldoAwal?.v ?? 0) * 100) / 100
  const saldoAwalBulan = saldo
  for (const h of hari) {
    h.netto = Math.round((h.panenKg - h.terjualKg + h.penyesuaianMasuk - h.penyesuaianKeluar) * 100) / 100
    saldo = Math.round((saldo + h.netto) * 100) / 100
    h.saldoAkhir = saldo
    h.minus = saldo < 0 ? 1 : 0 // jamur "hilang": terjual lebih banyak dari yang pernah dipanen
  }
  return c.json({
    bulan, saldoAwalBulan, saldoAkhirBulan: saldo, hari,
    totalPanenKg: hari.reduce((s, h) => s + h.panenKg, 0),
    totalTerjualKg: hari.reduce((s, h) => s + h.terjualKg, 0),
    totalPenyesuaianKeluar: hari.reduce((s, h) => s + h.penyesuaianKeluar, 0),
    adaMinus: hari.some(h => h.minus) ? 1 : 0
  })
})

app.get('/api/admin/stok/penyesuaian', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, u.nama AS pencatat FROM stok_penyesuaian s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.tanggal DESC, s.id DESC LIMIT 100`
  ).all()
  return c.json({ penyesuaian: results })
})

app.post('/api/admin/stok/penyesuaian', requireAuth(), async (c) => {
  const { tanggal, jenis, arah, jumlah_kg, keterangan } = await c.req.json()
  if (!tanggal || !jenis || !arah || !jumlah_kg || jumlah_kg <= 0) return c.json({ error: 'Tanggal, jenis, arah, dan jumlah kg wajib diisi.' }, 400)
  if (!JENIS_PENYESUAIAN.includes(jenis)) return c.json({ error: 'Jenis penyesuaian tidak valid.' }, 400)
  if (!['keluar', 'masuk'].includes(arah)) return c.json({ error: 'Arah harus keluar/masuk.' }, 400)
  await c.env.DB.prepare('INSERT INTO stok_penyesuaian (tanggal, jenis, arah, jumlah_kg, keterangan, user_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(tanggal, jenis, arah, jumlah_kg, keterangan || '', c.get('user').id).run()
  return c.json({ sukses: true })
})

app.delete('/api/admin/stok/penyesuaian/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('DELETE FROM stok_penyesuaian WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ sukses: true })
})

// ============ FASE 3: PESANAN / PO PELANGGAN ============

app.get('/api/admin/pesanan', requireAuth(), async (c) => {
  const status = c.req.query('status') // opsional filter
  const base = `
    SELECT ps.*, pl.nama AS pelanggan_nama, pl.wa AS pelanggan_wa, u.nama AS pencatat,
      (SELECT COALESCE(SUM(subtotal),0) FROM pesanan_item WHERE pesanan_id = ps.id) AS total,
      (SELECT COUNT(*) FROM pesanan_item WHERE pesanan_id = ps.id) AS jumlah_item
    FROM pesanan ps
    LEFT JOIN pelanggan pl ON pl.id = ps.pelanggan_id
    LEFT JOIN users u ON u.id = ps.user_id`
  const q = status
    ? c.env.DB.prepare(base + ` WHERE ps.status = ? ORDER BY ps.tanggal_kirim ASC, ps.id DESC LIMIT 100`).bind(status)
    : c.env.DB.prepare(base + ` ORDER BY CASE ps.status WHEN 'baru' THEN 0 WHEN 'diproses' THEN 1 WHEN 'siap' THEN 2 WHEN 'selesai' THEN 3 ELSE 4 END, ps.tanggal_kirim ASC LIMIT 100`)
  const { results } = await q.all()
  return c.json({ pesanan: results })
})

app.get('/api/admin/pesanan/:id/item', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM pesanan_item WHERE pesanan_id = ? ORDER BY id').bind(c.req.param('id')).all()
  return c.json({ item: results })
})

app.post('/api/admin/pesanan', requireAuth(), async (c) => {
  const { pelanggan_id, tanggal_pesan, tanggal_kirim, catatan, item } = await c.req.json()
  if (!pelanggan_id) return c.json({ error: 'Pesanan wajib pelanggan terdaftar (untuk konfirmasi & penagihan).' }, 400)
  if (!tanggal_pesan || !tanggal_kirim) return c.json({ error: 'Tanggal pesan dan tanggal kirim wajib diisi.' }, 400)
  if (tanggal_kirim < tanggal_pesan) return c.json({ error: 'Tanggal kirim tidak boleh sebelum tanggal pesan.' }, 400)
  if (!Array.isArray(item) || item.length === 0) return c.json({ error: 'Pesanan minimal 1 item produk.' }, 400)

  const pl = await c.env.DB.prepare('SELECT nama FROM pelanggan WHERE id = ? AND aktif = 1').bind(pelanggan_id).first<any>()
  if (!pl) return c.json({ error: 'Pelanggan tidak ditemukan.' }, 404)

  // Validasi semua produk & hitung subtotal dari harga DB (anti-miss: harga tidak bisa dikarang)
  const barisItem: any[] = []
  for (const it of item) {
    if (!it.produk_id || !it.jumlah || it.jumlah <= 0) return c.json({ error: 'Setiap item wajib produk dan jumlah > 0.' }, 400)
    const p = await c.env.DB.prepare('SELECT id, nama, harga FROM produk WHERE id = ? AND aktif = 1').bind(it.produk_id).first<any>()
    if (!p) return c.json({ error: `Produk id ${it.produk_id} tidak ditemukan/nonaktif.` }, 404)
    barisItem.push({ produk_id: p.id, nama_produk: p.nama, jumlah: it.jumlah, harga: p.harga, subtotal: p.harga * it.jumlah })
  }

  // Kode otomatis PO-YYYY-MM-XXX.
  // FASE 11 (audit): dulu memakai COUNT(*) sehingga pesanan yang dihapus atau
  // dua input bersamaan menghasilkan kode kembar → gagal UNIQUE. Sekarang
  // memakai nomor terakhir + coba ulang otomatis bila bentrok.
  const bulan = String(tanggal_pesan).slice(0, 7)
  const { kode, id: pesananId } = await buatPesananDenganKode(c.env.DB, bulan, (kodeBaru) =>
    c.env.DB.prepare(
      'INSERT INTO pesanan (kode, pelanggan_id, tanggal_pesan, tanggal_kirim, status, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(kodeBaru, pelanggan_id, tanggal_pesan, tanggal_kirim, 'baru', catatan || '', c.get('user').id).run() as any
  )

  await c.env.DB.batch(barisItem.map(b =>
    c.env.DB.prepare('INSERT INTO pesanan_item (pesanan_id, produk_id, nama_produk, jumlah, harga, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(pesananId, b.produk_id, b.nama_produk, b.jumlah, b.harga, b.subtotal)
  ))
  // Konfirmasi pesanan ke pelanggan via WhatsApp (aman gagal)
  c.executionCtx?.waitUntil?.(notifPesananBaru(c.env as OpenWAEnv, pesananId, c.get('user').id))
  return c.json({ sukses: true, kode })
})

app.put('/api/admin/pesanan/:id/status', requireAuth(), async (c) => {
  const { status } = await c.req.json()
  if (!['baru', 'diproses', 'siap', 'batal'].includes(status)) {
    return c.json({ error: "Status hanya bisa: baru/diproses/siap/batal. Untuk 'selesai' gunakan tombol Selesai+Jual (agar penjualan otomatis tercatat, anti-miss)." }, 400)
  }
  const ps = await c.env.DB.prepare('SELECT status FROM pesanan WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  if (ps.status === 'selesai') return c.json({ error: 'Pesanan sudah selesai, tidak bisa diubah.' }, 400)
  await c.env.DB.prepare('UPDATE pesanan SET status = ? WHERE id = ?').bind(status, c.req.param('id')).run()
  // Kabari pelanggan perubahan status via WhatsApp
  c.executionCtx?.waitUntil?.(
    notifStatusPesanan(c.env as OpenWAEnv, c.req.param('id'), status, c.get('user').id)
  )
  return c.json({ sukses: true })
})

// Selesaikan pesanan → otomatis buat baris penjualan per item (anti-miss: PO selesai pasti tercatat sebagai penjualan)
app.post('/api/admin/pesanan/:id/selesai', requireAuth(), async (c) => {
  const { status_bayar, jatuh_tempo } = await c.req.json()
  const bayar = status_bayar === 'tempo' ? 'tempo' : 'lunas'
  if (bayar === 'tempo' && !jatuh_tempo) return c.json({ error: 'Pembayaran tempo wajib tanggal jatuh tempo.' }, 400)

  const ps = await c.env.DB.prepare('SELECT id, kode, status, penjualan_dibuat FROM pesanan WHERE id = ?')
    .bind(c.req.param('id')).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  if (ps.status === 'batal') return c.json({ error: 'Pesanan batal tidak bisa diselesaikan.' }, 400)

  // FASE 11 (audit): logika pembuatan penjualan dipindah ke modul bersama
  // yang idempoten, sehingga tombol admin, callback pembayaran, dan sapu
  // otomatis memakai jalur yang SAMA dan tidak mungkin dobel.
  const hasil = await buatPenjualanDariPesanan(c.env as OpenWAEnv, ps.id, {
    bayar, jatuhTempo: jatuh_tempo, userId: c.get('user').id,
    sumber: 'admin-selesai', tandaiSelesai: true
  })

  if (!hasil.ok) {
    // Pesanan yang sudah punya penjualan (mis. lunas via QRIS lalu dicatat
    // otomatis) tetap boleh ditutup statusnya, tanpa membuat penjualan kedua.
    if (ps.penjualan_dibuat && ps.status !== 'selesai') {
      await c.env.DB.prepare("UPDATE pesanan SET status='selesai' WHERE id = ?").bind(ps.id).run()
      await catatAudit(c.env.DB, c.get('user'), 'ubah', 'pesanan', ps.kode,
        'Ditutup selesai (penjualan sudah tercatat otomatis sebelumnya)')
      return c.json({ sukses: true, jumlahPenjualan: 0, catatan: 'Penjualan sudah tercatat otomatis sebelumnya.' })
    }
    return c.json({ error: hasil.alasan || 'Tidak bisa diselesaikan.' }, 400)
  }

  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'pesanan', ps.kode,
    `Selesai → ${hasil.jumlahPenjualan} penjualan otomatis (${bayar})`)
  // Kirim nota ke pelanggan via WhatsApp
  c.executionCtx?.waitUntil?.(
    notifNota(c.env as OpenWAEnv, ps.id, bayar, bayar === 'tempo' ? jatuh_tempo : null, c.get('user').id)
  )
  return c.json({
    sukses: true,
    jumlahPenjualan: hasil.jumlahPenjualan,
    ongkirDicatat: hasil.ongkirDicatat,
    biayaDicatat: hasil.biayaDicatat
  })
})

// ============ FASE 1: PENGATURAN WEBSITE ============

app.get('/api/admin/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  return c.json({ pengaturan: await getPengaturan(c.env.DB) })
})

app.put('/api/admin/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const kunciDiizinkan = ['wa_nomor', 'alamat', 'jam_operasional', 'instagram', 'facebook', 'tiktok', 'target_kg_bulanan']
  const stmts = []
  for (const [key, value] of Object.entries(body)) {
    if (!kunciDiizinkan.includes(key)) continue
    if (key === 'wa_nomor' && !/^\d{9,15}$/.test(String(value))) {
      return c.json({ error: 'Nomor WA harus angka saja diawali kode negara, contoh: 6281234567890' }, 400)
    }
    stmts.push(c.env.DB.prepare('INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, String(value)))
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'pengaturan', null, Object.keys(body).join(', '))
  return c.json({ sukses: true })
})

// Pengaturan Situs — KHUSUS OWNER (identitas & kendali seluruh website)
app.put('/api/admin/pengaturan-situs', requireAuth(['owner']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const kunciSitus = [
    'situs_nama', 'situs_nama_jp', 'situs_tagline', 'situs_deskripsi', 'situs_warna', 'situs_pesanan_online',
    'jam_kerja_masuk', 'jam_kerja_pulang',
    // Absensi ketat (Fase 9)
    'absen_wajib_selfie', 'absen_wajib_lokasi', 'absen_lat', 'absen_lng', 'absen_radius_m', 'absen_toleransi_telat', 'absen_auto_alpa',
    // Peta lokasi kumbung di landing page (Fase 10)
    'peta_lat', 'peta_lng', 'peta_zoom'
  ]
  // Validasi koordinat peta (kosong = peta tidak ditampilkan)
  if (body.peta_lat !== undefined && body.peta_lat !== '' && !(Math.abs(parseFloat(body.peta_lat)) <= 90)) return c.json({ error: 'Latitude peta tidak valid (-90 s/d 90).' }, 400)
  if (body.peta_lng !== undefined && body.peta_lng !== '' && !(Math.abs(parseFloat(body.peta_lng)) <= 180)) return c.json({ error: 'Longitude peta tidak valid (-180 s/d 180).' }, 400)
  if (body.peta_zoom !== undefined && body.peta_zoom !== '') {
    const z = parseInt(body.peta_zoom)
    if (isNaN(z) || z < 3 || z > 20) return c.json({ error: 'Zoom peta harus 3–20.' }, 400)
    body.peta_zoom = String(z)
  }
  if (body.situs_nama !== undefined && !String(body.situs_nama).trim()) return c.json({ error: 'Nama usaha tidak boleh kosong.' }, 400)
  if (body.situs_warna !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(String(body.situs_warna))) return c.json({ error: 'Warna harus format hex, contoh #C73E3A.' }, 400)
  for (const k of ['jam_kerja_masuk', 'jam_kerja_pulang']) {
    if (body[k] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body[k]))) return c.json({ error: 'Jam kerja harus format HH:MM, contoh 07:00.' }, 400)
  }
  // Validasi pengaturan absensi
  if (body.absen_lat !== undefined && body.absen_lat !== '' && !(Math.abs(parseFloat(body.absen_lat)) <= 90)) return c.json({ error: 'Latitude tidak valid (-90 s/d 90).' }, 400)
  if (body.absen_lng !== undefined && body.absen_lng !== '' && !(Math.abs(parseFloat(body.absen_lng)) <= 180)) return c.json({ error: 'Longitude tidak valid (-180 s/d 180).' }, 400)
  if (body.absen_radius_m !== undefined) {
    const r = parseInt(body.absen_radius_m)
    if (isNaN(r) || r < 20 || r > 5000) return c.json({ error: 'Radius absen harus 20–5000 meter.' }, 400)
    body.absen_radius_m = String(r)
  }
  if (body.absen_toleransi_telat !== undefined) {
    const t = parseInt(body.absen_toleransi_telat)
    if (isNaN(t) || t < 0 || t > 120) return c.json({ error: 'Toleransi telat harus 0–120 menit.' }, 400)
    body.absen_toleransi_telat = String(t)
  }
  const stmts = []
  for (const [key, value] of Object.entries(body)) {
    if (!kunciSitus.includes(key)) continue
    stmts.push(c.env.DB.prepare('INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, String(value)))
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'pengaturan-situs', null, Object.keys(body).join(', '))
  return c.json({ sukses: true })
})

// ============ FASE 9: MEDIA SITUS (foto landing page diubah owner) ============

// Kunci foto yang bisa diganti + fallback bawaan (gambar awal proyek)
const MEDIA_SITUS: Record<string, string> = {
  logo: '/static/logo-hiratake.png',
  // Gambar share WhatsApp/Facebook (Open Graph) — rasio 1200x630
  share: '/static/og-hiratake.jpg',
  tentang: 'https://sspark.genspark.ai/cfimages?u1=UioU8CaAvFwXKgmDMTnHAZ%2Fg8LdiUQwf6zafVhGnJbJ0UEqSD4FLOLdl85aj5HyHhXOQknYrIU1v9Q4R71mp7yHKoRVA6ofE3WeF%2B0bJ&u2=nsI7BCG4ryEZBNgw&width=1024',
  galeri1: 'https://sspark.genspark.ai/cfimages?u1=UioU8CaAvFwXKgmDMTnHAZ%2Fg8LdiUQwf6zafVhGnJbJ0UEqSD4FLOLdl85aj5HyHhXOQknYrIU1v9Q4R71mp7yHKoRVA6ofE3WeF%2B0bJ&u2=nsI7BCG4ryEZBNgw&width=1024',
  galeri2: 'https://sspark.genspark.ai/cfimages?u1=Xxq1%2FW5JqrpFiB0S1Ye%2BEx4h%2Fx6Qmk8WXefqU9ReHq5qnkSFfThr07xjegPEf7arx5xISF%2FtcaajpK8hg74GlF565NgbC52k2Y8%2FINw3&u2=QG9bO7d9VlcHardp&width=1024',
  galeri3: 'https://sspark.genspark.ai/cfimages?u1=yJmdIqKhR9nRMzxD%2FsFD3ShYd9gSsgfbr%2FfwT9KYjYkT6XR7Z2m3W4khJ2hQzs5Cd6zbzJWZGmzJ0w7wf0C%2BtKLAmfHOGxCIanbbFmmC&u2=DY5IzDqNlvNkFvpI&width=1024',
  galeri4: 'https://sspark.genspark.ai/cfimages?u1=eA1kewb6MI7OsnRyBxRuHQyhyqfH%2Fyu%2BNfMpRmB2UvLlTBxy%2BQy%2B%2BTxDWn9T%2FtE3PzpiF5quRuSuX6LUl7sbMo5Pi1qRkMondpy%2B13fCIKozLMFLxS8bI5FhZsK8YGocEkXhQJtl%2FU8pxdHdm1I8u2FOKF81AbeUxGBz3iEsKn%2BSDQ%3D%3D&u2=ae3EDdYubcZhb2vj&width=1024',
  galeri5: 'https://sspark.genspark.ai/cfimages?u1=5SlE%2BW1Bj5OfyXt5OyH9SiYoWOvQiEgshGmU1R50d8FblnMlLqiVMGpH8waNm4FeA5u48pG7QEvW1NRhRLPrUifdDJj19vIlenEAKaCEq3IUZloDkzgy8WxfGTmVGjWVavCDRAMj20vn7gWKMiQQ%2FyzLNl%2BodfxOb53Jcj9nDzioqJARfrw%3D&u2=bdzZ8C37YOzEBIy%2B&width=1024',
  galeri6: 'https://sspark.genspark.ai/cfimages?u1=JQhLMkIrzwAKHh7DmCjC%2Bj8fl8t2gct7Atj%2B7nfqcg23jhiTMDxiiQrXn5dOxVDQlvwJ%2FalGenXPYsN0ecfoWg3X0IeqbgE1tFZWqEsRW2AR2sEGid7jJ5l7ADspQ87GktQJPMGdtQykd5RXlLjMXjDBKS%2BeXU1RXPFTuhkNTReO9a0w1ki4HTpBpuNh07hv%2BZBKM4%2BqJE59L%2Fj5uPpR6GYhpA%3D%3D&u2=1g62Vo%2F10iUqatS4&width=1024'
}

// Publik: sajikan foto situs — pakai unggahan owner bila ada, kalau tidak redirect ke bawaan
app.get('/media/situs/:key', async (c) => {
  const key = c.req.param('key')
  if (!(key in MEDIA_SITUS)) return c.notFound()
  const row = await c.env.DB.prepare('SELECT mime, data, updated_at FROM situs_media WHERE key = ?').bind(key).first<any>()
  if (!row) return c.redirect(MEDIA_SITUS[key], 302)
  const bin = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0))
  return new Response(bin, {
    headers: {
      'Content-Type': row.mime,
      // Cache pendek + revalidasi: foto baru terlihat cepat tanpa membebani DB
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'ETag': `"${key}-${row.updated_at}"`
    }
  })
})

// Owner: daftar status foto (mana yang sudah diganti)
app.get('/api/admin/situs/media', requireAuth(['owner']), async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, mime, updated_at, LENGTH(data) AS ukuran FROM situs_media').all()
  const terpasang = new Map((results as any[]).map((r) => [r.key, r]))
  return c.json({
    media: Object.keys(MEDIA_SITUS).map((key) => ({
      key,
      kustom: terpasang.has(key),
      updated_at: terpasang.get(key)?.updated_at || null,
      ukuranKB: terpasang.has(key) ? Math.round((terpasang.get(key).ukuran * 3) / 4 / 1024) : null
    }))
  })
})

// Owner: unggah foto pengganti (JPEG/PNG/WebP, maks ~800 KB setelah kompresi di browser)
app.put('/api/admin/situs/media/:key', requireAuth(['owner']), async (c) => {
  const key = c.req.param('key')
  if (!(key in MEDIA_SITUS)) return c.json({ error: 'Kunci foto tidak dikenal.' }, 400)
  const { foto } = await c.req.json<{ foto: string }>()
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(foto || ''))
  if (!m) return c.json({ error: 'Format foto tidak valid. Gunakan JPEG/PNG/WebP.' }, 400)
  const [, mime, b64] = m
  if (b64.length > 1_100_000) return c.json({ error: 'Foto terlalu besar (maks ±800 KB). Perkecil dulu.' }, 400)
  if (b64.length < 500) return c.json({ error: 'Foto tidak lengkap.' }, 400)
  await c.env.DB.prepare(`
    INSERT INTO situs_media (key, mime, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET mime=excluded.mime, data=excluded.data, updated_at=CURRENT_TIMESTAMP
  `).bind(key, mime, b64).run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'situs-media', key, `Ganti foto ${key} (${Math.round((b64.length * 3) / 4 / 1024)} KB)`)
  // Gambar share diganti → naikkan og_versi agar cache preview WhatsApp/Facebook ikut segar
  if (key === 'share') await naikkanOgVersi(c.env.DB)
  return c.json({ sukses: true })
})

// Owner: kembalikan ke foto bawaan
app.delete('/api/admin/situs/media/:key', requireAuth(['owner']), async (c) => {
  const key = c.req.param('key')
  await c.env.DB.prepare('DELETE FROM situs_media WHERE key = ?').bind(key).run()
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'situs-media', key, 'Kembalikan foto bawaan')
  if (key === 'share') await naikkanOgVersi(c.env.DB)
  return c.json({ sukses: true })
})

/**
 * Naikkan `og_versi` — dipakai sebagai cache-buster pada og:image.
 * WhatsApp & Facebook menyimpan preview link cukup lama; mengubah URL
 * gambar memaksa mereka mengambil versi baru.
 */
async function naikkanOgVersi(db: D1Database) {
  await db.prepare(`
    INSERT INTO pengaturan (key, value) VALUES ('og_versi', '2')
    ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
  `).run()
}

// ============ FASE 6: ABSENSI & PENGGAJIAN ============
// (Absen masuk/pulang kini ditangani absensiRoutes — selfie + GPS + jam server, anti-kecurangan)

// Status absen saya hari ini
app.get('/api/admin/absensi/saya', requireAuth(), async (c) => {
  const me = c.get('user')
  const tanggal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const hariIni = await c.env.DB.prepare('SELECT * FROM absensi WHERE user_id=? AND tanggal=?').bind(me.id, tanggal).first()
  return c.json({ hariIni: hariIni || null, tanggal })
})

// Rekap absensi per bulan (semua bisa lihat; karyawan hanya dirinya)
app.get('/api/admin/absensi', requireAuth(), async (c) => {
  const me = c.get('user')
  const bulan = c.req.query('bulan') || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(bulan)) return c.json({ error: 'Format bulan harus YYYY-MM.' }, 400)
  const hanyaSaya = me.role === 'karyawan'
  const { results } = await c.env.DB.prepare(`
    SELECT a.*, u.nama, u.role,
      (SELECT COUNT(*) FROM absensi_foto f WHERE f.absensi_id=a.id AND f.jenis='masuk') AS ada_foto_masuk,
      (SELECT COUNT(*) FROM absensi_foto f WHERE f.absensi_id=a.id AND f.jenis='pulang') AS ada_foto_pulang
    FROM absensi a JOIN users u ON u.id=a.user_id
    WHERE strftime('%Y-%m', a.tanggal)=? ${hanyaSaya ? 'AND a.user_id=?' : ''}
    ORDER BY a.tanggal DESC, u.nama`).bind(...(hanyaSaya ? [bulan, me.id] : [bulan])).all()
  // Ringkasan hadir per user
  const { results: rekap } = await c.env.DB.prepare(`
    SELECT u.id user_id, u.nama, u.role, u.upah_harian,
      SUM(CASE WHEN a.status='hadir' THEN 1 ELSE 0 END) hadir,
      SUM(CASE WHEN a.status='izin' THEN 1 ELSE 0 END) izin,
      SUM(CASE WHEN a.status='sakit' THEN 1 ELSE 0 END) sakit,
      SUM(CASE WHEN a.status='alpa' THEN 1 ELSE 0 END) alpa
    FROM users u LEFT JOIN absensi a ON a.user_id=u.id AND strftime('%Y-%m',a.tanggal)=?
    WHERE u.aktif=1 ${hanyaSaya ? 'AND u.id=?' : ''}
    GROUP BY u.id ORDER BY u.nama`).bind(...(hanyaSaya ? [bulan, me.id] : [bulan])).all()
  return c.json({ absensi: results, rekap, bulan })
})

// Owner/admin koreksi absensi manual (izin/sakit/alpa atau perbaiki jam)
app.put('/api/admin/absensi/koreksi', requireAuth(['owner', 'admin']), async (c) => {
  const { user_id, tanggal, status, jam_masuk, jam_pulang, catatan } = await c.req.json()
  if (!user_id || !tanggal) return c.json({ error: 'user_id dan tanggal wajib.' }, 400)
  const STATUS = ['hadir', 'izin', 'sakit', 'libur', 'alpa']
  if (status && !STATUS.includes(status)) return c.json({ error: 'Status tidak valid.' }, 400)
  await c.env.DB.prepare(`
    INSERT INTO absensi (user_id, tanggal, jam_masuk, jam_pulang, status, catatan) VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id, tanggal) DO UPDATE SET
      jam_masuk=excluded.jam_masuk, jam_pulang=excluded.jam_pulang, status=excluded.status, catatan=excluded.catatan
  `).bind(user_id, tanggal, jam_masuk || null, jam_pulang || null, status || 'hadir', catatan || '').run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'absensi', user_id, `Koreksi absen ${tanggal} → ${status || 'hadir'}`)
  return c.json({ sukses: true })
})

// Upah harian per user (owner)
app.put('/api/admin/users/:id/upah', requireAuth(['owner']), async (c) => {
  const upah = parseInt((await c.req.json()).upah_harian)
  if (isNaN(upah) || upah < 0) return c.json({ error: 'Upah tidak valid.' }, 400)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE users SET upah_harian=? WHERE id=?').bind(upah, id).run()
  await catatAudit(c.env.DB, c.get('user'), 'ubah', 'users', parseInt(id), `Upah harian → ${upah}`)
  return c.json({ sukses: true })
})

// Daftar gaji per periode + hitungan otomatis dari absensi (owner)
app.get('/api/admin/gaji', requireAuth(['owner']), async (c) => {
  const periode = c.req.query('periode') || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(periode)) return c.json({ error: 'Format periode harus YYYY-MM.' }, 400)
  const { results } = await c.env.DB.prepare(`
    SELECT u.id user_id, u.nama, u.role, u.upah_harian,
      COALESCE((SELECT COUNT(*) FROM absensi a WHERE a.user_id=u.id AND a.status='hadir' AND strftime('%Y-%m',a.tanggal)=?),0) hadir,
      g.id gaji_id, g.hari_hadir, g.upah_harian upah_snapshot, g.bonus, g.potongan, g.total, g.tanggal_bayar, g.catatan
    FROM users u LEFT JOIN gaji g ON g.user_id=u.id AND g.periode=?
    WHERE u.aktif=1 ORDER BY u.role='owner' DESC, u.nama`).bind(periode, periode).all()
  return c.json({ gaji: results, periode })
})

// Bayar gaji (owner) — otomatis tercatat sebagai pengeluaran kategori 'gaji'
app.post('/api/admin/gaji/bayar', requireAuth(['owner']), async (c) => {
  const me = c.get('user')
  const { user_id, periode, bonus, potongan, catatan } = await c.req.json()
  if (!user_id || !/^\d{4}-\d{2}$/.test(periode || '')) return c.json({ error: 'user_id dan periode (YYYY-MM) wajib.' }, 400)
  const sudah = await c.env.DB.prepare('SELECT id FROM gaji WHERE user_id=? AND periode=?').bind(user_id, periode).first()
  if (sudah) return c.json({ error: 'Gaji periode ini sudah dibayar untuk karyawan tersebut.' }, 400)
  const kar = await c.env.DB.prepare('SELECT nama, upah_harian, wa FROM users WHERE id=? AND aktif=1').bind(user_id).first<any>()
  if (!kar) return c.json({ error: 'Pengguna tidak ditemukan.' }, 404)
  const hadir = await c.env.DB.prepare(`SELECT COUNT(*) n FROM absensi WHERE user_id=? AND status='hadir' AND strftime('%Y-%m',tanggal)=?`).bind(user_id, periode).first<any>()
  const hariHadir = hadir?.n ?? 0
  const b = Math.max(0, parseInt(bonus) || 0)
  const p = Math.max(0, parseInt(potongan) || 0)
  const pokok = hariHadir * (kar.upah_harian || 0)
  const total = pokok + b - p
  if (total <= 0) return c.json({ error: `Total gaji Rp ${total.toLocaleString('id')} tidak valid. Cek upah harian & kehadiran (${hariHadir} hari × Rp ${(kar.upah_harian || 0).toLocaleString('id')}).` }, 400)
  const tanggal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  // Catat pengeluaran kategori gaji dulu, lalu simpan gaji dengan link
  const keluar = await c.env.DB.prepare(`INSERT INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id) VALUES (?,?,?,?,?)`)
    .bind(tanggal, 'gaji', total, `Gaji ${kar.nama} periode ${periode} (${hariHadir} hari hadir${b ? `, bonus ${b}` : ''}${p ? `, potongan ${p}` : ''})`, me.id).run()
  await c.env.DB.prepare(`INSERT INTO gaji (user_id, periode, hari_hadir, upah_harian, bonus, potongan, total, tanggal_bayar, catatan, pengeluaran_id, dibayar_oleh) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(user_id, periode, hariHadir, kar.upah_harian || 0, b, p, total, tanggal, catatan || '', keluar.meta.last_row_id, me.id).run()
  await catatAudit(c.env.DB, me, 'bayar', 'gaji', user_id, `Gaji ${kar.nama} ${periode}: Rp${total} (${hariHadir} hari)`)
  // Kirim slip gaji ke karyawan via WhatsApp (bila nomornya terdaftar)
  c.executionCtx?.waitUntil?.(notifGaji(c.env as OpenWAEnv, {
    userId: Number(user_id), nama: kar.nama, wa: kar.wa || '', periode,
    hariHadir, upahHarian: kar.upah_harian || 0, pokok, bonus: b, potongan: p, total
  }, me.id))
  return c.json({ sukses: true, total, hariHadir })
})

// Batalkan pembayaran gaji (owner) — hapus juga pengeluarannya
app.delete('/api/admin/gaji/:id', requireAuth(['owner']), async (c) => {
  const id = c.req.param('id')
  const g = await c.env.DB.prepare('SELECT g.*, u.nama FROM gaji g JOIN users u ON u.id=g.user_id WHERE g.id=?').bind(id).first<any>()
  if (!g) return c.json({ error: 'Data gaji tidak ditemukan.' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM gaji WHERE id=?').bind(id),
    ...(g.pengeluaran_id ? [c.env.DB.prepare('DELETE FROM pengeluaran WHERE id=?').bind(g.pengeluaran_id)] : [])
  ])
  await catatAudit(c.env.DB, c.get('user'), 'hapus', 'gaji', g.user_id, `Batalkan gaji ${g.nama} ${g.periode} Rp${g.total}`)
  return c.json({ sukses: true })
})

// ============ FASE 4: AUDIT LOG, EKSPOR CSV, NOTA ============

// Log aktivitas (khusus owner)
app.get('/api/admin/audit', requireAuth(['owner']), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM audit_log ORDER BY id DESC LIMIT 200'
  ).all()
  return c.json({ audit: results })
})

// Helper CSV: escape nilai + BOM agar Excel baca UTF-8 dengan benar
function keCSV(header: string[], rows: any[][]): string {
  const esc = (v: any) => {
    const s = String(v ?? '')
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

function responCSV(c: any, nama: string, csv: string) {
  return c.newResponse(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nama}"`
  })
}

// Ekspor CSV: panen / penjualan / laporan bulanan (owner & admin)
app.get('/api/admin/ekspor/:jenis', requireAuth(['owner', 'admin']), async (c) => {
  const jenis = c.req.param('jenis')
  const bulan = c.req.query('bulan') // opsional YYYY-MM
  const filterBulan = bulan && /^\d{4}-\d{2}$/.test(bulan) ? bulan : null
  const db = c.env.DB

  if (jenis === 'panen') {
    const q = filterBulan
      ? db.prepare("SELECT p.tanggal, b.kode, p.grade_a, p.grade_b, p.grade_c, p.jumlah_kg, p.susut_kg, p.catatan, u.nama FROM panen p LEFT JOIN baglog_batch b ON b.id=p.batch_id LEFT JOIN users u ON u.id=p.user_id WHERE strftime('%Y-%m',p.tanggal)=? ORDER BY p.tanggal").bind(filterBulan)
      : db.prepare('SELECT p.tanggal, b.kode, p.grade_a, p.grade_b, p.grade_c, p.jumlah_kg, p.susut_kg, p.catatan, u.nama FROM panen p LEFT JOIN baglog_batch b ON b.id=p.batch_id LEFT JOIN users u ON u.id=p.user_id ORDER BY p.tanggal')
    const { results } = await q.all()
    const csv = keCSV(
      ['Tanggal', 'Batch', 'Grade A (kg)', 'Grade B (kg)', 'Grade C (kg)', 'Total (kg)', 'Susut (kg)', 'Catatan', 'Pencatat'],
      (results as any[]).map((r) => [r.tanggal, r.kode, r.grade_a, r.grade_b, r.grade_c, r.jumlah_kg, r.susut_kg, r.catatan, r.nama])
    )
    return responCSV(c, `panen${filterBulan ? '-' + filterBulan : ''}.csv`, csv)
  }

  if (jenis === 'penjualan') {
    const q = filterBulan
      ? db.prepare("SELECT j.tanggal, j.nama_produk, j.jumlah, j.total, COALESCE(pl.nama, j.pembeli) pembeli, j.status_bayar, j.jatuh_tempo, j.tanggal_lunas, u.nama FROM penjualan j LEFT JOIN pelanggan pl ON pl.id=j.pelanggan_id LEFT JOIN users u ON u.id=j.user_id WHERE strftime('%Y-%m',j.tanggal)=? ORDER BY j.tanggal").bind(filterBulan)
      : db.prepare('SELECT j.tanggal, j.nama_produk, j.jumlah, j.total, COALESCE(pl.nama, j.pembeli) pembeli, j.status_bayar, j.jatuh_tempo, j.tanggal_lunas, u.nama FROM penjualan j LEFT JOIN pelanggan pl ON pl.id=j.pelanggan_id LEFT JOIN users u ON u.id=j.user_id ORDER BY j.tanggal')
    const { results } = await q.all()
    const csv = keCSV(
      ['Tanggal', 'Produk', 'Jumlah', 'Total (Rp)', 'Pembeli', 'Status Bayar', 'Jatuh Tempo', 'Tanggal Lunas', 'Pencatat'],
      (results as any[]).map((r) => [r.tanggal, r.nama_produk, r.jumlah, r.total, r.pembeli, r.status_bayar, r.jatuh_tempo, r.tanggal_lunas, r.nama])
    )
    return responCSV(c, `penjualan${filterBulan ? '-' + filterBulan : ''}.csv`, csv)
  }

  if (jenis === 'keuangan') {
    const bln = filterBulan || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
    const [jual, lain, keluar] = await Promise.all([
      db.prepare("SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE strftime('%Y-%m',tanggal)=?").bind(bln).first<any>(),
      db.prepare("SELECT COALESCE(SUM(jumlah),0) v FROM pemasukan_lain WHERE strftime('%Y-%m',tanggal)=?").bind(bln).first<any>(),
      db.prepare("SELECT kategori, COALESCE(SUM(jumlah),0) v FROM pengeluaran WHERE strftime('%Y-%m',tanggal)=? GROUP BY kategori").bind(bln).all()
    ])
    const totalKeluar = (keluar.results as any[]).reduce((a, r) => a + r.v, 0)
    const rows: any[][] = [
      ['PEMASUKAN', ''],
      ['Penjualan', jual?.v ?? 0],
      ['Pemasukan lain', lain?.v ?? 0],
      ['', ''],
      ['PENGELUARAN', ''],
      ...(keluar.results as any[]).map((r) => [r.kategori, r.v]),
      ['', ''],
      ['Total pemasukan', (jual?.v ?? 0) + (lain?.v ?? 0)],
      ['Total pengeluaran', totalKeluar],
      ['LABA / RUGI', (jual?.v ?? 0) + (lain?.v ?? 0) - totalKeluar]
    ]
    return responCSV(c, `laporan-keuangan-${bln}.csv`, keCSV([`Laporan ${bln}`, 'Jumlah (Rp)'], rows))
  }

  return c.json({ error: 'Jenis ekspor: panen / penjualan / keuangan' }, 400)
})

// Data nota (untuk halaman cetak) — penjualan atau pesanan
app.get('/api/admin/nota/:jenis/:id', requireAuth(), async (c) => {
  const { jenis, id } = c.req.param()
  const cfg = await getPengaturan(c.env.DB)
  if (jenis === 'penjualan') {
    const j = await c.env.DB.prepare(`
      SELECT j.*, COALESCE(pl.nama, j.pembeli) AS nama_pembeli, pl.alamat, pl.wa
      FROM penjualan j LEFT JOIN pelanggan pl ON pl.id = j.pelanggan_id WHERE j.id = ?
    `).bind(id).first<any>()
    if (!j) return c.json({ error: 'Tidak ditemukan' }, 404)
    return c.json({ nota: { kode: 'JL-' + String(j.id).padStart(5, '0'), tanggal: j.tanggal, pembeli: j.nama_pembeli, alamat: j.alamat || '', status_bayar: j.status_bayar, jatuh_tempo: j.jatuh_tempo, item: [{ nama: j.nama_produk, jumlah: j.jumlah, harga: Math.round(j.total / j.jumlah), subtotal: j.total }], total: j.total }, cfg })
  }
  if (jenis === 'pesanan') {
    const ps = await c.env.DB.prepare(`
      SELECT ps.*, pl.nama AS nama_pembeli, pl.alamat, pl.wa
      FROM pesanan ps LEFT JOIN pelanggan pl ON pl.id = ps.pelanggan_id WHERE ps.id = ?
    `).bind(id).first<any>()
    if (!ps) return c.json({ error: 'Tidak ditemukan' }, 404)
    const { results: items } = await c.env.DB.prepare('SELECT nama_produk nama, jumlah, harga, subtotal FROM pesanan_item WHERE pesanan_id = ?').bind(id).all()
    const total = (items as any[]).reduce((a, b) => a + b.subtotal, 0)
    return c.json({ nota: { kode: ps.kode, tanggal: ps.tanggal_pesan, tanggal_kirim: ps.tanggal_kirim, pembeli: ps.nama_pembeli, alamat: ps.alamat || '', status: ps.status, item: items, total }, cfg })
  }
  return c.json({ error: 'Jenis: penjualan / pesanan' }, 400)
})

// ============ HALAMAN 404 & PENANGANAN GALAT ============

/**
 * 404 bergaya Hiratake — pengunjung nyasar diarahkan kembali ke
 * beranda / produk / lacak, bukan dibiarkan melihat teks "Not Found".
 * Untuk rute /api/* tetap balas JSON agar frontend mudah menanganinya.
 */
app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/')) {
    return c.json({ error: 'Endpoint tidak ditemukan.', path }, 404)
  }
  // Ambil identitas situs; bila DB bermasalah pakai default agar 404 tetap tampil
  let cfg: Record<string, string> = {}
  try { cfg = await getPengaturan(c.env.DB) } catch { /* pakai default */ }
  return c.html(halaman404({
    nama: cfg.situs_nama || 'Hiratake',
    namaJp: cfg.situs_nama_jp || '平茸',
    warna: warnaValid(cfg.situs_warna),
    wa: cfg.wa_nomor || '6281234567890',
    pesananOnline: cfg.situs_pesanan_online !== '0'
  }, path), 404)
})

export default app
