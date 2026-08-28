import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { loginPage, adminPage } from './adminPages'
import {
  type Bindings, type SessionUser,
  verifyPassword, hashPassword, generateToken, getSessionUser, requireAuth
} from './auth'

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

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
  const [cfg, baglogAktif, panenRata, pelangganCount] = await Promise.all([
    getPengaturan(db),
    db.prepare(`
      SELECT COALESCE(SUM(b.jumlah),0) - COALESCE((SELECT SUM(k.jumlah) FROM baglog_kejadian k JOIN baglog_batch bb ON bb.id=k.batch_id WHERE bb.status != 'afkir'),0) AS v
      FROM baglog_batch b WHERE b.status != 'afkir'
    `).first<any>(),
    db.prepare("SELECT COALESCE(ROUND(AVG(t.total),1),0) v FROM (SELECT tanggal, SUM(jumlah_kg) total FROM panen WHERE tanggal >= date('now','-30 days') GROUP BY tanggal) t").first<any>(),
    db.prepare('SELECT COUNT(*) v FROM pelanggan WHERE aktif = 1').first<any>()
  ])
  const waNomor = cfg.wa_nomor || '6281234567890'
  const waTampil = '+' + waNomor.replace(/^(\d{2})(\d{3})(\d{4})(\d+)$/, '$1 $2-$3-$4')
  const statBaglog = Math.max(0, baglogAktif?.v ?? 0)
  const statPanen = panenRata?.v ?? 0
  const statPelanggan = pelangganCount?.v ?? 0
  return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hiratake — Jamur Tiram Segar Berkualitas | ヒラタケ</title>
  <meta name="description" content="Hiratake adalah usaha budidaya jamur tiram segar berkualitas premium. Dipanen setiap hari, higienis, dan bergizi tinggi.">
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            vermillion: '#C73E3A',
            sumi: '#2B2B2B',
            washi: '#F7F3EA',
            matcha: '#7A8450',
            kin: '#C9A227'
          },
          fontFamily: {
            serifjp: ['"Noto Serif JP"', 'serif'],
            sans: ['Poppins', 'sans-serif']
          }
        }
      }
    }
  </script>
