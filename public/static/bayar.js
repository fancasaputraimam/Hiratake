// ===== Halaman Pembayaran — QRIS / instruksi tunai + polling status =====
const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const el = (id) => document.getElementById(id);
const KODE = new URLSearchParams(location.search).get('kode') || '';

let DATA = null;
let timerPolling = null;
let timerHitung = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, ok = true) {
  const t = el('toast');
  t.textContent = msg;
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-sm z-50 text-white ${ok ? 'bg-green-700' : 'bg-red-700'}`;
  setTimeout(() => t.classList.add('hidden'), 3500);
}

function gagalMuat(pesan) {
  el('bayar-muat').classList.add('hidden');
  el('bayar-error').classList.remove('hidden');
  el('bayar-error-teks').innerHTML = `<i class="fas fa-triangle-exclamation mr-2 text-vermillion"></i>${esc(pesan)}`;
}

// ---------- Muat data pembayaran ----------
async function muat() {
  if (!KODE) return gagalMuat('Kode pembayaran tidak ada di alamat halaman.');
  try {
    const res = await fetch('/api/bayar/' + encodeURIComponent(KODE));
    DATA = await res.json();
    if (!res.ok) throw new Error(DATA.error || 'Data pembayaran tidak ditemukan.');

    el('bayar-muat').classList.add('hidden');
    el('bayar-isi').classList.remove('hidden');

    el('bayar-kode-pesanan').textContent = DATA.pesananKode;
    el('bayar-jumlah').textContent = rupiah(DATA.jumlah);
    el('bayar-kode').textContent = 'Kode bayar: ' + DATA.kode;

    renderRincian();
    if (DATA.lacakUrl) {
      const a = el('bayar-lacak');
      a.href = DATA.lacakUrl;
      a.classList.remove('hidden');
    }
    render();
  } catch (e) {
    gagalMuat(e.message);
  }
}

function renderRincian() {
  el('bayar-item').innerHTML = (DATA.item || []).map((i) => `
    <div class="flex justify-between gap-2">
      <span class="min-w-0"><span class="font-medium">${esc(i.nama_produk)}</span>
        <span class="block text-xs text-sumi/50">${i.jumlah} × ${rupiah(i.harga)}</span></span>
      <span class="whitespace-nowrap">${rupiah(i.subtotal)}</span>
    </div>`).join('');

  const sub = (DATA.item || []).reduce((a, b) => a + (b.subtotal || 0), 0);
  let t = `<div class="flex justify-between"><span class="text-sumi/60">Subtotal</span><span>${rupiah(sub)}</span></div>`;
  if (DATA.ongkir > 0) t += `<div class="flex justify-between"><span class="text-sumi/60">Ongkir</span><span>${rupiah(DATA.ongkir)}</span></div>`;
  if (DATA.biayaAdmin > 0) t += `<div class="flex justify-between"><span class="text-sumi/60">Biaya layanan</span><span>${rupiah(DATA.biayaAdmin)}</span></div>`;
  t += `<div class="flex justify-between font-bold pt-2 border-t border-sumi/10"><span>Total</span><span class="text-vermillion">${rupiah(DATA.jumlah)}</span></div>`;
  el('bayar-total-area').innerHTML = t;
}

// ---------- Render sesuai status ----------
function render() {
  const pill = el('bayar-status-pill');
  ['bayar-qr-area', 'bayar-cash-area', 'bayar-lunas-area', 'bayar-gagal-area']
    .forEach((id) => el(id).classList.add('hidden'));

  if (DATA.status === 'dibayar') {
    pill.textContent = 'Lunas';
    pill.className = 'inline-block text-xs px-4 py-1.5 rounded-full mb-5 bg-green-100 text-green-800';
    el('bayar-lunas-area').classList.remove('hidden');
    hentikanTimer();
    return;
  }
  if (DATA.status === 'kedaluwarsa' || DATA.status === 'gagal' || DATA.status === 'batal') {
    pill.textContent = DATA.status === 'kedaluwarsa' ? 'Kedaluwarsa' : DATA.status === 'batal' ? 'Dibatalkan' : 'Gagal';
    pill.className = 'inline-block text-xs px-4 py-1.5 rounded-full mb-5 bg-red-100 text-red-700';
    el('bayar-gagal-judul').textContent = DATA.status === 'kedaluwarsa'
      ? 'Pembayaran Kedaluwarsa' : DATA.status === 'batal' ? 'Pembayaran Dibatalkan' : 'Pembayaran Gagal';
    el('bayar-gagal-area').classList.remove('hidden');
    hentikanTimer();
    return;
  }

  // Menunggu
  pill.textContent = 'Menunggu Pembayaran';
  pill.className = 'inline-block text-xs px-4 py-1.5 rounded-full mb-5 bg-kin/20 text-yellow-800';

  if (DATA.metode === 'cash') {
    el('bayar-cash-area').classList.remove('hidden');
    el('bayar-cash-instruksi').textContent = DATA.instruksi ||
      'Bayar tunai saat barang diterima. Admin akan mengonfirmasi setelah pembayaran diterima.';
    return;
  }

  el('bayar-qr-area').classList.remove('hidden');
  el('bayar-instruksi').textContent = DATA.instruksi || 'Scan QRIS berikut untuk membayar.';
  gambarQR();
  aturHitungBalik();
  mulaiPolling();

  if (DATA.bayarUrl) {
    const a = el('bayar-link-provider');
    a.href = DATA.bayarUrl;
    a.classList.remove('hidden');
  }
  if (DATA.perluBuktiManual) {
    el('bayar-bukti-manual').classList.remove('hidden');
    const pesan = `Halo ${window.SITUS.nama}! 🍄\nSaya sudah membayar pesanan:\n\n• Kode pesanan: ${DATA.pesananKode}\n• Kode bayar: ${DATA.kode}\n• Jumlah: ${rupiah(DATA.jumlah)}\n\nBerikut bukti transfernya. Mohon dicek. Terima kasih!`;
    el('bayar-wa-bukti').href = `https://wa.me/${window.SITUS.wa}?text=${encodeURIComponent(pesan)}`;
  }
}

