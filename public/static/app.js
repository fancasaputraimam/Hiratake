// ===== Hiratake — Frontend JS =====
// Nomor WA otomatis dari pengaturan database (di-inject server), fallback default
const WA_NUMBER = (window.HIRATAKE_CONFIG && window.HIRATAKE_CONFIG.wa) || '6281234567890';

// Format Rupiah
const rupiah = (n) => 'Rp ' + n.toLocaleString('id-ID');

// Muat produk dari API
let produkList = [];
async function loadProduk() {
  try {
    const res = await fetch('/api/produk');
    const data = await res.json();
    produkList = data.produk;

    const grid = document.getElementById('product-list');
    grid.innerHTML = produkList.map((p) => `
      <article class="product-card fade-up">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <div class="p-icon"><i class="fas ${p.ikon}"></i></div>
        <p class="text-xs text-red-700/60 font-medium tracking-widest mb-1">${p.jp}</p>
        <h3 class="font-semibold text-lg mb-1" style="font-family:'Noto Serif JP',serif">${p.nama}</h3>
        <p class="text-sm text-gray-500 mb-4 leading-relaxed">${p.deskripsi}</p>
        <div class="flex items-center justify-between">
          <span class="text-xl font-bold" style="color:#C73E3A">${rupiah(p.harga)}<span class="text-xs font-normal text-gray-400">/${p.satuan}</span></span>
          <button onclick="pesanProduk(${p.id})" class="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-full transition">
            <i class="fab fa-whatsapp mr-1"></i>Pesan
          </button>
        </div>
      </article>
    `).join('');

    // Isi dropdown form
    const select = document.getElementById('order-product');
    select.innerHTML = produkList.map((p) =>
      `<option value="${p.id}">${p.nama} — ${rupiah(p.harga)}</option>`
    ).join('');

    // Aktifkan animasi untuk kartu baru
    observeFadeUp();
  } catch (err) {
    console.error('Gagal memuat produk:', err);
  }
}

// Pesan langsung dari kartu produk
function pesanProduk(id) {
  const p = produkList.find((x) => x.id === id);
  if (!p) return;
  const pesan = `Halo Hiratake! 🍄\nSaya ingin memesan:\n\n• ${p.nama}\n• Harga: ${rupiah(p.harga)}/${p.satuan}\n\nMohon info ketersediaannya. Terima kasih!`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(pesan)}`, '_blank');
}

// Form pemesanan → WhatsApp
document.getElementById('order-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const nama = document.getElementById('order-name').value.trim();
  const id = parseInt(document.getElementById('order-product').value);
  const qty = document.getElementById('order-qty').value;
  const note = document.getElementById('order-note').value.trim();
  const p = produkList.find((x) => x.id === id);
  if (!p) return;

  const total = p.harga * parseInt(qty || 1);
  let pesan = `Halo Hiratake! 🍄\nSaya *${nama}* ingin memesan:\n\n• Produk: ${p.nama}\n• Jumlah: ${qty} ${p.satuan}\n• Estimasi total: ${rupiah(total)}`;
  if (note) pesan += `\n• Catatan: ${note}`;
  pesan += '\n\nMohon konfirmasinya. Terima kasih!';

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(pesan)}`, '_blank');
});

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

// Init
observeFadeUp();
animateCounters();
loadProduk();