</head>
<body class="bg-washi font-sans text-sumi antialiased">

  <!-- Navbar -->
  <header id="navbar" class="fixed top-0 left-0 right-0 z-50 bg-washi/90 backdrop-blur border-b border-sumi/10 transition-shadow">
    <nav class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
      <a href="#hero-section" class="flex items-center gap-3">
        <img src="/static/logo-hiratake.png" alt="Logo Hiratake" class="w-11 h-11 rounded-full object-cover ring-1 ring-sumi/10">
        <div>
          <span class="font-serifjp font-bold text-lg tracking-wide">HIRATAKE</span>
          <span class="block text-[10px] text-vermillion tracking-[0.35em] -mt-1">ヒラタケ・平茸</span>
        </div>
      </a>
      <ul class="hidden md:flex items-center gap-7 text-sm font-medium">
        <li><a href="#tentang" class="nav-link hover:text-vermillion transition">Tentang</a></li>
        <li><a href="#produk" class="nav-link hover:text-vermillion transition">Produk</a></li>
        <li><a href="#keunggulan" class="nav-link hover:text-vermillion transition">Keunggulan</a></li>
        <li><a href="#proses" class="nav-link hover:text-vermillion transition">Proses</a></li>
        <li><a href="#galeri" class="nav-link hover:text-vermillion transition">Galeri</a></li>
        <li>
          <a href="#kontak" class="bg-vermillion text-white px-5 py-2 rounded-full hover:bg-red-700 transition shadow">
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
      <a href="#kontak" class="block py-2 text-vermillion font-semibold">Pesan Sekarang</a>
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
        <p class="text-sumi/70 mb-8 leading-relaxed">
          <strong>Hiratake</strong> (平茸) berarti "jamur tiram" dalam bahasa Jepang.
          Kami membudidayakan jamur tiram putih segar dengan standar kebersihan tinggi —
          dipanen setiap pagi dan siap diantar ke dapur Anda.
        </p>
        <div class="flex flex-wrap gap-4">
          <a href="#kontak" class="bg-vermillion text-white px-7 py-3 rounded-full font-semibold hover:bg-red-700 transition shadow-lg">
            <i class="fab fa-whatsapp mr-2"></i>Pesan Sekarang
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
          <img src="/static/logo-hiratake.png" alt="Logo Hiratake - Jamur Tiram" class="w-60 md:w-80 rounded-full shadow-2xl float-anim">
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
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Tentang Hiratake</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
      </div>
      <div class="grid md:grid-cols-2 gap-10 items-center">
        <figure class="fade-up">
          <img src="https://sspark.genspark.ai/cfimages?u1=UioU8CaAvFwXKgmDMTnHAZ%2Fg8LdiUQwf6zafVhGnJbJ0UEqSD4FLOLdl85aj5HyHhXOQknYrIU1v9Q4R71mp7yHKoRVA6ofE3WeF%2B0bJ&u2=nsI7BCG4ryEZBNgw&width=1024"
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
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Mengapa Memilih Hiratake?</h2>
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
        <img src="https://sspark.genspark.ai/cfimages?u1=UioU8CaAvFwXKgmDMTnHAZ%2Fg8LdiUQwf6zafVhGnJbJ0UEqSD4FLOLdl85aj5HyHhXOQknYrIU1v9Q4R71mp7yHKoRVA6ofE3WeF%2B0bJ&u2=nsI7BCG4ryEZBNgw&width=1024" alt="Budidaya jamur tiram di kumbung" class="gallery-img" loading="lazy">
        <img src="https://sspark.genspark.ai/cfimages?u1=Xxq1%2FW5JqrpFiB0S1Ye%2BEx4h%2Fx6Qmk8WXefqU9ReHq5qnkSFfThr07xjegPEf7arx5xISF%2FtcaajpK8hg74GlF565NgbC52k2Y8%2FINw3&u2=QG9bO7d9VlcHardp&width=1024" alt="Rak baglog jamur tiram" class="gallery-img" loading="lazy">
        <img src="https://sspark.genspark.ai/cfimages?u1=yJmdIqKhR9nRMzxD%2FsFD3ShYd9gSsgfbr%2FfwT9KYjYkT6XR7Z2m3W4khJ2hQzs5Cd6zbzJWZGmzJ0w7wf0C%2BtKLAmfHOGxCIanbbFmmC&u2=DY5IzDqNlvNkFvpI&width=1024" alt="Pengemasan jamur tiram" class="gallery-img" loading="lazy">
        <img src="https://sspark.genspark.ai/cfimages?u1=eA1kewb6MI7OsnRyBxRuHQyhyqfH%2Fyu%2BNfMpRmB2UvLlTBxy%2BQy%2B%2BTxDWn9T%2FtE3PzpiF5quRuSuX6LUl7sbMo5Pi1qRkMondpy%2B13fCIKozLMFLxS8bI5FhZsK8YGocEkXhQJtl%2FU8pxdHdm1I8u2FOKF81AbeUxGBz3iEsKn%2BSDQ%3D%3D&u2=ae3EDdYubcZhb2vj&width=1024" alt="Jamur tiram segar hasil panen" class="gallery-img" loading="lazy">
        <img src="https://sspark.genspark.ai/cfimages?u1=5SlE%2BW1Bj5OfyXt5OyH9SiYoWOvQiEgshGmU1R50d8FblnMlLqiVMGpH8waNm4FeA5u48pG7QEvW1NRhRLPrUifdDJj19vIlenEAKaCEq3IUZloDkzgy8WxfGTmVGjWVavCDRAMj20vn7gWKMiQQ%2FyzLNl%2BodfxOb53Jcj9nDzioqJARfrw%3D&u2=bdzZ8C37YOzEBIy%2B&width=1024" alt="Jamur tiram putih segar" class="gallery-img" loading="lazy">
        <img src="https://sspark.genspark.ai/cfimages?u1=JQhLMkIrzwAKHh7DmCjC%2Bj8fl8t2gct7Atj%2B7nfqcg23jhiTMDxiiQrXn5dOxVDQlvwJ%2FalGenXPYsN0ecfoWg3X0IeqbgE1tFZWqEsRW2AR2sEGid7jJ5l7ADspQ87GktQJPMGdtQykd5RXlLjMXjDBKS%2BeXU1RXPFTuhkNTReO9a0w1ki4HTpBpuNh07hv%2BZBKM4%2BqJE59L%2Fj5uPpR6GYhpA%3D%3D&u2=1g62Vo%2F10iUqatS4&width=1024" alt="Jamur tiram di keranjang panen" class="gallery-img" loading="lazy">
      </div>
    </div>
  </section>

  <!-- Kontak / Pemesanan -->
  <section id="kontak" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">ご注文</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Pesan Sekarang</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
        <p class="text-sumi/60 mt-4">Isi formulir di bawah, pesanan Anda akan langsung terhubung ke WhatsApp kami.</p>
      </div>
      <div class="grid md:grid-cols-2 gap-10">
        <form id="order-form" class="bg-washi rounded-2xl p-7 shadow-lg space-y-4 fade-up">
          <div>
            <label for="order-name" class="block text-sm font-medium mb-1">Nama</label>
            <input id="order-name" type="text" required placeholder="Nama Anda" class="form-input">
          </div>
          <div>
            <label for="order-product" class="block text-sm font-medium mb-1">Produk</label>
            <select id="order-product" class="form-input"></select>
          </div>
          <div>
            <label for="order-qty" class="block text-sm font-medium mb-1">Jumlah</label>
            <input id="order-qty" type="number" min="1" value="1" required class="form-input">
          </div>
          <div>
            <label for="order-note" class="block text-sm font-medium mb-1">Catatan (opsional)</label>
            <textarea id="order-note" rows="3" placeholder="Alamat pengiriman / permintaan khusus" class="form-input"></textarea>
          </div>
          <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-full transition shadow">
            <i class="fab fa-whatsapp mr-2"></i>Kirim Pesanan via WhatsApp
          </button>
        </form>
        <aside class="fade-up space-y-6">
          <div class="contact-card"><i class="fab fa-whatsapp text-green-600"></i><div><h3>WhatsApp</h3><p>${waTampil}</p></div></div>
          <div class="contact-card"><i class="fas fa-location-dot text-vermillion"></i><div><h3>Lokasi Kumbung</h3><p>${cfg.alamat || '-'}</p></div></div>
          <div class="contact-card"><i class="fas fa-clock text-kin"></i><div><h3>Jam Operasional</h3><p>${cfg.jam_operasional || '-'}</p></div></div>
          <div class="bg-vermillion/5 border border-vermillion/20 rounded-2xl p-6">
            <h3 class="font-serifjp font-semibold text-lg mb-2"><i class="fas fa-store mr-2 text-vermillion"></i>Kemitraan & Grosir</h3>
            <p class="text-sm text-sumi/70">Kami membuka kerja sama untuk warung, restoran, katering, dan reseller. Hubungi kami untuk harga khusus grosir dan pasokan rutin.</p>
          </div>
        </aside>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-sumi text-washi/70 py-10">
    <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
      <div>
        <div class="flex items-center gap-3 mb-3">
          <img src="/static/logo-hiratake.png" alt="Logo Hiratake" class="w-10 h-10 rounded-full">
          <span class="font-serifjp font-bold text-lg text-washi">HIRATAKE <span class="text-vermillion text-xs">平茸</span></span>
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
    <p class="text-center text-xs mt-8 text-washi/40">© 2026 Hiratake — Jamur Tiram Segar. いただきます！ · <a href="/login" class="hover:text-vermillion underline underline-offset-2"><i class="fas fa-lock mr-1"></i>Login Pengelola</a></p>
  </footer>

  <!-- Tombol WhatsApp mengambang -->
  <a href="https://wa.me/${waNomor}?text=Halo%20Hiratake%2C%20saya%20mau%20pesan%20jamur%20tiram"
     target="_blank" rel="noopener" id="wa-float" aria-label="Chat WhatsApp"
     class="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-xl z-50 transition hover:scale-110">
    <i class="fab fa-whatsapp"></i>
  </a>

  <script>window.HIRATAKE_CONFIG = { wa: "${waNomor}" };</script>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

