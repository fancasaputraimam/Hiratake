import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
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
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="500">0</p><p class="text-xs text-sumi/60">Baglog Aktif</p></div>
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="25">0</p><p class="text-xs text-sumi/60">Kg / Hari</p></div>
          <div><p class="font-serifjp text-3xl font-bold text-vermillion" data-counter="100">0</p><p class="text-xs text-sumi/60">Pelanggan Setia</p></div>
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
          <div class="contact-card"><i class="fab fa-whatsapp text-green-600"></i><div><h3>WhatsApp</h3><p>+62 812-3456-7890</p></div></div>
          <div class="contact-card"><i class="fas fa-location-dot text-vermillion"></i><div><h3>Lokasi Kumbung</h3><p>Jl. Raya Jamur No. 88, Indonesia</p></div></div>
          <div class="contact-card"><i class="fas fa-clock text-kin"></i><div><h3>Jam Operasional</h3><p>Setiap hari, 06.00 – 18.00 WIB</p></div></div>
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
    <p class="text-center text-xs mt-8 text-washi/40">© 2026 Hiratake — Jamur Tiram Segar. いただきます！</p>
  </footer>

  <!-- Tombol WhatsApp mengambang -->
  <a href="https://wa.me/6281234567890?text=Halo%20Hiratake%2C%20saya%20mau%20pesan%20jamur%20tiram"
     target="_blank" rel="noopener" id="wa-float" aria-label="Chat WhatsApp"
     class="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-xl z-50 transition hover:scale-110">
    <i class="fab fa-whatsapp"></i>
  </a>

  <script src="/static/app.js"></script>
</body>
</html>`)
})

// API: daftar produk
app.get('/api/produk', (c) => {
  return c.json({
    produk: [
      { id: 1, nama: 'Jamur Tiram Segar 250g', jp: '新鮮ヒラタケ', harga: 8000, satuan: 'pack', deskripsi: 'Kemasan praktis untuk masakan rumahan sehari-hari.', ikon: 'fa-seedling', badge: 'Terlaris' },
      { id: 2, nama: 'Jamur Tiram Segar 500g', jp: '新鮮ヒラタケ', harga: 15000, satuan: 'pack', deskripsi: 'Ukuran keluarga, cocok untuk tumisan dan sup.', ikon: 'fa-basket-shopping', badge: null },
      { id: 3, nama: 'Jamur Tiram Segar 1kg', jp: '新鮮ヒラタケ', harga: 28000, satuan: 'kg', deskripsi: 'Hemat untuk warung makan dan katering.', ikon: 'fa-box', badge: 'Hemat' },
      { id: 4, nama: 'Jamur Crispy 100g', jp: 'カリカリきのこ', harga: 12000, satuan: 'pouch', deskripsi: 'Camilan jamur tiram goreng krispi gurih renyah.', ikon: 'fa-cookie-bite', badge: 'Baru' },
      { id: 5, nama: 'Baglog Siap Panen', jp: '菌床ブロック', harga: 20000, satuan: 'baglog', deskripsi: 'Media tanam siap panen, cocok untuk edukasi & hobi.', ikon: 'fa-cubes', badge: null },
      { id: 6, nama: 'Paket Grosir 10kg+', jp: '卸売パック', harga: 250000, satuan: 'paket', deskripsi: 'Harga khusus mitra restoran & reseller, pasokan rutin.', ikon: 'fa-handshake', badge: 'Mitra' }
    ]
  })
})

export default app
