// ===== Hiratake — Frontend JS (Landing Page) =====
// Konfigurasi di-inject server: nomor WA & status pesanan online
const CFG = window.HIRATAKE_CONFIG || {};
const WA_NUMBER = CFG.wa || '6281234567890';
const PESAN_ONLINE = CFG.pesanOnline !== false;

// Format Rupiah
const rupiah = (n) => 'Rp ' + n.toLocaleString('id-ID');

// Escape HTML (anti-XSS) — data produk berasal dari input admin
const escH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// Muat produk dari API — klik kartu/tombol produk langsung menuju halaman checkout
// dengan produk tersebut sudah terpilih (?produk=ID). Satu jalur pemesanan saja.
async function loadProduk() {
  try {
    const res = await fetch('/api/produk');
    const data = await res.json();
    const produkList = data.produk;

    const grid = document.getElementById('product-list');
    grid.innerHTML = produkList.map((p) => `
      <article class="product-card fade-up cursor-pointer group" data-produk-id="${p.id}"
               role="link" tabindex="0" aria-label="Pesan ${escH(p.nama)}">
        ${p.badge ? `<span class="badge">${escH(p.badge)}</span>` : ''}
        <div class="p-icon"><i class="fas ${escH(p.ikon)}"></i></div>
        <p class="text-xs text-red-700/60 font-medium tracking-widest mb-1">${escH(p.jp)}</p>
        <h3 class="font-semibold text-lg mb-1" style="font-family:'Noto Serif JP',serif">${escH(p.nama)}</h3>
        <p class="text-sm text-gray-500 mb-4 leading-relaxed">${escH(p.deskripsi)}</p>
        <div class="flex items-center justify-between">
          <span class="text-xl font-bold" style="color:#C73E3A">${rupiah(p.harga)}<span class="text-xs font-normal text-gray-400">/${escH(p.satuan)}</span></span>
          <span class="bg-vermillion group-hover:bg-red-700 text-white text-sm px-4 py-2 rounded-full transition pointer-events-none" style="background-color:#C73E3A">
            <i class="fas fa-basket-shopping mr-1"></i>Pesan
          </span>
        </div>
      </article>
    `).join('');

    // Klik / Enter pada kartu → langsung ke checkout dengan produk terpilih
    grid.querySelectorAll('[data-produk-id]').forEach((card) => {
      const go = () => pesanProduk(parseInt(card.dataset.produkId));
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    // Aktifkan animasi untuk kartu baru
    observeFadeUp();
  } catch (err) {
    console.error('Gagal memuat produk:', err);
  }
}

// Satu jalur pemesanan: ke halaman checkout (produk sudah terpilih).
// Bila pesanan online dimatikan owner, fallback ke chat WhatsApp.
function pesanProduk(id) {
  if (PESAN_ONLINE) {
    window.location.href = '/checkout?produk=' + id;
  } else {
    const pesan = 'Halo! 🍄 Saya ingin memesan jamur tiram. Mohon info ketersediaannya. Terima kasih!';
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(pesan)}`, '_blank');
  }
}

// Menu mobile
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('hidden');
});
document.querySelectorAll('#mobile-menu a').forEach((a) =>
  a.addEventListener('click', () => document.getElementById('mobile-menu').classList.add('hidden'))
);

// Animasi fade-up saat scroll
function observeFadeUp() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up:not(.visible)').forEach((el) => io.observe(el));
}

// Animasi angka statistik
function animateCounters() {
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = parseInt(el.dataset.counter);
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 60));
    const timer = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(timer); }
      el.textContent = cur + '+';
    }, 25);
  });
}

// Shadow navbar saat scroll
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('shadow-md', window.scrollY > 20);
});

// Pesan pengarahan bila pengunjung mencoba membuka /checkout langsung.
// Server mengalihkan ke /?pilih=1#produk atau /?produk_tidak_ada=1#produk.
function tampilkanPesanPilihProduk() {
  const q = new URLSearchParams(location.search);
  const kotak = document.getElementById('pilih-produk-dulu');
  const teks = document.getElementById('pilih-produk-dulu-teks');
  if (!kotak || !teks) return;

  let isi = '';
  if (q.get('pilih') === '1') {
    isi = '<strong>Silakan pilih produk dulu.</strong> Halaman checkout hanya bisa dibuka setelah Anda memilih produk yang diminati di bawah ini.';
  } else if (q.get('produk_tidak_ada') === '1') {
    isi = '<strong>Produk tidak tersedia.</strong> Produk yang Anda tuju sudah tidak aktif atau tidak ditemukan. Silakan pilih produk lain di bawah ini.';
  }
  if (!isi) return;

  teks.innerHTML = isi;
  kotak.classList.remove('hidden');

  // Bersihkan query dari address bar agar pesan tidak muncul lagi saat refresh
  if (window.history.replaceState) {
    window.history.replaceState({}, '', location.pathname + '#produk');
  }
  setTimeout(() => {
    document.getElementById('produk')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 250);
}

// Init
observeFadeUp();
animateCounters();
loadProduk();
tampilkanPesanPilihProduk();