// ============ HALAMAN LOGIN & ADMIN ============

app.get('/login', async (c) => {
  const user = await getSessionUser(c)
  if (user) return c.redirect('/admin')
  return c.html(loginPage())
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

  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash, nama, role, aktif FROM users WHERE username = ?'
  ).bind(username.toLowerCase()).first<any>()

  if (!user || !user.aktif || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Username atau kata sandi salah.' }, 401)
  }

  const token = generateToken()
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))"
  ).bind(token, user.id).run()

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

// ============ API PUBLIK ============

// Daftar produk aktif (dipakai halaman depan)
app.get('/api/produk', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, nama, jp, harga, satuan, deskripsi, ikon, badge FROM produk WHERE aktif = 1 ORDER BY id'
  ).all()
  return c.json({ produk: results })
})

// ============ API PENGELOLAAN (WAJIB LOGIN) ============

// --- Ringkasan dashboard (semua role) ---
app.get('/api/admin/ringkasan', requireAuth(), async (c) => {
  const db = c.env.DB
  const [panenHariIni, panenBulanIni, jualHariIni, jualBulanIni, panen7, jual7, totalProduk] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE tanggal = date('now')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(jumlah_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE tanggal = date('now')").first<any>(),
    db.prepare("SELECT COALESCE(SUM(total),0) v FROM penjualan WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now')").first<any>(),
    db.prepare("SELECT tanggal, SUM(jumlah_kg) v FROM panen WHERE tanggal >= date('now','-6 days') GROUP BY tanggal ORDER BY tanggal").all(),
    db.prepare("SELECT tanggal, SUM(total) v FROM penjualan WHERE tanggal >= date('now','-6 days') GROUP BY tanggal ORDER BY tanggal").all(),
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
    db.prepare("SELECT COALESCE(SUM(susut_kg),0) v FROM panen WHERE strftime('%Y-%m',tanggal) = strftime('%Y-%m','now')").first<any>(),
    db.prepare(`
      SELECT COALESCE(SUM(p.jumlah_kg),0) AS total_kg, COALESCE((SELECT SUM(jumlah) FROM baglog_batch WHERE status='produktif'),0) AS baglog_produktif
      FROM panen p WHERE p.batch_id IS NOT NULL
    `).first<any>()
  ])
  return c.json({
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

// --- Panen (semua role bisa catat & lihat) ---
app.get('/api/admin/panen', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.id, p.tanggal, p.jumlah_kg, p.grade_a, p.grade_b, p.grade_c, p.susut_kg, p.catatan,
           u.nama AS pencatat, b.kode AS batch_kode
    FROM panen p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN baglog_batch b ON b.id = p.batch_id
    ORDER BY p.tanggal DESC, p.id DESC LIMIT 100
  `).all()
  return c.json({ panen: results })
})

app.post('/api/admin/panen', requireAuth(), async (c) => {
  const { tanggal, batch_id, grade_a, grade_b, grade_c, susut_kg, catatan } = await c.req.json()
  const ga = parseFloat(grade_a) || 0, gb = parseFloat(grade_b) || 0, gc = parseFloat(grade_c) || 0
  const susut = parseFloat(susut_kg) || 0
  const total = Math.round((ga + gb + gc) * 100) / 100
  if (!tanggal || total <= 0) return c.json({ error: 'Tanggal dan minimal satu grade (A/B/C) wajib diisi.' }, 400)
  if (batch_id) {
    const b = await c.env.DB.prepare("SELECT id, status FROM baglog_batch WHERE id = ?").bind(batch_id).first<any>()
    if (!b) return c.json({ error: 'Batch tidak ditemukan.' }, 404)
    // Batch yang dipanen otomatis jadi produktif
    if (b.status === 'inkubasi') {
      await c.env.DB.prepare("UPDATE baglog_batch SET status = 'produktif' WHERE id = ?").bind(batch_id).run()
    }
  }
  await c.env.DB.prepare(
    'INSERT INTO panen (tanggal, jumlah_kg, grade_a, grade_b, grade_c, susut_kg, batch_id, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, total, ga, gb, gc, susut, batch_id || null, catatan || '', c.get('user').id).run()
  return c.json({ sukses: true, total })
})

app.delete('/api/admin/panen/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('DELETE FROM panen WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ sukses: true })
})

// --- Penjualan (semua role bisa catat & lihat) ---
app.get('/api/admin/penjualan', requireAuth(), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT j.id, j.tanggal, j.nama_produk, j.jumlah, j.total, j.pembeli, j.status_bayar, j.jatuh_tempo, j.tanggal_lunas,
           u.nama AS pencatat, pl.nama AS pelanggan_nama, pl.tipe AS pelanggan_tipe
    FROM penjualan j LEFT JOIN users u ON u.id = j.user_id LEFT JOIN pelanggan pl ON pl.id = j.pelanggan_id
    ORDER BY j.tanggal DESC, j.id DESC LIMIT 100
  `).all()
  return c.json({ penjualan: results })
})

app.post('/api/admin/penjualan', requireAuth(), async (c) => {
  const { tanggal, produk_id, jumlah, pelanggan_id, pembeli, status_bayar, jatuh_tempo } = await c.req.json()
  if (!tanggal || !produk_id || !jumlah || jumlah <= 0) return c.json({ error: 'Data penjualan tidak lengkap.' }, 400)
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
  await c.env.DB.prepare(
    'INSERT INTO penjualan (tanggal, produk_id, nama_produk, jumlah, total, pembeli, pelanggan_id, status_bayar, jatuh_tempo, tanggal_lunas, berat_kg, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(tanggal, produk_id, p.nama, jumlah, p.harga * jumlah, namaPembeli, pelanggan_id || null, bayar,
    bayar === 'tempo' ? jatuh_tempo : null, bayar === 'lunas' ? tanggal : null, (p.berat_kg || 0) * jumlah, c.get('user').id).run()
  return c.json({ sukses: true })
})

// Tandai piutang lunas
app.put('/api/admin/penjualan/:id/lunas', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare("UPDATE penjualan SET status_bayar='lunas', tanggal_lunas=date('now') WHERE id = ? AND status_bayar='tempo'")
    .bind(c.req.param('id')).run()
  return c.json({ sukses: true })
})