// ---------- QR ----------
function gambarQR() {
  const canvas = el('bayar-qr-canvas');
  const img = el('bayar-qr-img');

  // 1) Payload QRIS mentah → digambar sendiri (paling tajam & bisa diunduh)
  if (DATA.qrString && window.QRCode) {
    canvas.classList.remove('hidden');
    img.classList.add('hidden');
    QRCode.toCanvas(canvas, DATA.qrString, { width: 260, margin: 1 }, (err) => {
      if (err) { canvas.classList.add('hidden'); pakaiGambar(); }
    });
    return;
  }
  pakaiGambar();

  function pakaiGambar() {
    if (!DATA.qrUrl) {
      el('bayar-qr-wrap').innerHTML =
        '<p class="text-sm text-vermillion p-6"><i class="fas fa-triangle-exclamation mr-1"></i>Kode QR tidak tersedia. Hubungi kami via WhatsApp.</p>';
      return;
    }
    canvas.classList.add('hidden');
    img.classList.remove('hidden');
    img.src = DATA.qrUrl;
    el('bayar-unduh').classList.add('hidden');
  }
}

el('bayar-unduh')?.addEventListener('click', () => {
  const canvas = el('bayar-qr-canvas');
  if (canvas.classList.contains('hidden')) {
    if (DATA?.qrUrl) window.open(DATA.qrUrl, '_blank');
    return;
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `qris-${DATA.pesananKode}.png`;
  a.click();
});

// ---------- Hitung balik ----------
function aturHitungBalik() {
  if (!DATA.expiresAt) return;
  // expires_at dari D1 berformat "YYYY-MM-DD HH:MM:SS" dalam UTC
  const batas = new Date(String(DATA.expiresAt).replace(' ', 'T') + 'Z').getTime();
  const tampil = el('bayar-hitung');
  clearInterval(timerHitung);
  const tik = () => {
    const sisa = batas - Date.now();
    if (sisa <= 0) {
      clearInterval(timerHitung);
      tampil.innerHTML = '<span class="text-vermillion">Batas waktu habis. Memeriksa status…</span>';
      cekStatus(true);
      return;
    }
    const m = Math.floor(sisa / 60000);
    const s = Math.floor((sisa % 60000) / 1000);
    tampil.innerHTML = `Bayar dalam <span class="text-vermillion font-bold">${m}:${String(s).padStart(2, '0')}</span>`;
  };
  tik();
  timerHitung = setInterval(tik, 1000);
}

// ---------- Polling status ----------
function mulaiPolling() {
  clearInterval(timerPolling);
  timerPolling = setInterval(() => cekStatus(false), 6000);
}
function hentikanTimer() {
  clearInterval(timerPolling);
  clearInterval(timerHitung);
}

async function cekStatus(manual) {
  try {
    const res = await fetch(`/api/bayar/${encodeURIComponent(KODE)}/status`);
    const d = await res.json();
    if (!res.ok) return;
    if (d.status && d.status !== DATA.status) {
      DATA.status = d.status;
      render();
      if (d.status === 'dibayar') toast('Pembayaran diterima. Terima kasih!');
    } else if (manual) {
      toast(d.manual
        ? 'Belum terdeteksi. QRIS ini diverifikasi admin — kirim bukti transfer via WhatsApp.'
        : 'Belum ada pembayaran masuk. Coba lagi beberapa saat.', false);
    }
    if (d.final) hentikanTimer();
  } catch { /* diam: polling boleh gagal */ }
}

el('bayar-cek')?.addEventListener('click', () => {
  const b = el('bayar-cek');
  b.disabled = true;
  b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Memeriksa…';
  cekStatus(true).finally(() => {
    b.disabled = false;
    b.innerHTML = '<i class="fas fa-rotate mr-1"></i>Cek Status';
  });
});

// Hemat kuota: hentikan polling saat tab tidak terlihat
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInterval(timerPolling);
  else if (DATA && DATA.status === 'menunggu' && DATA.metode === 'qris') { cekStatus(false); mulaiPolling(); }
});

muat();