app.delete('/api/admin/penjualan/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('DELETE FROM penjualan WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ sukses: true })
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

// --- Pengguna (hanya owner) ---
app.get('/api/admin/users', requireAuth(['owner']), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, username, nama, role, aktif, created_at FROM users ORDER BY id'
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
  return c.json({ sukses: true, kode })
})

// Ubah status batch (owner & admin)
app.put('/api/admin/baglog/:id/status', requireAuth(['owner', 'admin']), async (c) => {
  const { status } = await c.req.json()
  if (!['inkubasi', 'produktif', 'afkir'].includes(status)) return c.json({ error: 'Status tidak valid.' }, 400)
  await c.env.DB.prepare(
    `UPDATE baglog_batch SET status = ?, tanggal_afkir = ${status === 'afkir' ? "date('now')" : 'NULL'},
     tanggal_masuk_kumbung = CASE WHEN ? = 'produktif' AND tanggal_masuk_kumbung IS NULL THEN date('now') ELSE tanggal_masuk_kumbung END
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
      CASE WHEN j.jatuh_tempo < date('now') THEN 1 ELSE 0 END AS terlambat
    FROM penjualan j LEFT JOIN pelanggan pl ON pl.id = j.pelanggan_id
    WHERE j.status_bayar = 'tempo'
    ORDER BY j.jatuh_tempo ASC
  `).all()
  return c.json({ piutang: results })
})

// ============ FASE 2: KEUANGAN (owner & admin) ============

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
  const { tanggal, kategori, jumlah, keterangan } = await c.req.json()
  if (!tanggal || !kategori || !jumlah || jumlah <= 0) return c.json({ error: 'Tanggal, kategori, dan jumlah wajib diisi.' }, 400)
  if (!KATEGORI_PENGELUARAN.includes(kategori)) return c.json({ error: 'Kategori tidak valid.' }, 400)
  await c.env.DB.prepare('INSERT INTO pengeluaran (tanggal, kategori, jumlah, keterangan, user_id) VALUES (?, ?, ?, ?, ?)')
    .bind(tanggal, kategori, jumlah, keterangan || '', c.get('user').id).run()
  return c.json({ sukses: true })
})

app.delete('/api/admin/pengeluaran/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('DELETE FROM pengeluaran WHERE id = ?').bind(c.req.param('id')).run()
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
  await c.env.DB.prepare('INSERT INTO pemasukan_lain (tanggal, jumlah, keterangan, user_id) VALUES (?, ?, ?, ?)')
    .bind(tanggal, jumlah, keterangan || '', c.get('user').id).run()
  return c.json({ sukses: true })
})

app.delete('/api/admin/pemasukan-lain/:id', requireAuth(['owner', 'admin']), async (c) => {
  await c.env.DB.prepare('DELETE FROM pemasukan_lain WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ sukses: true })
})

// Laporan laba/rugi + HPP per bulan (?bulan=YYYY-MM, default bulan berjalan)
app.get('/api/admin/laporan', requireAuth(['owner', 'admin']), async (c) => {
  const db = c.env.DB
  const bulan = c.req.query('bulan') || new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(bulan)) return c.json({ error: 'Format bulan harus YYYY-MM.' }, 400)

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
    db.prepare(`SELECT COALESCE(SUM(jumlah * biaya_per_baglog),0) v, COALESCE(SUM(jumlah),0) n FROM baglog_batch WHERE strftime('%Y-%m',tanggal)=?`).bind(bulan).first<any>(),
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

// ============ FASE 3: STOK HARIAN + REKONSILIASI ============

const JENIS_PENYESUAIAN = ['rusak', 'bonus', 'sampel', 'konsumsi', 'koreksi', 'lainnya']

// Rekonsiliasi stok per hari dalam 1 bulan: panen vs terjual (kg) vs penyesuaian
app.get('/api/admin/stok', requireAuth(), async (c) => {
  const db = c.env.DB
  const bulan = c.req.query('bulan') || new Date().toISOString().slice(0, 7)
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

  // Kode otomatis PO-YYYY-MM-XXX
  const bulan = String(tanggal_pesan).slice(0, 7)
  const n = await c.env.DB.prepare(`SELECT COUNT(*) v FROM pesanan WHERE kode LIKE ?`).bind(`PO-${bulan}-%`).first<any>()
  const kode = `PO-${bulan}-${String((n?.v ?? 0) + 1).padStart(3, '0')}`

  const res = await c.env.DB.prepare(
    'INSERT INTO pesanan (kode, pelanggan_id, tanggal_pesan, tanggal_kirim, status, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(kode, pelanggan_id, tanggal_pesan, tanggal_kirim, 'baru', catatan || '', c.get('user').id).run()
  const pesananId = res.meta.last_row_id

  await c.env.DB.batch(barisItem.map(b =>
    c.env.DB.prepare('INSERT INTO pesanan_item (pesanan_id, produk_id, nama_produk, jumlah, harga, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(pesananId, b.produk_id, b.nama_produk, b.jumlah, b.harga, b.subtotal)
  ))
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
  return c.json({ sukses: true })
})

// Selesaikan pesanan → otomatis buat baris penjualan per item (anti-miss: PO selesai pasti tercatat sebagai penjualan)
app.post('/api/admin/pesanan/:id/selesai', requireAuth(), async (c) => {
  const { status_bayar, jatuh_tempo } = await c.req.json()
  const bayar = status_bayar === 'tempo' ? 'tempo' : 'lunas'
  if (bayar === 'tempo' && !jatuh_tempo) return c.json({ error: 'Pembayaran tempo wajib tanggal jatuh tempo.' }, 400)

  const ps = await c.env.DB.prepare('SELECT * FROM pesanan WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!ps) return c.json({ error: 'Pesanan tidak ditemukan.' }, 404)
  if (ps.status === 'selesai' || ps.penjualan_dibuat) return c.json({ error: 'Pesanan sudah selesai & penjualan sudah tercatat (tidak bisa dobel).' }, 400)
  if (ps.status === 'batal') return c.json({ error: 'Pesanan batal tidak bisa diselesaikan.' }, 400)

  const pl = await c.env.DB.prepare('SELECT nama FROM pelanggan WHERE id = ?').bind(ps.pelanggan_id).first<any>()
  const { results: items } = await c.env.DB.prepare('SELECT * FROM pesanan_item WHERE pesanan_id = ?').bind(ps.id).all()
  if (!items.length) return c.json({ error: 'Pesanan tidak punya item.' }, 400)

  const tanggal = new Date().toISOString().slice(0, 10)
  const stmts: any[] = []
  for (const it of items as any[]) {
    const p = await c.env.DB.prepare('SELECT berat_kg FROM produk WHERE id = ?').bind(it.produk_id).first<any>()
    stmts.push(c.env.DB.prepare(
      'INSERT INTO penjualan (tanggal, produk_id, nama_produk, jumlah, total, pembeli, pelanggan_id, status_bayar, jatuh_tempo, tanggal_lunas, berat_kg, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(tanggal, it.produk_id, it.nama_produk, it.jumlah, it.subtotal, pl?.nama || '', ps.pelanggan_id, bayar,
      bayar === 'tempo' ? jatuh_tempo : null, bayar === 'lunas' ? tanggal : null, (p?.berat_kg || 0) * it.jumlah, c.get('user').id))
  }
  stmts.push(c.env.DB.prepare("UPDATE pesanan SET status='selesai', penjualan_dibuat=1 WHERE id = ?").bind(ps.id))
  await c.env.DB.batch(stmts)
  return c.json({ sukses: true, jumlahPenjualan: items.length })
})

// ============ FASE 1: PENGATURAN WEBSITE ============

app.get('/api/admin/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  return c.json({ pengaturan: await getPengaturan(c.env.DB) })
})

app.put('/api/admin/pengaturan', requireAuth(['owner', 'admin']), async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const kunciDiizinkan = ['wa_nomor', 'alamat', 'jam_operasional', 'instagram', 'facebook', 'tiktok']
  const stmts = []
  for (const [key, value] of Object.entries(body)) {
    if (!kunciDiizinkan.includes(key)) continue
    if (key === 'wa_nomor' && !/^\d{9,15}$/.test(String(value))) {
      return c.json({ error: 'Nomor WA harus angka saja diawali kode negara, contoh: 6281234567890' }, 400)
    }
    stmts.push(c.env.DB.prepare('INSERT INTO pengaturan (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, String(value)))
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ sukses: true })
})

export default app
